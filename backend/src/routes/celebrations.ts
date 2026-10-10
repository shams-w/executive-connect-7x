import {Router} from 'express'; import {z} from 'zod'; import {prisma} from '../db.js'; import {requireAuth,allow} from '../middleware/auth.js'; import {createEligibleEvents,queueApprovedEvents,processQueue} from '../services/jobs.js'; import {audit} from '../services/audit.js'; import {runtimeSettings} from '../services/runtimeSettings.js'; import {upcomingCelebrations} from '../services/upcoming.js'; import {previewMessage} from '../services/templateSelector.js'; import {getCelebrationCandidates} from '../services/celebrationEngine.js'; import {DAY_MS,isoDate,todayInZone} from '../utils/date.js';
const r=Router();r.use(requireAuth);
const editors=allow('SUPER_ADMIN','HR_ADMIN','COMMUNICATIONS_ADMIN');
r.get('/',async(_req,res)=>res.json(await prisma.celebrationEvent.findMany({include:{employee:{select:{id:true,fullName:true,employeeId:true,department:true,preferredLanguage:true}},template:{select:{id:true,internalName:true}}},orderBy:{eventDate:'desc'},take:500})));
r.get('/upcoming',async(req,res)=>{const days=Math.min(366,Math.max(0,Number(req.query.days??30)||30));res.json(await upcomingCelebrations(days,await runtimeSettings()));});
r.post('/run/:type',editors,async(req,res)=>{const type=req.params.type==='birthday'?'BIRTHDAY':'WORK_ANNIVERSARY';const out=await createEligibleEvents(new Date(),type);await audit(req.user,'CELEBRATION_CHECK_RUN','CelebrationEvent',undefined,{type},req.ip);res.json(out);});
r.post('/process',allow('SUPER_ADMIN','COMMUNICATIONS_ADMIN'),async(_req,res)=>{const a=await queueApprovedEvents();const b=await processQueue();res.json({...a,...b});});

// Message preview for an upcoming (not yet created) celebration.
const previewSchema=z.object({employeeId:z.string(),eventType:z.enum(['BIRTHDAY','WORK_ANNIVERSARY']),yearsOfService:z.coerce.number().int().nullable().optional(),templateId:z.string().nullable().optional()});
r.get('/preview',async(req,res)=>{const p=previewSchema.safeParse(req.query);if(!p.success)return res.status(400).json({error:'Invalid preview request'});const e=await prisma.employee.findUnique({where:{id:p.data.employeeId}});if(!e)return res.status(404).json({error:'Employee not found'});res.json(await previewMessage({eventType:p.data.eventType,language:e.preferredLanguage,yearsOfService:p.data.yearsOfService,templateId:p.data.templateId,employee:e}));});

// Skip / un-skip / choose a template for one person's upcoming celebration. This pre-creates that year's event so the
// daily run keeps the choice (it never overwrites an existing event).
const planSchema=z.object({employeeId:z.string(),eventType:z.enum(['BIRTHDAY','WORK_ANNIVERSARY']),eventDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),action:z.enum(['skip','unskip','template']),templateId:z.string().nullable().optional()});
r.post('/plan',editors,async(req,res)=>{const p=planSchema.safeParse(req.body);if(!p.success)return res.status(400).json({error:'Invalid request'});const b=p.data;const settings=await runtimeSettings();
  const e=await prisma.employee.findUnique({where:{id:b.employeeId}});if(!e)return res.status(404).json({error:'Employee not found'});
  if(new Date(b.eventDate+'T00:00:00Z')<todayInZone(settings.timezone))return res.status(400).json({error:'That celebration day has already passed'});
  // Confirm the celebration really falls on that date (checking around it covers any timezone offset).
  const base=Date.parse(b.eventDate+'T12:00:00Z');const candidate=[-DAY_MS,0,DAY_MS].flatMap(o=>getCelebrationCandidates(e,new Date(base+o),settings.leapDayPolicy,settings.timezone)).find(c=>c.eventType===b.eventType&&isoDate(c.eventDate)===b.eventDate);
  if(!candidate)return res.status(400).json({error:'This employee has no such celebration on that date'});
  if(b.action==='template'&&b.templateId){const t=await prisma.messageTemplate.findFirst({where:{id:b.templateId,isActive:true,eventType:b.eventType}});if(!t)return res.status(400).json({error:'Choose an active template for this type of celebration'});}
  const where={employeeId_eventType_eventYear:{employeeId:e.id,eventType:b.eventType,eventYear:candidate.eventYear}};
  const existing=await prisma.celebrationEvent.findUnique({where,include:{deliveries:true}});
  if(existing?.deliveries.length)return res.status(400).json({error:'This message has already been queued or sent'});
  const defaultStatus=settings.sendPolicy==='AUTO'?'APPROVED':'PENDING_APPROVAL';
  const status=b.action==='skip'?'CANCELLED':b.action==='unskip'?defaultStatus:(existing?.status??defaultStatus);
  const templateId=b.action==='template'?(b.templateId??null):existing?.templateId??null;
  const ev=await prisma.celebrationEvent.upsert({where,create:{employeeId:e.id,eventType:b.eventType,eventYear:candidate.eventYear,yearsOfService:candidate.yearsOfService,eventDate:candidate.eventDate,status,templateId},update:{status,templateId}});
  await audit(req.user,b.action==='skip'?'CELEBRATION_SKIPPED':b.action==='unskip'?'CELEBRATION_UNSKIPPED':'CELEBRATION_TEMPLATE_CHOSEN','CelebrationEvent',ev.id,{eventType:b.eventType,eventDate:b.eventDate,templateId},req.ip);
  res.json(ev);});

r.get('/:id/preview',async(req,res)=>{const ev=await prisma.celebrationEvent.findUnique({where:{id:String(req.params.id)},include:{employee:true}});if(!ev)return res.status(404).json({error:'Celebration not found'});res.json(await previewMessage({eventType:ev.eventType,language:ev.employee.preferredLanguage,yearsOfService:ev.yearsOfService,templateId:ev.templateId,employee:ev.employee}));});
r.post('/:id/approve',allow('SUPER_ADMIN','COMMUNICATIONS_ADMIN'),async(req,res)=>{const ev=await prisma.celebrationEvent.update({where:{id:String(req.params.id)},data:{status:'APPROVED'}});await audit(req.user,'MESSAGE_APPROVED','CelebrationEvent',ev.id,undefined,req.ip);res.json(ev);});
r.post('/:id/reject',allow('SUPER_ADMIN','COMMUNICATIONS_ADMIN'),async(req,res)=>{const ev=await prisma.celebrationEvent.update({where:{id:String(req.params.id)},data:{status:'REJECTED'}});await audit(req.user,'MESSAGE_REJECTED','CelebrationEvent',ev.id,undefined,req.ip);res.json(ev);});
export default r;
