import axios from 'axios';
import crypto from 'node:crypto';
import { isTestAllowed } from '../services/testAllowlist.js';
import { getWhatsAppConfig, type WhatsAppConfig } from '../services/whatsappConfig.js';

export type SendTemplateInput={to:string;templateName:string;language:string;variables:string[]};
export type SendResult={messageId:string;status:'SENT'|'FAILED';errorCode?:string;errorReason?:string};
export type ValidationResult={ok:boolean;message:string;phone?:{displayPhoneNumber?:string;verifiedName?:string;qualityRating?:string}};
export type MetaTemplate={name:string;language:string;status:string;category?:string};
export interface WhatsAppProvider{sendTemplateMessage(input:SendTemplateInput):Promise<SendResult>;validateConfiguration():Promise<ValidationResult>;verifyWebhookSignature(rawBody:Buffer,signature?:string):boolean;listTemplates?():Promise<MetaTemplate[]>;}

const metaError=(e:any)=>String(e?.response?.data?.error?.message??e?.message??'Request to Meta failed').slice(0,500);

export class MockWhatsAppProvider implements WhatsAppProvider{
 async sendTemplateMessage(input:SendTemplateInput):Promise<SendResult>{return {messageId:`mock_${Date.now()}_${input.to.slice(-4)}`,status:'SENT'};}
 async validateConfiguration(){return {ok:true,message:'MOCK mode is ready. No real WhatsApp message will be sent.'};}
 verifyWebhookSignature(){return true;}
}
export class MetaWhatsAppProvider implements WhatsAppProvider{
 constructor(private cfg:WhatsAppConfig){}
 private base(){return `https://graph.facebook.com/${this.cfg.graphApiVersion}`;}
 private headers(){return {Authorization:`Bearer ${this.cfg.accessToken}`,'Content-Type':'application/json'};}
 async sendTemplateMessage(input:SendTemplateInput):Promise<SendResult>{
   if(this.cfg.mode==='META_TEST' && !(await isTestAllowed(input.to))) return {messageId:'',status:'FAILED',errorCode:'TEST_RECIPIENT_BLOCKED',errorReason:'Recipient is not on the approved TEST allowlist'};
   if(!this.cfg.graphApiVersion||!this.cfg.accessToken||!this.cfg.phoneNumberId) return {messageId:'',status:'FAILED',errorCode:'CONFIG_MISSING',errorReason:'Meta credentials are incomplete'};
   try{
     const components=input.variables.length?[{type:'body',parameters:input.variables.map(text=>({type:'text',text}))}]:[];
     const r=await axios.post(`${this.base()}/${this.cfg.phoneNumberId}/messages`,{messaging_product:'whatsapp',to:input.to,type:'template',template:{name:input.templateName,language:{code:input.language},components}},{headers:this.headers()});
     return {messageId:r.data.messages?.[0]?.id??'',status:'SENT'};
   }catch(e:any){return {messageId:'',status:'FAILED',errorCode:String(e.response?.data?.error?.code??'META_ERROR'),errorReason:metaError(e)};}
 }
 /** Real check: asks Meta for the phone number's details using the saved token. */
 async validateConfiguration():Promise<ValidationResult>{
   const missing=[['API version',this.cfg.graphApiVersion],['Access token',this.cfg.accessToken],['Phone number ID',this.cfg.phoneNumberId],['WhatsApp Business Account ID',this.cfg.wabaId]].filter(([,v])=>!v).map(([k])=>k);
   if(missing.length)return {ok:false,message:`Missing: ${missing.join(', ')}`};
   try{const r=await axios.get(`${this.base()}/${this.cfg.phoneNumberId}`,{params:{fields:'display_phone_number,verified_name,quality_rating'},headers:this.headers(),timeout:15000});
     return {ok:true,message:'Connected to WhatsApp.',phone:{displayPhoneNumber:r.data.display_phone_number,verifiedName:r.data.verified_name,qualityRating:r.data.quality_rating}};}
   catch(e){return {ok:false,message:`Meta rejected the connection: ${metaError(e)}`};}
 }
 async listTemplates():Promise<MetaTemplate[]>{
   const out:MetaTemplate[]=[];let url:string|undefined=`${this.base()}/${this.cfg.wabaId}/message_templates`;let params:any={fields:'name,language,status,category',limit:200};
   for(let page=0;url&&page<10;page++){const r:any=await axios.get(url,{params,headers:this.headers(),timeout:15000});out.push(...(r.data.data??[]));url=r.data.paging?.next;params=undefined;}
   return out;
 }
 verifyWebhookSignature(rawBody:Buffer,signature?:string){
   if(!this.cfg.appSecret||!signature?.startsWith('sha256=')) return false;
   const expected='sha256='+crypto.createHmac('sha256',this.cfg.appSecret).update(rawBody).digest('hex');
   const a=Buffer.from(expected),b=Buffer.from(signature);
   return a.length===b.length && crypto.timingSafeEqual(a,b);
 }
}
export async function provider():Promise<WhatsAppProvider>{const cfg=await getWhatsAppConfig();return cfg.mode==='MOCK'?new MockWhatsAppProvider():new MetaWhatsAppProvider(cfg);}
/** A Meta provider built from the saved settings even while the app is in MOCK mode, so the connection can be tested first. */
export async function metaProvider(){return new MetaWhatsAppProvider(await getWhatsAppConfig());}
