import {prisma} from '../db.js';
export type PossibleDuplicate={employeeId:string;fullName:string;reason:string};
const norm=(s:string)=>s.trim().replace(/\s+/g,' ').toLowerCase();

/** Existing employees (other than `employeeId`) sharing this name or WhatsApp number — likely typos or double entries. */
export async function findPossibleDuplicates(input:{employeeId?:string;fullName:string;mobile:string}):Promise<PossibleDuplicate[]>{
  const others=await prisma.employee.findMany({where:{employeeId:input.employeeId?{not:input.employeeId}:undefined,OR:[{fullName:{equals:input.fullName.trim(),mode:'insensitive'}},{mobile:input.mobile}]},select:{employeeId:true,fullName:true,mobile:true},take:10});
  return others.map(o=>({employeeId:o.employeeId,fullName:o.fullName,reason:o.mobile===input.mobile?'same WhatsApp number':'same name, different number'}));
}

/** Warnings for rows within one upload, and against existing employees, keyed by row index. */
export async function duplicateWarnings(rows:{employeeId:string;fullName:string;mobile:string}[]):Promise<string[][]>{
  const out=rows.map(()=>[] as string[]);
  const byName=new Map<string,number[]>(),byPhone=new Map<string,number[]>();
  rows.forEach((r,i)=>{const n=norm(r.fullName);byName.set(n,[...(byName.get(n)??[]),i]);byPhone.set(r.mobile,[...(byPhone.get(r.mobile)??[]),i]);});
  rows.forEach((r,i)=>{
    for(const j of byPhone.get(r.mobile)??[])if(j!==i&&rows[j].employeeId!==r.employeeId)out[i].push(`Same WhatsApp number as ${rows[j].employeeId} (${rows[j].fullName}) in this file`);
    for(const j of byName.get(norm(r.fullName))??[])if(j!==i&&rows[j].mobile!==r.mobile)out[i].push(`Same name as ${rows[j].employeeId} in this file, with a different number`);
  });
  if(!rows.length)return out;
  const existing=await prisma.employee.findMany({where:{OR:[{mobile:{in:rows.map(r=>r.mobile)}},...rows.map(r=>({fullName:{equals:r.fullName.trim(),mode:'insensitive' as const}}))]},select:{employeeId:true,fullName:true,mobile:true}});
  rows.forEach((r,i)=>{for(const e of existing){if(e.employeeId===r.employeeId)continue;if(e.mobile===r.mobile)out[i].push(`Same WhatsApp number as existing employee ${e.employeeId} (${e.fullName})`);else if(norm(e.fullName)===norm(r.fullName))out[i].push(`Same name as existing employee ${e.employeeId}, with a different number`);}});
  return out;
}
