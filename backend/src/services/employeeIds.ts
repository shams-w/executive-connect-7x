import type {Prisma} from '@prisma/client';
import {prisma} from '../db.js';

// Employee IDs follow the original seed format: "EMP" + a number of at least 3 digits (EMP001, EMP012, EMP1234).
export const EMPLOYEE_ID_FORMAT='EMP001';
const PATTERN=/^EMP(\d{3,})$/;

/** Normalizes common variants ("emp12", "EMP-012", "EMP 12") to EMP012; null when it can't be read as an employee ID. */
export function normalizeEmployeeId(value:unknown):string|null{
  const m=String(value??'').trim().toUpperCase().match(/^EMP[\s_-]?(\d{1,9})$/);
  return m?formatEmployeeId(Number(m[1])):null;
}
export const formatEmployeeId=(n:number)=>`EMP${String(n).padStart(3,'0')}`;
export const isValidEmployeeId=(id:string)=>PATTERN.test(id);

/** The next `count` free IDs after the highest existing EMP number. */
export async function nextEmployeeIds(count:number,db:Prisma.TransactionClient|typeof prisma=prisma):Promise<string[]>{
  const rows=await db.employee.findMany({where:{employeeId:{startsWith:'EMP'}},select:{employeeId:true}});
  const max=rows.reduce((m,r)=>{const x=r.employeeId.match(PATTERN);return x?Math.max(m,Number(x[1])):m;},0);
  return Array.from({length:count},(_,i)=>formatEmployeeId(max+1+i));
}
