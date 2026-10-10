import { prisma } from '../db.js';
export async function audit(actor:{id?:string;username?:string}|undefined,action:string,entityType?:string,entityId?:string,metadata?:unknown,ip?:string){
 const safe=metadata?JSON.parse(JSON.stringify(metadata,(k,v)=>/token|secret|password|mobile|phone/i.test(k)?'[REDACTED]':v)):undefined;
 await prisma.auditLog.create({data:{actorId:actor?.id,actor:actor?.username??'SYSTEM',action,entityType,entityId,metadata:safe as any,ip}}).catch(()=>undefined);
}
