import {useQuery,useQueryClient} from '@tanstack/react-query';import {useEffect,useState} from 'react';import {api} from '../lib/api';import {useI18n,apiError} from '../lib/i18n';import type {Me} from '../App';

type Source={source:'dashboard'|'env'|'none'|'unreadable';value?:string;hint?:string};
const PLAIN=[
  ['graphApiVersion','API version','v23.0','Meta App Dashboard → App settings → Advanced → API version (e.g. v23.0).'],
  ['phoneNumberId','Phone number ID','123456789012345','WhatsApp Manager / App Dashboard → WhatsApp → API Setup → "Phone number ID" (not the phone number itself).'],
  ['wabaId','WhatsApp Business Account ID','123456789012345','Same API Setup page → "WhatsApp Business Account ID".'],
] as const;
const SECRET=[
  ['accessToken','Access token','Business settings → Users → System users → Generate token (choose "Never expire", with whatsapp_business_messaging and whatsapp_business_management). Temporary tokens from API Setup expire within a day.'],
  ['appSecret','App secret','Meta App Dashboard → App settings → Basic → App secret. Used to confirm webhook calls really come from Meta.'],
  ['webhookVerifyToken','Webhook verify token','Any password-like text you choose. Enter the same value in Meta when you set up the webhook.'],
] as const;
const MODE_LABELS:Record<string,string>={MOCK:'Simulation — no real messages',META_TEST:'Test — only to approved test numbers',META_PRODUCTION:'Live — real messages to employees'};
const STATUS_STYLE:Record<string,string>={APPROVED:'bg-green-100 text-green-800',PENDING:'bg-amber-100 text-amber-800',IN_APPEAL:'bg-amber-100 text-amber-800',REJECTED:'bg-red-100 text-red-800',PAUSED:'bg-red-100 text-red-800',DISABLED:'bg-red-100 text-red-800',NOT_FOUND:'bg-red-100 text-red-800'};
const STATUS_LABELS:Record<string,string>={APPROVED:'Approved',PENDING:'Pending review',REJECTED:'Rejected',PAUSED:'Paused',DISABLED:'Disabled',IN_APPEAL:'In appeal',NOT_FOUND:'Not found in Meta'};

export default function WhatsApp(){
  const {t}=useI18n();const qc=useQueryClient();const me=qc.getQueryData<Me>(['me']);
  const isAdmin=me?.role==='SUPER_ADMIN';const canComms=isAdmin||me?.role==='COMMUNICATIONS_ADMIN';
  const {data,refetch}=useQuery({queryKey:['wa-settings'],queryFn:()=>api.get('/settings/whatsapp').then(r=>r.data)});
  return <>
    <h1 className="text-2xl font-bold">{t('WhatsApp Configuration')}</h1>
    <p className="muted mt-1 mb-6">{t('Connect the WhatsApp Business number used to send celebration messages.')}</p>
    <StatusCard data={data}/>
    {isAdmin&&data?.connection&&<ConnectCard data={data} refetch={refetch}/>}
    {isAdmin&&<WebhookCard data={data}/>}
    {canComms&&<TemplateCheckCard/>}
    {canComms&&<TestMessageCard mode={data?.mode}/>}
    {isAdmin&&<PreferencesCard data={data} refetch={refetch}/>}
    <div className="card p-5 mt-5 text-sm"><b>{t('Display-name privacy notice')}</b><p className="mt-2 muted">{data?.notice?t(data.notice):''}</p></div>
  </>;
}

function StatusCard({data}:{data:any}){
  const {t}=useI18n();const mode=data?.mode??'MOCK';
  const tone=mode==='META_PRODUCTION'?'border-green-300 bg-green-50 text-green-900':mode==='META_TEST'?'border-blue-300 bg-blue-50 text-blue-900':'border-amber-300 bg-amber-50 text-amber-900';
  return <div className={`rounded-xl border px-5 py-4 mb-5 ${tone}`}>
    <div className="text-xs uppercase tracking-wide opacity-70">{t('Current mode')}</div>
    <div className="text-lg font-bold mt-1">{t(MODE_LABELS[mode]??mode)}</div>
    <div className="text-sm mt-1 opacity-80">{t('Phone number ID')}: <span dir="ltr">{data?.phoneNumberId?t(data.phoneNumberId):'—'}</span> · {t('Webhook')}: {data?.webhookConfigured?t('Configured'):t('Not configured')}</div>
  </div>;
}

function ConnectCard({data,refetch}:{data:any,refetch:()=>void}){
  const {t}=useI18n();const qc=useQueryClient();const c=data.connection as Record<string,Source>&{mode:{source:string;value:string}};
  const [f,setF]=useState<Record<string,string>>({});const [mode,setMode]=useState<string>(data.mode);
  const [msg,setMsg]=useState<{ok:boolean;text:string}|null>(null),[busy,setBusy]=useState(false),[check,setCheck]=useState<any>(null),[confirmReset,setConfirmReset]=useState(false);
  const refreshMode=()=>qc.invalidateQueries({queryKey:['health']});
  useEffect(()=>{setF(Object.fromEntries(PLAIN.map(([k])=>[k,c[k]?.source==='dashboard'?c[k].value??'':''])));setMode(data.mode);},[data]);
  const set=(k:string,v:string)=>setF(x=>({...x,[k]:v}));
  async function save(){setBusy(true);setMsg(null);setCheck(null);try{const body:any={...f};if(mode!=='META_PRODUCTION')body.mode=mode;await api.put('/settings/whatsapp/connection',body);setF(x=>({...x,accessToken:'',appSecret:'',webhookVerifyToken:''}));await refetch();refreshMode();setMsg({ok:true,text:t('Saved.')});}catch(e:any){setMsg({ok:false,text:apiError(t,e,'Save failed')})}finally{setBusy(false)}}
  async function test(){setBusy(true);setCheck(null);try{setCheck((await api.post('/settings/whatsapp/validate')).data)}catch(e:any){setCheck({ok:false,message:apiError(t,e,'Validation failed')})}finally{setBusy(false)}}
  async function reset(){setConfirmReset(false);setBusy(true);try{await api.delete('/settings/whatsapp/connection');await refetch();refreshMode();setMsg({ok:true,text:t('Dashboard settings removed; the server .env values are used.')})}finally{setBusy(false)}}
  function generateToken(){const a=new Uint8Array(24);crypto.getRandomValues(a);set('webhookVerifyToken',Array.from(a,b=>b.toString(16).padStart(2,'0')).join(''));}
  const sourceLabel=(s?:Source)=>!s||s.source==='none'?t('Not set'):s.source==='dashboard'?t('Saved here'):s.source==='env'?t('From server .env file'):t('Saved value can no longer be read — enter it again');
  return <div className="card p-6 mb-5">
    <div className="flex justify-between items-start gap-4"><div><b className="text-lg">{t('Connect WhatsApp')}</b><p className="muted text-sm mt-1 max-w-3xl">{t('Copy these values from your Meta (Facebook) developer account. Secret values are stored encrypted and are never shown again — leave a secret empty to keep the saved one.')}</p></div></div>
    <div className="grid grid-cols-2 gap-5 mt-5">
      {PLAIN.map(([k,label,ph,help])=><label key={k} className="block"><div className="flex justify-between gap-2"><span className="text-sm font-semibold">{t(label)}</span><span className="muted text-xs">{sourceLabel(c[k])}{c[k]?.source==='env'&&c[k].value?`: ${c[k].value}`:''}</span></div><input className="input mt-1" dir="ltr" placeholder={ph} value={f[k]??''} onChange={e=>set(k,e.target.value)}/><div className="muted text-xs mt-1">{t(help)}</div></label>)}
      {SECRET.map(([k,label,help])=><label key={k} className="block"><div className="flex justify-between gap-2"><span className="text-sm font-semibold">{t(label)}</span><span className="muted text-xs">{sourceLabel(c[k])}{c[k]?.hint?` (${t('ends with')} ${c[k].hint})`:''}</span></div>
        <div className="flex gap-2 mt-1"><input className="input" dir="ltr" type={k==='webhookVerifyToken'?'text':'password'} autoComplete="off" placeholder={c[k]?.source!=='none'?t('Leave empty to keep the saved value'):''} value={f[k]??''} onChange={e=>set(k,e.target.value)}/>{k==='webhookVerifyToken'&&<button type="button" className="btn whitespace-nowrap" onClick={generateToken}>{t('Generate')}</button>}</div>
        <div className="muted text-xs mt-1">{t(help)}</div></label>)}
    </div>
    <div className="mt-6"><div className="text-sm font-semibold mb-2">{t('Sending mode')}</div>
      <div className="flex flex-wrap gap-3">{['MOCK','META_TEST'].map(m=><label key={m} className={`flex items-center gap-2 border rounded-lg px-3 py-2 text-sm cursor-pointer ${mode===m?'border-blue-500 bg-blue-50 dark:bg-slate-800':'border-slate-200'}`}><input type="radio" checked={mode===m} onChange={()=>setMode(m)}/>{t(MODE_LABELS[m])}</label>)}
        {data.mode==='META_PRODUCTION'&&<label className={`flex items-center gap-2 border rounded-lg px-3 py-2 text-sm cursor-pointer ${mode==='META_PRODUCTION'?'border-green-500 bg-green-50 dark:bg-slate-800':'border-slate-200'}`}><input type="radio" checked={mode==='META_PRODUCTION'} onChange={()=>setMode('META_PRODUCTION')}/>{t(MODE_LABELS.META_PRODUCTION)}</label>}</div>
      <div className="muted text-xs mt-2">{t('Live mode is switched on from Admin Settings → Production Activation, after the checklist passes.')}</div>
    </div>
    <div className="flex flex-wrap gap-2 mt-6"><button className="btn btn-primary" disabled={busy} onClick={save}>{busy?t('Saving…'):t('Save connection')}</button><button className="btn" disabled={busy} onClick={test}>{t('Test connection')}</button>{Object.values(c).some((x:any)=>x?.source==='dashboard')&&(confirmReset?<><button className="btn !text-red-700" disabled={busy} onClick={reset}>{t('Yes, remove them')}</button><button className="btn" onClick={()=>setConfirmReset(false)}>{t('Cancel')}</button></>:<button className="btn" disabled={busy} onClick={()=>setConfirmReset(true)}>{t('Remove dashboard settings')}</button>)}</div>
    {msg&&<div className={`mt-4 text-sm ${msg.ok?'text-green-700':'text-red-700'}`}>{msg.text}</div>}
    {check&&<div className={`mt-4 rounded-lg border p-4 text-sm ${check.ok?'border-green-300 bg-green-50 text-green-900':'border-red-300 bg-red-50 text-red-900'}`}><b>{check.ok?t('Connected to WhatsApp.'):t('Not connected')}</b>{check.phone?<div className="mt-1">{t('Number')}: <span dir="ltr">{check.phone.displayPhoneNumber}</span> · {t('Name')}: {check.phone.verifiedName}{check.phone.qualityRating?` · ${t('Quality')}: ${check.phone.qualityRating}`:''}</div>:<div className="mt-1">{t(check.message)}</div>}</div>}
  </div>;
}

function WebhookCard({data}:{data:any}){
  const {t}=useI18n();
  const base=String(api.defaults.baseURL??'').replace(/\/$/,'');const url=`${base}/webhooks/meta/whatsapp`;const local=/localhost|127\.0\.0\.1/.test(url);
  const [copied,setCopied]=useState(false);
  async function copy(){try{await navigator.clipboard.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),1500)}catch{}}
  return <div className="card p-6 mb-5"><b className="text-lg">{t('Webhook (delivery receipts and replies)')}</b>
    <p className="muted text-sm mt-1">{t('In the Meta App Dashboard → WhatsApp → Configuration → Webhook, enter the callback URL and the verify token you saved above, then subscribe to the "messages" field.')}</p>
    <div className="mt-4 text-sm font-semibold">{t('Callback URL')}</div>
    <div className="flex gap-2 mt-1"><input className="input font-mono text-sm" dir="ltr" readOnly value={url}/><button className="btn" onClick={copy}>{copied?t('Copied'):t('Copy')}</button></div>
    {local&&<div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-sm px-3 py-2">{t('This is a local address, which Meta cannot reach. Sending works from here, but delivery receipts and replies start working once the app is hosted on a public HTTPS address.')}</div>}
    <div className="mt-3 text-sm">{t('Status')}: <b>{data?.webhookConfigured?t('Verify token and app secret are set'):t('Verify token or app secret missing')}</b></div>
  </div>;
}

function TemplateCheckCard(){
  const {t}=useI18n();const [rows,setRows]=useState<any[]|null>(null),[err,setErr]=useState(''),[busy,setBusy]=useState(false);
  async function run(){setBusy(true);setErr('');try{setRows((await api.get('/settings/whatsapp/templates-check')).data)}catch(e:any){setRows(null);setErr(apiError(t,e,'Check failed'))}finally{setBusy(false)}}
  return <div className="card p-6 mb-5"><div className="flex justify-between items-start gap-4"><div><b className="text-lg">{t('Template approval check')}</b><p className="muted text-sm mt-1">{t('Compares the active templates in this app with the templates Meta has approved for your account. Messages only send with approved templates whose name and language match exactly.')}</p></div><button className="btn whitespace-nowrap" disabled={busy} onClick={run}>{busy?t('Checking…'):t('Check templates with Meta')}</button></div>
    {err&&<div className="mt-4 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{err}</div>}
    {rows&&<table className="mt-4"><thead><tr><th>{t('Template')}</th><th>{t('Meta template')}</th><th>{t('Language')}</th><th>{t('Status')}</th><th>{t('Category')}</th></tr></thead><tbody>{rows.map(r=><tr key={r.internalName}><td>{r.internalName}</td><td dir="ltr" className="text-start">{r.metaTemplateName}</td><td>{r.language}</td><td><span className={`badge ${STATUS_STYLE[r.status]??''}`}>{t(STATUS_LABELS[r.status]??r.status)}</span>{r.otherLanguages?.length>0&&<div className="muted text-xs mt-1">{t('Exists in Meta with language: {list}',{list:r.otherLanguages.join(', ')})}</div>}</td><td>{r.category??'—'}</td></tr>)}</tbody></table>}
  </div>;
}

function TestMessageCard({mode}:{mode?:string}){
  const {t}=useI18n();
  const {data:templates=[]}=useQuery({queryKey:['templates'],queryFn:()=>api.get('/templates').then(r=>r.data)});
  const active=templates.filter((x:any)=>x.isActive);
  const [to,setTo]=useState(''),[tpl,setTpl]=useState(''),[result,setResult]=useState<{ok:boolean;text:string}|null>(null),[busy,setBusy]=useState(false);
  async function send(){const chosen=active.find((x:any)=>x.id===tpl)??active[0];if(!chosen)return;setBusy(true);setResult(null);
    const vars=(Array.isArray(chosen.variables)?chosen.variables:[]).map((v:string)=>v==='yearsOfService'?'5':'Test');
    try{const r=await api.post('/messages/test',{to,templateName:chosen.metaTemplateName,language:chosen.metaTemplateLanguage,variables:vars});setResult(r.data.status==='SENT'?{ok:true,text:t('Sent. Message ID: {id}',{id:r.data.messageId})}:{ok:false,text:r.data.errorReason??r.data.errorCode??t('Test failed')})}
    catch(e:any){setResult({ok:false,text:apiError(t,e,'Test failed')})}finally{setBusy(false)}}
  return <div className="card p-6 mb-5"><b className="text-lg">{t('Send Test Message')}</b>
    <p className="muted text-sm mt-1 mb-4">{mode==='MOCK'?t('In simulation mode nothing is really sent. Switch to Test mode to send a real message.'):mode==='META_TEST'?t('In Test mode the number must be on the test allowlist below.'):t('This sends a real WhatsApp message.')}</p>
    <div className="grid grid-cols-3 gap-3"><input className="input" dir="ltr" placeholder="+971..." value={to} onChange={e=>setTo(e.target.value)}/><select className="input" value={tpl} onChange={e=>setTpl(e.target.value)}>{active.map((x:any)=><option key={x.id} value={x.id}>{x.internalName}</option>)}</select><button className="btn btn-primary" disabled={busy||!to} onClick={send}>{busy?t('Sending…'):t('Send Test Message')}</button></div>
    {result&&<div className={`mt-4 text-sm ${result.ok?'text-green-700':'text-red-700'}`}>{t(result.text)}</div>}
  </div>;
}

function PreferencesCard({data,refetch}:{data:any,refetch:()=>void}){
  const {t}=useI18n();const [displayName,setDisplayName]=useState('Tareq'),[allowlist,setAllowlist]=useState(''),[msg,setMsg]=useState('');
  useEffect(()=>{if(data)setDisplayName(String(data.businessDisplayName??'Tareq'))},[data]);
  async function save(){try{const nums=allowlist.split(/[\n,]/).map(x=>x.trim()).filter(Boolean);await api.put('/settings/whatsapp/preferences',{businessDisplayName:displayName,testAllowedNumbers:nums});setMsg(t('Preferences saved.'));setAllowlist('');refetch()}catch(e:any){setMsg(apiError(t,e,'Save failed'))}}
  return <div className="card p-6 mb-5"><b className="text-lg">{t('Admin preferences')}</b>
    <div className="grid grid-cols-2 gap-4 mt-4">
      <div><label className="text-sm font-semibold">{t('Business Display Name')}</label><input className="input mt-1" value={displayName} onChange={e=>setDisplayName(e.target.value)}/></div>
      <div><label className="text-sm font-semibold">{t('Replace test recipient allowlist')}</label><textarea className="input mt-1 min-h-24" dir="ltr" placeholder={'+971500000001\n+971500000002'} value={allowlist} onChange={e=>setAllowlist(e.target.value)}/><div className="muted text-xs mt-1">{t('Current (masked):')} <span dir="ltr">{(data?.testAllowedNumbers??[]).join(', ')||t('None')}</span></div></div>
    </div>
    <button className="btn mt-3" onClick={save}>{t('Save preferences')}</button>{msg&&<span className="ms-3 text-sm">{msg}</span>}
  </div>;
}
