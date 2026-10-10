import {describe,it,expect,beforeAll,afterAll,vi} from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import {PrismaClient} from '@prisma/client';
import {env} from '../src/config/env.js';
import * as XLSX from 'xlsx';

vi.mock('../src/providers/whatsapp.js',()=>({
  provider:()=>({
    sendTemplateMessage:async()=>({messageId:'',status:'FAILED' as const,errorCode:'TRANSIENT_TEST',errorReason:'simulated failure'}),
    validateConfiguration:async()=>({ok:true,message:'mocked'}),
    verifyWebhookSignature:()=>true
  })
}));

const enabled=process.env.RUN_DB_TESTS==='1';
const describeDb=enabled?describe:describe.skip;
const prisma=new PrismaClient();
const suffix=`api_${Date.now()}`;
function token(role:'SUPER_ADMIN'|'HR_ADMIN'|'COMMUNICATIONS_ADMIN'|'VIEWER'){return jwt.sign({id:`${suffix}_${role}`,username:role.toLowerCase(),role},env.JWT_SECRET,{expiresIn:'15m'});}

describeDb('API acceptance tests',()=>{
  let app:any;
  beforeAll(async()=>{await prisma.$connect();app=(await import('../src/app.js')).app;});
  afterAll(async()=>{
    await prisma.inboundMessage.deleteMany({where:{waMessageId:{startsWith:suffix}}});
    await prisma.messageDelivery.deleteMany({where:{employee:{employeeId:{startsWith:suffix}}}});
    await prisma.celebrationEvent.deleteMany({where:{employee:{employeeId:{startsWith:suffix}}}});
    await prisma.employee.deleteMany({where:{employeeId:{startsWith:suffix}}});
    await prisma.employee.deleteMany({where:{mobile:{startsWith:'+97150999'}}});
    await prisma.excelImport.deleteMany({where:{uploadedBy:{in:(await prisma.user.findMany({where:{username:{startsWith:suffix}}})).map(u=>u.id)}}});
    await prisma.user.deleteMany({where:{username:{startsWith:suffix}}});
    await prisma.messageTemplate.deleteMany({where:{internalName:{startsWith:suffix}}});
    await prisma.systemSetting.deleteMany({where:{key:{in:['LAST_TEST_PASSED','DATABASE_BACKUP_CONFIGURED','WHATSAPP_CONFIG','LAST_CONNECTION_CHECK']}}});
    await prisma.$disconnect();
  });

  it('11. correct template is selected by employee language',async()=>{
    const {queueApprovedEvents}=await import('../src/services/jobs.js');
    const emp=await prisma.employee.create({data:{employeeId:`${suffix}_lang`,firstName:'Arabic',fullName:'Arabic Test',mobile:'+971500000001',joiningDate:new Date('2020-09-28T00:00:00Z'),preferredLanguage:'AR',importedAt:new Date(Date.now()-3600000)}});
    await prisma.messageTemplate.create({data:{internalName:`${suffix}_ar`,metaTemplateName:`${suffix}_anniversary_ar`,metaTemplateLanguage:'ar',eventType:'WORK_ANNIVERSARY',language:'AR',metaCategory:'UTILITY',variables:['firstName','yearsOfService']}});
    const {todayInZone}=await import('../src/utils/date.js');const {runtimeSettings}=await import('../src/services/runtimeSettings.js');const today=todayInZone((await runtimeSettings()).timezone);
    // Only today's celebrations are queued (earlier days expire), so the event is dated today.
    const ev=await prisma.celebrationEvent.create({data:{employeeId:emp.id,eventType:'WORK_ANNIVERSARY',eventYear:today.getUTCFullYear(),yearsOfService:5,eventDate:today,status:'APPROVED'}});
    await queueApprovedEvents();const d=await prisma.messageDelivery.findUnique({where:{celebrationEventId:ev.id}});expect(d?.templateName).toBe(`${suffix}_anniversary_ar`);
  });

  it('12. failed delivery is stored',async()=>{
    const {processQueue}=await import('../src/services/jobs.js');
    const emp=await prisma.employee.create({data:{employeeId:`${suffix}_fail`,firstName:'Fail',fullName:'Fail Test',mobile:'+971500000001',joiningDate:new Date('2020-09-28T00:00:00Z'),importedAt:new Date(Date.now()-3600000)}});
    const tpl=await prisma.messageTemplate.create({data:{internalName:`${suffix}_fail_tpl`,metaTemplateName:`${suffix}_fail_tpl`,metaTemplateLanguage:'en',eventType:'BIRTHDAY',language:'EN',metaCategory:'UTILITY',variables:['firstName']}});
    const ev=await prisma.celebrationEvent.create({data:{employeeId:emp.id,eventType:'BIRTHDAY',eventYear:2092,eventDate:new Date('2092-09-28T00:00:00Z'),status:'QUEUED'}});
    const d=await prisma.messageDelivery.create({data:{celebrationEventId:ev.id,employeeId:emp.id,templateName:tpl.metaTemplateName,recipientPhoneMasked:'+971 50 *** **01',status:'QUEUED'}});
    await processQueue();const saved=await prisma.messageDelivery.findUnique({where:{id:d.id}});expect(saved?.status).toBe('FAILED');expect(saved?.failureReason).toContain('simulated');
  });

  it('13. webhook updates SENT → DELIVERED → READ',async()=>{
    const emp=await prisma.employee.create({data:{employeeId:`${suffix}_receipt`,firstName:'Receipt',fullName:'Receipt Test',mobile:'+971500000001',joiningDate:new Date('2020-09-28T00:00:00Z')}});
    const ev=await prisma.celebrationEvent.create({data:{employeeId:emp.id,eventType:'BIRTHDAY',eventYear:2093,eventDate:new Date('2093-09-28T00:00:00Z'),status:'SENT'}});
    const meta=`${suffix}_meta`;const d=await prisma.messageDelivery.create({data:{celebrationEventId:ev.id,employeeId:emp.id,templateName:'x',recipientPhoneMasked:'+971 50 *** **01',status:'SENT',metaMessageId:meta,sentAt:new Date()}});
    for(const status of ['delivered','read']){await request(app).post('/api/webhooks/meta/whatsapp').send({entry:[{changes:[{value:{statuses:[{id:meta,status}]}}]}]}).expect(200);}
    expect((await prisma.messageDelivery.findUnique({where:{id:d.id}}))?.status).toBe('READ');
  });

  it('14. incoming replies are stored and never forwarded to an executive',async()=>{
    const before=await prisma.messageDelivery.count();const id=`${suffix}_inbound`;await request(app).post('/api/webhooks/meta/whatsapp').send({entry:[{changes:[{value:{messages:[{id,from:'971500000099',type:'text',text:{body:'Thank you'}}]}}]}]}).expect(200);const inbound=await prisma.inboundMessage.findUnique({where:{waMessageId:id}});expect(inbound?.body).toBe('Thank you');expect(await prisma.messageDelivery.count()).toBe(before);
  });

  it('15. viewer cannot import employees',async()=>{
    await request(app).post('/api/imports/preview').set('Authorization',`Bearer ${token('VIEWER')}`).attach('file',Buffer.from('not-read'),'employees.xlsx').expect(403);
  });

  it('16. HR admin cannot view Meta secret',async()=>{
    const r=await request(app).get('/api/settings/whatsapp').set('Authorization',`Bearer ${token('HR_ADMIN')}`).expect(200);const body=JSON.stringify(r.body);expect(body).not.toContain('META_ACCESS_TOKEN');if(env.META_ACCESS_TOKEN)expect(body).not.toContain(env.META_ACCESS_TOKEN);
  });

  it('partial template update only changes the fields sent',async()=>{
    const tpl=await prisma.messageTemplate.create({data:{internalName:`${suffix}_partial`,metaTemplateName:`${suffix}_partial`,metaTemplateLanguage:'en',eventType:'BIRTHDAY',language:'EN',metaCategory:'MARKETING',variables:['firstName'],isActive:false}});
    const r=await request(app).patch(`/api/templates/${tpl.id}`).set('Authorization',`Bearer ${token('SUPER_ADMIN')}`).send({bodyText:'Hi {{1}}'}).expect(200);
    expect(r.body).toMatchObject({bodyText:'Hi {{1}}',variables:['firstName'],metaCategory:'MARKETING',isActive:false});
  });

  it('new employees without an ID get the next EMP number',async()=>{
    const {nextEmployeeIds}=await import('../src/services/employeeIds.js');const [expected]=await nextEmployeeIds(1);
    const r=await request(app).post('/api/employees').set('Authorization',`Bearer ${token('HR_ADMIN')}`).send({firstName:'Auto',mobile:'+971509990001',joiningDate:'2020-01-01',confirmDuplicates:true}).expect(201);
    expect(r.body.employeeId).toBe(expected);
    await request(app).post('/api/employees').set('Authorization',`Bearer ${token('HR_ADMIN')}`).send({employeeId:'7X999',firstName:'Bad',mobile:'+971509990002',joiningDate:'2020-01-01'}).expect(400);
  });

  it('Excel rows without an ID match by WhatsApp number or get new EMP numbers',async()=>{
    const user=await prisma.user.create({data:{username:`${suffix}_importer`,displayName:'Importer',role:'HR_ADMIN',passwordHash:'x'}});
    const auth=`Bearer ${jwt.sign({id:user.id,username:user.username,role:'HR_ADMIN'},env.JWT_SECRET,{expiresIn:'5m'})}`;
    const existing=await prisma.employee.findFirstOrThrow({where:{mobile:'+971509990001'}});
    const ws=XLSX.utils.json_to_sheet([{'First Name':'Auto','Mobile':'+971509990001','Joining Date':'01/01/2020'},{'First Name':'Brand New','Mobile':'+971509990003','Joining Date':'02/02/2021'}]);
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Employees');const file=XLSX.write(wb,{type:'buffer',bookType:'xlsx'});
    const preview=await request(app).post('/api/imports/preview').set('Authorization',auth).attach('file',file,'ids.xlsx').expect(200);
    expect(preview.body.rows[0].data.employeeId).toBe(existing.employeeId);
    await request(app).post(`/api/imports/${preview.body.importId}/confirm`).set('Authorization',auth).expect(200);
    const created=await prisma.employee.findFirstOrThrow({where:{mobile:'+971509990003'}});
    expect(created.employeeId).toMatch(/^EMP\d{3,}$/);
    expect(await prisma.employee.count({where:{mobile:'+971509990001'}})).toBe(1);
  });

  it('WhatsApp connection saved from the dashboard is used but secrets are never returned',async()=>{
    const admin=`Bearer ${token('SUPER_ADMIN')}`;
    await request(app).put('/api/settings/whatsapp/connection').set('Authorization',admin).send({graphApiVersion:'v23.0',phoneNumberId:'111222333',wabaId:'444555666',accessToken:'EAAGsecretTOKEN9876',appSecret:'appsecret42',webhookVerifyToken:'verify-me-123'}).expect(200);
    const r=await request(app).get('/api/settings/whatsapp').set('Authorization',admin).expect(200);const body=JSON.stringify(r.body);
    expect(body).not.toContain('EAAGsecretTOKEN9876');expect(body).not.toContain('appsecret42');expect(body).not.toContain('verify-me-123');
    expect(r.body.connection.accessToken).toEqual({source:'dashboard',hint:'…9876'});
    expect(r.body.connection.phoneNumberId).toEqual({source:'dashboard',value:'111222333'});
    const stored=JSON.stringify((await prisma.systemSetting.findUnique({where:{key:'WHATSAPP_CONFIG'}}))?.value);expect(stored).not.toContain('EAAGsecretTOKEN9876');
    // Meta's webhook verification uses the saved token.
    await request(app).get('/api/webhooks/meta/whatsapp').query({'hub.mode':'subscribe','hub.verify_token':'verify-me-123','hub.challenge':'ok123'}).expect(200,'ok123');
    await request(app).get('/api/webhooks/meta/whatsapp').query({'hub.mode':'subscribe','hub.verify_token':'wrong','hub.challenge':'x'}).expect(403);
    // HR admins don't get the connection details; nobody can jump straight to production from this form.
    const hr=await request(app).get('/api/settings/whatsapp').set('Authorization',`Bearer ${token('HR_ADMIN')}`).expect(200);expect(hr.body.connection).toBeUndefined();
    await request(app).put('/api/settings/whatsapp/connection').set('Authorization',admin).send({mode:'META_PRODUCTION'}).expect(400);
    await request(app).put('/api/settings/whatsapp/connection').set('Authorization',`Bearer ${token('HR_ADMIN')}`).send({graphApiVersion:'v1.0'}).expect(403);
    await request(app).put('/api/settings/whatsapp/connection').set('Authorization',admin).send({mode:'META_TEST'}).expect(200);
    expect((await request(app).get('/api/health')).body.mode).toBe('META_TEST');
    await request(app).delete('/api/settings/whatsapp/connection').set('Authorization',admin).expect(200);
    expect((await request(app).get('/api/health')).body.mode).toBe(env.WHATSAPP_MODE);
  });

  it('17. production cannot activate without completed checklist',async()=>{
    await prisma.systemSetting.deleteMany({where:{key:{in:['LAST_TEST_PASSED','DATABASE_BACKUP_CONFIGURED']}}});await request(app).post('/api/settings/activate-production').set('Authorization',`Bearer ${token('SUPER_ADMIN')}`).send({confirmation:'ACTIVATE PRODUCTION'}).expect(400);
  });
});
