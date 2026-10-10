import {useState} from 'react';import {useQuery,useQueryClient} from '@tanstack/react-query';import {api} from '../lib/api';import {useI18n,eventLabel,apiError} from '../lib/i18n';import type {Me} from '../App';
const VARIABLES=['firstName','lastName','fullName','yearsOfService'];
const SAMPLE:Record<string,string>={firstName:'Aysha',lastName:'Ali',fullName:'Aysha Ali',yearsOfService:'5'};
const VAR_LABELS:Record<string,string>={firstName:'First name',lastName:'Last name',fullName:'Full name',yearsOfService:'Years of service'};
function render(body:string|null|undefined,vars:string[]){return body?body.replace(/\{\{(\d+)\}\}/g,(m,i)=>SAMPLE[vars[Number(i)-1]]??m):null;}

export default function Templates(){
  const {t}=useI18n();const qc=useQueryClient();const me=qc.getQueryData<Me>(['me']);const canEdit=me?.role==='SUPER_ADMIN'||me?.role==='COMMUNICATIONS_ADMIN';
  const {data=[]}=useQuery({queryKey:['templates'],queryFn:()=>api.get('/templates').then(r=>r.data)});
  const [editing,setEditing]=useState<any>(null);
  return <>
    <div className="flex justify-between items-end mb-6 gap-4"><div><h1 className="text-2xl font-bold">{t('Message Templates')}</h1><p className="muted mt-1 max-w-3xl">{t('Each template points to a template approved in Meta WhatsApp Manager. The preview text is for your reference only; it must match the approved Meta template, because WhatsApp sends the approved version.')}</p></div>{canEdit&&<button className="btn btn-primary whitespace-nowrap" onClick={()=>setEditing({})}>{t('+ Add template')}</button>}</div>
    <div className="grid grid-cols-2 gap-4">{data.map((tp:any)=>{const vars=Array.isArray(tp.variables)?tp.variables:[];const text=render(tp.bodyText,vars);return <div className="card p-5" key={tp.id}>
      <div className="flex justify-between gap-3"><b>{tp.internalName}</b><span className="badge">{tp.isActive?t('Active'):t('Inactive')}</span></div>
      <div className="mt-3 text-sm space-y-1"><div><span className="muted">{t('Event')}:</span> {eventLabel(t,tp.eventType)} · {tp.language}</div><div><span className="muted">{t('Meta template')}:</span> {tp.metaTemplateName} ({tp.metaTemplateLanguage})</div><div><span className="muted">{t('Variables')}:</span> {vars.map((v:string,i:number)=>`{{${i+1}}} = ${t(VAR_LABELS[v]??v)}`).join(', ')||'—'}</div></div>
      <div className="mt-4"><div className="muted text-xs mb-1">{t('Preview with sample values')}</div><div className="rounded-2xl bg-[#dcf8c6] text-slate-900 px-4 py-3 text-sm whitespace-pre-wrap" dir="auto">{text??<span className="italic text-slate-600">{t('No preview text yet.')}</span>}</div></div>
      {canEdit&&<button className="btn mt-4" onClick={()=>setEditing(tp)}>{t('Edit')}</button>}
    </div>;})}</div>
    {editing&&<TemplateForm template={editing} close={()=>setEditing(null)}/>}
  </>;
}

function TemplateForm({template,close}:{template:any,close:()=>void}){
  const {t}=useI18n();const qc=useQueryClient();const isNew=!template.id;
  const [f,setF]=useState({internalName:template.internalName??'',metaTemplateName:template.metaTemplateName??'',metaTemplateLanguage:template.metaTemplateLanguage??'en',eventType:template.eventType??'BIRTHDAY',language:template.language??'EN',bodyText:template.bodyText??'',isActive:template.isActive??true});
  const [vars,setVars]=useState<string[]>(Array.isArray(template.variables)?template.variables:['firstName']);
  const [err,setErr]=useState(''),[busy,setBusy]=useState(false);
  const set=(k:string,v:any)=>setF(x=>({...x,[k]:v}));
  const setVar=(i:number,v:string)=>setVars(xs=>{const next=[...xs];if(v)next[i]=v;else next.splice(i);return next;});
  async function save(e:React.FormEvent){e.preventDefault();setErr('');setBusy(true);try{const body={...f,variables:vars,bodyText:f.bodyText||null};if(isNew)await api.post('/templates',body);else await api.patch(`/templates/${template.id}`,body);await qc.invalidateQueries({queryKey:['templates']});close();}catch(e:any){setErr(apiError(t,e,'Could not save template'))}finally{setBusy(false)}}
  const field=(label:string,k:string,props:any={})=><label className="block"><span className="muted text-xs">{t(label)}</span><input className="input mt-1" value={(f as any)[k]} onChange={e=>set(k,e.target.value)} {...props}/></label>;
  return <div className="fixed inset-0 bg-black/20 z-50" onClick={close}><form onSubmit={save} className="absolute end-0 top-0 h-full w-[480px] max-w-full overflow-y-auto bg-white dark:bg-slate-900 p-7 shadow-2xl space-y-4" onClick={e=>e.stopPropagation()}>
    <div className="flex justify-between items-center"><h2 className="text-xl font-bold">{isNew?t('Add template'):t('Edit template')}</h2><button type="button" className="btn" onClick={close}>{t('Close')}</button></div>
    {field('Internal name','internalName',{required:true,placeholder:'birthday_greeting_en'})}
    {field('Meta template name (exactly as approved in Meta)','metaTemplateName',{required:true})}
    <div className="grid grid-cols-3 gap-3">
      <label className="block"><span className="muted text-xs">{t('Event')}</span><select className="input mt-1" value={f.eventType} onChange={e=>set('eventType',e.target.value)}><option value="BIRTHDAY">{t('Birthday')}</option><option value="WORK_ANNIVERSARY">{t('Work anniversary')}</option></select></label>
      <label className="block"><span className="muted text-xs">{t('For employees whose language is')}</span><select className="input mt-1" value={f.language} onChange={e=>set('language',e.target.value)}><option value="EN">{t('English')}</option><option value="AR">{t('Arabic')}</option></select></label>
      {field('Meta language code','metaTemplateLanguage',{required:true,placeholder:'en'})}
    </div>
    <div><span className="muted text-xs">{t('Variables, in the order used by the Meta template')}</span><div className="space-y-2 mt-1">{[0,1,2].filter(i=>i<=vars.length).map(i=><div key={i} className="flex items-center gap-2"><span className="w-12 font-mono text-sm">{`{{${i+1}}}`}</span><select className="input" value={vars[i]??''} onChange={e=>setVar(i,e.target.value)}><option value="">{t('(none)')}</option>{VARIABLES.map(v=><option key={v} value={v}>{t(VAR_LABELS[v])}</option>)}</select></div>)}</div></div>
    <label className="block"><span className="muted text-xs">{t('Message text (copy of the approved Meta template, for preview)')}</span><textarea className="input mt-1 min-h-28" dir="auto" value={f.bodyText} onChange={e=>set('bodyText',e.target.value)} placeholder="Happy birthday, {{1}}! 🎉"/></label>
    <div><div className="muted text-xs mb-1">{t('Preview with sample values')}</div><div className="rounded-2xl bg-[#dcf8c6] text-slate-900 px-4 py-3 text-sm whitespace-pre-wrap min-h-10" dir="auto">{render(f.bodyText,vars)??''}</div></div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isActive} onChange={e=>set('isActive',e.target.checked)}/>{t('Active (used for sending)')}</label>
    <p className="muted text-xs">{t('Tip: for 1, 5, 10, 15 and 20-year anniversaries, a template whose internal name contains "milestone" is used automatically.')}</p>
    {err&&<div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{err}</div>}
    <button className="btn btn-primary w-full" disabled={busy}>{busy?t('Saving…'):t('Save template')}</button>
  </form></div>;
}
