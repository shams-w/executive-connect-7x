import {prisma} from '../db.js';
import {env} from '../config/env.js';
import {encryptSecret,decryptSecret} from './secretBox.js';

export type WhatsAppMode='MOCK'|'META_TEST'|'META_PRODUCTION';
export type WhatsAppConfig={mode:WhatsAppMode;graphApiVersion:string;phoneNumberId:string;wabaId:string;accessToken:string;appSecret:string;webhookVerifyToken:string};
type PlainField='graphApiVersion'|'phoneNumberId'|'wabaId';
type SecretField='accessToken'|'appSecret'|'webhookVerifyToken';
export const PLAIN_FIELDS:PlainField[]=['graphApiVersion','phoneNumberId','wabaId'];
export const SECRET_FIELDS:SecretField[]=['accessToken','appSecret','webhookVerifyToken'];
type Stored={mode?:WhatsAppMode}&Partial<Record<PlainField,string>>&{secrets?:Partial<Record<SecretField,string>>};

const KEY='WHATSAPP_CONFIG';
const fromEnv=():WhatsAppConfig=>({mode:env.WHATSAPP_MODE,graphApiVersion:env.META_GRAPH_API_VERSION,phoneNumberId:env.META_PHONE_NUMBER_ID,wabaId:env.META_WABA_ID,accessToken:env.META_ACCESS_TOKEN,appSecret:env.META_APP_SECRET,webhookVerifyToken:env.META_WEBHOOK_VERIFY_TOKEN});

// Read on every send/webhook, so keep it briefly in memory; saving clears it.
let cache:{at:number;stored:Stored}|null=null;
async function stored():Promise<Stored>{
  if(cache&&Date.now()-cache.at<30_000)return cache.stored;
  const row=await prisma.systemSetting.findUnique({where:{key:KEY}}).catch(()=>null);
  const value=(row?.value??{}) as Stored;cache={at:Date.now(),stored:value};return value;
}

/** Effective settings: anything saved in the dashboard wins, otherwise the server's .env values. */
export async function getWhatsAppConfig():Promise<WhatsAppConfig>{
  const s=await stored();const base=fromEnv();const out={...base};
  if(s.mode)out.mode=s.mode;
  for(const f of PLAIN_FIELDS)if(s[f])out[f]=s[f]!;
  for(const f of SECRET_FIELDS){const box=s.secrets?.[f];if(box){const v=decryptSecret(box);if(v)out[f]=v;}}
  return out;
}

/** What the settings page may show: plain values in full, secrets only as "saved, ends in …abcd". */
export async function describeWhatsAppConfig(){
  const s=await stored();const e=fromEnv();
  const plain=Object.fromEntries(PLAIN_FIELDS.map(f=>[f,s[f]?{source:'dashboard',value:s[f]}:e[f]?{source:'env',value:e[f]}:{source:'none',value:''}]));
  const secrets=Object.fromEntries(SECRET_FIELDS.map(f=>{const box=s.secrets?.[f];if(box){const v=decryptSecret(box);return [f,v?{source:'dashboard',hint:`…${v.slice(-4)}`}:{source:'unreadable',hint:''}];}return [f,e[f]?{source:'env',hint:`…${e[f].slice(-4)}`}:{source:'none',hint:''}];}));
  return {mode:{source:s.mode?'dashboard':'env',value:s.mode??e.mode},...plain,...secrets};
}

/** Saves the given fields. Empty strings are ignored (keep current); `clear` lists fields to remove from the dashboard copy. */
export async function saveWhatsAppConfig(patch:Partial<WhatsAppConfig>,clear:(PlainField|SecretField)[]=[]){
  const s=structuredClone(await stored());s.secrets??={};
  if(patch.mode)s.mode=patch.mode;
  for(const f of PLAIN_FIELDS){const v=patch[f]?.trim();if(v)s[f]=v;}
  for(const f of SECRET_FIELDS){const v=patch[f]?.trim();if(v)s.secrets[f]=encryptSecret(v);}
  for(const f of clear){if((PLAIN_FIELDS as string[]).includes(f))delete s[f as PlainField];else delete s.secrets[f as SecretField];}
  await prisma.systemSetting.upsert({where:{key:KEY},create:{key:KEY,value:s as any,isSecret:true},update:{value:s as any,isSecret:true}});
  cache=null;
}
export async function resetWhatsAppConfig(){await prisma.systemSetting.deleteMany({where:{key:KEY}});cache=null;}
