import {useEffect,useState} from 'react';import {useQuery} from '@tanstack/react-query';import {api} from '../lib/api';import {useI18n,apiError} from '../lib/i18n';
const CHECKLIST_LABELS:Record<string,string>={credentials:'Access token',phoneNumberId:'Phone number ID',waba:'WhatsApp Business account',templates:'Active templates',webhook:'Webhook',timezone:'Timezone',testPassed:'Test message passed',backupConfigured:'Database backup'};
export default function AdminSettings(){
  const {t}=useI18n();
  const {data,refetch}=useQuery({queryKey:['admin-settings'],queryFn:()=>api.get('/admin-settings').then(r=>r.data)});
  const {data:alerts}=useQuery({queryKey:['alerts'],queryFn:()=>api.get('/dashboard/alerts').then(r=>r.data)});
  const [form,setForm]=useState<any>({}),[msg,setMsg]=useState(''),[phrase,setPhrase]=useState(''),[checklist,setChecklist]=useState<any>(null);
  useEffect(()=>{if(data)setForm(data)},[data]);
  const set=(k:string,v:any)=>setForm((x:any)=>({...x,[k]:v}));
  async function save(){try{await api.put('/admin-settings',form);setMsg(t('Settings saved.'));refetch()}catch(e:any){setMsg(apiError(t,e,'Save failed'))}}
  async function loadChecklist(){const r=await api.get('/settings/production-checklist');setChecklist(r.data)}
  async function activate(){try{const r=await api.post('/settings/activate-production',{confirmation:phrase});setMsg(t(r.data.note??'Production activation approved.'))}catch(e:any){setMsg(apiError(t,e,'Activation failed'))}}
  return <>
    <h1 className="text-2xl font-bold">{t('Admin Settings')}</h1><p className="muted mt-1 mb-6">{t('Operational controls are stored server-side and audited.')}</p>
    <div className="card p-6 grid grid-cols-2 gap-5">
      <Field label={t('Send Policy')}><select className="input" value={form.sendPolicy??'AUTO'} onChange={e=>set('sendPolicy',e.target.value)}><option value="AUTO">{t('Automatic — send without approval')}</option><option value="REVIEW">{t('Review — approve each message first')}</option></select></Field>
      <Field label={t('Inbound Message Policy')}><select className="input" value={form.inboundMode??'STORE_ONLY'} onChange={e=>set('inboundMode',e.target.value)}><option value="STORE_ONLY">{t('Store replies only')}</option><option value="ROUTE_TO_CORPORATE_INBOX">{t('Route to corporate inbox')}</option><option value="AUTO_ACKNOWLEDGE">{t('Auto-acknowledge')}</option><option value="DISABLED">{t('Ignore replies')}</option></select></Field>
      <Field label={t('Daily Send Time')}><input className="input" type="time" value={form.dailySendTime??'09:00'} onChange={e=>set('dailySendTime',e.target.value)}/></Field>
      <Field label={t('Timezone')}><input className="input" dir="ltr" value={form.timezone??'Asia/Dubai'} onChange={e=>set('timezone',e.target.value)}/></Field>
      <Field label={t('Leap Day Policy')}><select className="input" value={form.leapDayPolicy??'FEB_28'} onChange={e=>set('leapDayPolicy',e.target.value)}><option value="FEB_28">{t('Celebrate on Feb 28 in non-leap years')}</option><option value="MAR_01">{t('Celebrate on Mar 1 in non-leap years')}</option></select></Field>
      <Field label={t('Wait after adding/importing an employee (minutes)')}><input className="input" type="number" min="0" value={form.minimumImportAgeMinutes??30} onChange={e=>set('minimumImportAgeMinutes',Number(e.target.value))}/><div className="muted text-xs mt-1">{t('Gives time to fix mistakes before the first message goes out.')}</div></Field>
      <label className="flex gap-3 items-center"><input type="checkbox" checked={Boolean(form.databaseBackupConfigured)} onChange={e=>set('databaseBackupConfigured',e.target.checked)}/><span><b>{t('Database backup configured')}</b><div className="muted text-xs">{t('Required before production activation.')}</div></span></label>
      <div><button className="btn btn-primary" onClick={save}>{t('Save Settings')}</button></div>
    </div>
    <div className="card p-6 mt-5"><b>{t('Failure alerts')}</b><p className="muted text-sm mt-1">{alerts?.emailConfigured?t('Email alerts are on. Failed messages and token problems are emailed to the address in ALERT_EMAIL_TO.'):t('Email alerts are off. Set SMTP_HOST, SMTP_USER, SMTP_PASS and ALERT_EMAIL_TO in the server configuration to receive failure emails. Alerts always appear as a red banner in the dashboard.')}</p></div>
    <div className="card p-6 mt-5">
      <div className="flex justify-between items-center"><div><b>{t('Production Activation')}</b><p className="muted text-sm mt-1">{t('This is intentionally not a simple toggle.')}</p></div><button className="btn" onClick={loadChecklist}>{t('Refresh Checklist')}</button></div>
      {checklist&&<div className="grid grid-cols-4 gap-3 mt-4">{Object.entries(checklist).map(([k,v])=><div key={k} className="border rounded-lg p-3 text-sm"><div className="muted">{t(CHECKLIST_LABELS[k]??k)}</div><b className={v?'text-green-700':'text-red-700'}>{v?t('Ready'):t('Missing')}</b></div>)}</div>}
      <div className="mt-5"><label className="text-sm font-semibold">{t('Type ACTIVATE PRODUCTION')}</label><input className="input mt-1 max-w-md" dir="ltr" value={phrase} onChange={e=>setPhrase(e.target.value)}/><button className="btn btn-primary mt-3 block" onClick={activate}>{t('Activate Production Readiness')}</button></div>
    </div>
    {msg&&<div className="mt-4 text-sm">{msg}</div>}
  </>;
}
function Field({label,children}:{label:string,children:React.ReactNode}){return <label><div className="text-sm font-semibold mb-1">{label}</div>{children}</label>}
