import {prisma} from '../db.js';
import {getCelebrationCandidates,type LeapPolicy} from './celebrationEngine.js';
import {DAY_MS,isoDate} from '../utils/date.js';

export type UpcomingItem={employeeId:string;employeeCode:string;fullName:string;department:string|null;language:'EN'|'AR';eventType:'BIRTHDAY'|'WORK_ANNIVERSARY';eventDate:string;daysAway:number;yearsOfService:number|null;eventId:string|null;status:string|null;templateId:string|null};

/** Celebrations in the next `days` days computed from employee dates (events themselves are only created on the day). */
export async function upcomingCelebrations(days:number,settings:{timezone:string;leapDayPolicy:LeapPolicy},now=new Date()):Promise<UpcomingItem[]>{
  const employees=await prisma.employee.findMany({where:{isActive:true,whatsappConsent:true}});
  const found:Omit<UpcomingItem,'eventId'|'status'|'templateId'>[]=[];
  for(let d=0;d<=days;d++){
    const at=new Date(now.getTime()+d*DAY_MS);
    for(const e of employees)for(const c of getCelebrationCandidates(e,at,settings.leapDayPolicy,settings.timezone))
      found.push({employeeId:e.id,employeeCode:e.employeeId,fullName:e.fullName,department:e.department,language:e.preferredLanguage,eventType:c.eventType,eventDate:isoDate(c.eventDate)!,daysAway:d,yearsOfService:c.yearsOfService??null});
  }
  const events=found.length?await prisma.celebrationEvent.findMany({where:{OR:found.map(f=>({employeeId:f.employeeId,eventType:f.eventType,eventYear:Number(f.eventDate.slice(0,4))}))}}):[];
  const key=(id:string,t:string,y:number)=>`${id}|${t}|${y}`;
  const byKey=new Map(events.map(e=>[key(e.employeeId,e.eventType,e.eventYear),e]));
  return found.map(f=>{const ev=byKey.get(key(f.employeeId,f.eventType,Number(f.eventDate.slice(0,4))));return {...f,eventId:ev?.id??null,status:ev?.status??null,templateId:ev?.templateId??null};});
}
