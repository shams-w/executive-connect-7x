import { prisma } from '../db.js';
import { env } from '../config/env.js';

async function value<T>(key:string,fallback:T):Promise<T>{
  try{const row=await prisma.systemSetting.findUnique({where:{key}});return (row?.value as T|undefined) ?? fallback;}catch{return fallback;}
}
export async function runtimeSettings(){
  return {
    sendPolicy: await value<'AUTO'|'REVIEW'>('SEND_POLICY',env.SEND_POLICY),
    inboundMode: await value<'STORE_ONLY'|'ROUTE_TO_CORPORATE_INBOX'|'AUTO_ACKNOWLEDGE'|'DISABLED'>('INBOUND_MODE',env.INBOUND_MODE),
    dailySendTime: await value<string>('DAILY_SEND_TIME',env.DAILY_SEND_TIME),
    timezone: await value<string>('APP_TIMEZONE',env.APP_TIMEZONE),
    leapDayPolicy: await value<'FEB_28'|'MAR_01'>('LEAP_DAY_POLICY',env.LEAP_DAY_POLICY),
    minimumImportAgeMinutes: await value<number>('MINIMUM_IMPORT_AGE_MINUTES',env.MINIMUM_IMPORT_AGE_MINUTES),
  };
}
export async function setRuntimeSetting(key:string,v:unknown){return prisma.systemSetting.upsert({where:{key},create:{key,value:v as any},update:{value:v as any}})}
