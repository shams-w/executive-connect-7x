import type {EventType,Language,MessageTemplate} from '@prisma/client';
import {prisma} from '../db.js';
const DEFAULT_MILESTONES=new Set([1,5,10,15,20]);
export async function selectTemplate(eventType:EventType,language:Language,yearsOfService?:number|null):Promise<MessageTemplate|null>{
  const templates=await prisma.messageTemplate.findMany({where:{eventType,language,isActive:true},orderBy:{internalName:'asc'}});
  if(eventType==='WORK_ANNIVERSARY'){
    const milestone=yearsOfService!=null&&DEFAULT_MILESTONES.has(yearsOfService);
    if(milestone){const t=templates.find(x=>x.internalName.toLowerCase().includes('milestone'));if(t)return t;}
    const standard=templates.find(x=>!x.internalName.toLowerCase().includes('milestone'));if(standard)return standard;
  }
  return templates[0]??null;
}

type VariableContext={firstName:string;lastName?:string|null;fullName:string;yearsOfService?:number|null};
/** Values for a template's body variables ({{1}}, {{2}}, …) in the order listed in its `variables` field. */
export function templateVariables(names:unknown,eventType:EventType,ctx:VariableContext):string[]{
  const list=Array.isArray(names)?names.map(String):[];
  if(!list.length)return eventType==='BIRTHDAY'?[ctx.firstName]:[ctx.firstName,String(ctx.yearsOfService??'')];
  const values:Record<string,string>={firstName:ctx.firstName,lastName:ctx.lastName??'',fullName:ctx.fullName,yearsOfService:String(ctx.yearsOfService??'')};
  return list.map(n=>values[n]??'');
}
export function renderBody(bodyText:string|null|undefined,values:string[]){
  if(!bodyText)return null;
  return bodyText.replace(/\{\{(\d+)\}\}/g,(m,i)=>values[Number(i)-1]??m);
}
/** Which template a celebration would use (an explicit per-event choice wins) and the text the employee would receive. */
export async function previewMessage(opts:{eventType:EventType;language:Language;yearsOfService?:number|null;templateId?:string|null;employee:VariableContext}){
  const chosen=opts.templateId?await prisma.messageTemplate.findFirst({where:{id:opts.templateId,isActive:true}}):null;
  const template=chosen??await selectTemplate(opts.eventType,opts.language,opts.yearsOfService);
  if(!template)return {template:null,text:null};
  const values=templateVariables(template.variables,opts.eventType,{...opts.employee,yearsOfService:opts.yearsOfService});
  return {template:{id:template.id,internalName:template.internalName,metaTemplateName:template.metaTemplateName},text:renderBody(template.bodyText,values)};
}
