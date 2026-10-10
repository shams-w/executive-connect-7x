import * as XLSX from 'xlsx';
import { normalizePhone } from '../utils/phone.js';
import { isoDate, parseDateValue } from '../utils/date.js';
import { normalizeEmployeeId, EMPLOYEE_ID_FORMAT } from './employeeIds.js';

export const aliases:Record<string,string[]>={
 employeeId:['employee id','employeeid','employee id.','employee number','staff id','staffid','emp id'],
 firstName:['first name','firstname','given name'], lastName:['last name','lastname','surname'], mobile:['mobile','mobile number','phone','phone number','whatsapp','whatsapp number'],
 email:['email','email address'], birthday:['birthday','date of birth','dob','birth date'], joiningDate:['joining date','date joined','hire date','start date'],
 preferredLanguage:['language','preferred language','lang'], department:['department','dept'], company:['company','entity'], jobTitle:['job title','title','position'],country:['country','country code'],whatsappConsent:['whatsapp consent','consent','wa consent'],isActive:['active','is active','status']
};
const key=(v:string)=>v.toLowerCase().replace(/[_\-]+/g,' ').replace(/\s+/g,' ').trim();
export function detectColumns(headers:string[]){
 const out:Record<string,string>={};
 for(const h of headers){const k=key(h); for(const [field,list] of Object.entries(aliases)) if(list.map(key).includes(k)&&!out[field]) out[field]=h;}
 return out;
}
export type NormalizedEmployee={employeeId:string;firstName:string;lastName:string|null;fullName:string;mobile:string;email:string|null;birthday:string|null;joiningDate:string;preferredLanguage:'EN'|'AR';department:string|null;company:string|null;jobTitle:string|null;country:string|null;whatsappConsent:boolean;isActive:boolean};
export type RowResult={rowNumber:number;status:'ERROR'|'WARNING'|'VALID';errors:string[];warnings:string[];data?:NormalizedEmployee};
function bool(v:unknown,def=true){if(v==null||v==='')return def; const s=String(v).trim().toLowerCase(); return !['no','false','0','inactive','n'].includes(s);}
function lang(v:unknown):'EN'|'AR'{const s=String(v??'EN').trim().toLowerCase(); return ['ar','arabic','عربي','العربية'].includes(s)?'AR':'EN';}
export function normalizeRow(row:Record<string,unknown>, mapping:Record<string,string>, rowNumber:number):RowResult{
 const get=(f:string)=>mapping[f]?row[mapping[f]]:undefined; const errors:string[]=[]; const warnings:string[]=[];
 const rawId=String(get('employeeId')??'').trim(); const employeeId=rawId?normalizeEmployeeId(rawId)??'':''; const firstName=String(get('firstName')??'').trim(); const country=String(get('country')??'').trim()||null;
 if(rawId&&!employeeId) errors.push(`Employee ID "${rawId}" must look like ${EMPLOYEE_ID_FORMAT} (EMP followed by numbers)`); if(!firstName) errors.push('First Name is required');
 const phone=normalizePhone(get('mobile'),country); if(!phone.ok) errors.push(phone.error);
 const joining=parseDateValue(get('joiningDate')); if(!joining) errors.push('Joining Date is required and must be a valid date');
 const birthday=get('birthday')==null||get('birthday')===''?null:parseDateValue(get('birthday')); if(get('birthday')!==undefined&&get('birthday')!==''&&!birthday) errors.push('Birthday is not a valid date');
 if(!country && phone.ok && !String(get('mobile')??'').trim().startsWith('+')) warnings.push('Country is missing; local phone formats are not guessed');
 if(errors.length) return {rowNumber,status:'ERROR',errors,warnings};
 const last=String(get('lastName')??'').trim()||null;
 return {rowNumber,status:warnings.length?'WARNING':'VALID',errors,warnings,data:{employeeId,firstName,lastName:last,fullName:[firstName,last].filter(Boolean).join(' '),mobile:(phone as any).value,email:String(get('email')??'').trim()||null,birthday:isoDate(birthday),joiningDate:isoDate(joining)!,preferredLanguage:lang(get('preferredLanguage')),department:String(get('department')??'').trim()||null,company:String(get('company')??'').trim()||null,jobTitle:String(get('jobTitle')??'').trim()||null,country,whatsappConsent:bool(get('whatsappConsent'),true),isActive:bool(get('isActive'),true)}};
}
export function parseWorkbook(buffer:Buffer, explicitMapping?:Record<string,string>){
 const wb=XLSX.read(buffer,{type:'buffer',cellDates:false}); const sheet=wb.Sheets['Employees']??wb.Sheets[wb.SheetNames[0]]; if(!sheet) throw new Error('Workbook contains no sheets');
 const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(sheet,{defval:''}); const headers=rows[0]?Object.keys(rows[0]):[]; const mapping=explicitMapping??detectColumns(headers);
 return {sheetName:wb.SheetNames.includes('Employees')?'Employees':wb.SheetNames[0],headers,mapping,rows:rows.map((r,i)=>normalizeRow(r,mapping,i+2))};
}
export function comparable(data:NormalizedEmployee){return JSON.stringify(data,Object.keys(data).sort());}
