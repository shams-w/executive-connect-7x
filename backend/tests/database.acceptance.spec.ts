import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import {PrismaClient} from '@prisma/client';

const enabled=process.env.RUN_DB_TESTS==='1';
const describeDb=enabled?describe:describe.skip;
const prisma=new PrismaClient();
const suffix=`test_${Date.now()}`;

describeDb('PostgreSQL acceptance tests',()=>{
  beforeAll(async()=>{await prisma.$connect();});
  afterAll(async()=>{
    await prisma.messageDelivery.deleteMany({where:{employee:{employeeId:{startsWith:suffix}}}});
    await prisma.celebrationEvent.deleteMany({where:{employee:{employeeId:{startsWith:suffix}}}});
    await prisma.employee.deleteMany({where:{employeeId:{startsWith:suffix}}});
    await prisma.$disconnect();
  });
  it('1. same employee upsert twice does not duplicate employees',async()=>{
    const employeeId=`${suffix}_dup`;const data={employeeId,firstName:'One',fullName:'One Test',mobile:'+971500000001',joiningDate:new Date('2020-09-28T00:00:00Z')};
    await prisma.employee.upsert({where:{employeeId},create:data,update:data});await prisma.employee.upsert({where:{employeeId},create:data,update:data});
    expect(await prisma.employee.count({where:{employeeId}})).toBe(1);
  });
  it('2. department update changes existing employee',async()=>{
    const employeeId=`${suffix}_dept`;const base={employeeId,firstName:'Dept',fullName:'Dept Test',mobile:'+971500000001',joiningDate:new Date('2020-09-28T00:00:00Z')};
    await prisma.employee.upsert({where:{employeeId},create:{...base,department:'A'},update:{department:'A'}});await prisma.employee.upsert({where:{employeeId},create:{...base,department:'B'},update:{department:'B'}});
    expect((await prisma.employee.findUnique({where:{employeeId}}))?.department).toBe('B');
  });
  it('8. same birthday event cannot exist twice in same year',async()=>{
    const employeeId=`${suffix}_event`;const e=await prisma.employee.create({data:{employeeId,firstName:'Event',fullName:'Event Test',mobile:'+971500000001',joiningDate:new Date('2020-09-28T00:00:00Z')}});const data={employeeId:e.id,eventType:'BIRTHDAY' as const,eventYear:2026,eventDate:new Date('2026-09-28T00:00:00Z')};await prisma.celebrationEvent.create({data});await expect(prisma.celebrationEvent.create({data})).rejects.toThrow();
  });
  it('9. unique delivery protection survives process/server restart semantics',async()=>{
    const employeeId=`${suffix}_delivery`;const e=await prisma.employee.create({data:{employeeId,firstName:'Delivery',fullName:'Delivery Test',mobile:'+971500000001',joiningDate:new Date('2020-09-28T00:00:00Z')}});const ev=await prisma.celebrationEvent.create({data:{employeeId:e.id,eventType:'BIRTHDAY',eventYear:2027,eventDate:new Date('2027-09-28T00:00:00Z')}});const data={celebrationEventId:ev.id,employeeId:e.id,templateName:'birthday_greeting_en',recipientPhoneMasked:'+971 50 *** **01'};await prisma.messageDelivery.create({data});await expect(prisma.messageDelivery.create({data})).rejects.toThrow();
  });
  it('19. fatal transaction rolls back all employee changes',async()=>{
    const employeeId=`${suffix}_rollback`;await expect(prisma.$transaction(async tx=>{await tx.employee.create({data:{employeeId,firstName:'Rollback',fullName:'Rollback Test',mobile:'+971500000001',joiningDate:new Date('2020-09-28T00:00:00Z')}});throw new Error('fatal')})).rejects.toThrow('fatal');expect(await prisma.employee.findUnique({where:{employeeId}})).toBeNull();
  });
});
