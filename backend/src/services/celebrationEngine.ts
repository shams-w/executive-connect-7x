export type EmployeeDateInput = { id:string; birthday?:Date|null; joiningDate:Date; isActive:boolean; whatsappConsent:boolean };
export type Candidate = { employeeId:string; eventType:'BIRTHDAY'|'WORK_ANNIVERSARY'; eventYear:number; yearsOfService?:number; eventDate:Date };
export type LeapPolicy='FEB_28'|'MAR_01';

function partsInZone(date:Date,timeZone:string){
  const fmt=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'});
  const p=Object.fromEntries(fmt.formatToParts(date).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return {year:+p.year,month:+p.month,day:+p.day};
}
function isLeap(y:number){return y%4===0&&(y%100!==0||y%400===0)}
function matches(md:Date, today:{year:number;month:number;day:number}, policy:LeapPolicy){
  const m=md.getUTCMonth()+1,d=md.getUTCDate();
  if(m===2&&d===29&&!isLeap(today.year)) return policy==='FEB_28' ? today.month===2&&today.day===28 : today.month===3&&today.day===1;
  return m===today.month&&d===today.day;
}
export function getCelebrationCandidates(emp:EmployeeDateInput, now=new Date(), policy:LeapPolicy='FEB_28', timeZone='Asia/Dubai'):Candidate[]{
  if(!emp.isActive||!emp.whatsappConsent) return [];
  const t=partsInZone(now,timeZone); const out:Candidate[]=[];
  if(emp.birthday&&matches(emp.birthday,t,policy)) out.push({employeeId:emp.id,eventType:'BIRTHDAY',eventYear:t.year,eventDate:new Date(Date.UTC(t.year,t.month-1,t.day))});
  if(matches(emp.joiningDate,t,policy)){
    const years=t.year-emp.joiningDate.getUTCFullYear();
    if(years>0) out.push({employeeId:emp.id,eventType:'WORK_ANNIVERSARY',eventYear:t.year,yearsOfService:years,eventDate:new Date(Date.UTC(t.year,t.month-1,t.day))});
  }
  return out;
}
