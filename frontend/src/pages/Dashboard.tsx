import {useState} from 'react';import {useQuery,useQueryClient} from '@tanstack/react-query';import {api} from '../lib/api';import {useI18n,eventLabel,statusLabel,dayLabel,apiError} from '../lib/i18n';import {PreviewModal} from '../components/MessagePreview';import type {Me} from '../App';
function Bar({value,max,label}:{value:number,max:number,label:string}){const pct=max?Math.max(4,Math.round(value/max*100)):4;return <div className="flex items-center gap-3 text-xs"><div className="w-16 muted">{label}</div><div className="h-2 bg-slate-100 rounded-full flex-1 overflow-hidden"><div className="h-full bg-blue-600 rounded-full" style={{width:`${pct}%`}}/></div><div className="w-8 text-end font-semibold">{value}</div></div>}
export default function Dashboard(){
  const {t}=useI18n();
  const {data}=useQuery({queryKey:['dashboard'],queryFn:()=>api.get('/dashboard').then(r=>r.data)});
  const cards=data?.cards??{};
  const labels=[['todaysBirthdays',"Today's Birthdays"],['todaysAnniversaries',"Today's Anniversaries"],['upcomingCelebrations','Next 30 days'],['scheduledToday','Scheduled Today'],['sentToday','Sent Today'],['delivered','Delivered'],['read','Read'],['failed','Failed']];
  const monthly=data?.charts?.monthly??[];const max=Math.max(1,...monthly.map((x:any)=>x.count));
  return <>
    <h1 className="text-2xl font-bold">{t('Dashboard')}</h1><p className="muted mt-1 mb-6">{t('Daily employee celebration operations')}</p>
    <div className="grid grid-cols-4 gap-4 mb-6">{labels.map(([k,l])=><div className="card p-5" key={k}><div className="muted text-sm">{t(l)}</div><div className="text-3xl font-bold mt-2">{cards[k]??0}</div></div>)}</div>
    <div className="card p-5 mb-6"><div className="font-semibold text-lg mb-4">{t("Today's Celebrations")}</div>
      {(data?.today??[]).length===0?<div className="muted text-sm">{t('No celebrations today.')}</div>:
      <table><thead><tr><th>{t('Employee')}</th><th>{t('Event')}</th><th>{t('Years')}</th><th>{t('Department')}</th><th>{t('Language')}</th><th>{t('Scheduled Time')}</th><th>{t('Status')}</th></tr></thead><tbody>{data.today.map((x:any)=><tr key={x.id}><td>{x.employee}</td><td>{eventLabel(t,x.event)}</td><td>{x.years??'—'}</td><td>{x.department??'—'}</td><td>{x.language}</td><td>{x.scheduledTime}</td><td><span className="badge">{statusLabel(t,x.deliveryStatus)}</span></td></tr>)}</tbody></table>}
    </div>
    <Upcoming rows={data?.upcoming??[]}/>
    <div className="grid grid-cols-3 gap-4 mt-6">
      <div className="card p-5"><b>{t('Messages sent by month')}</b><div className="space-y-3 mt-4">{monthly.length===0?<div className="muted text-sm">{t('No messages yet.')}</div>:monthly.slice(-6).map((x:any)=><Bar key={x.month} value={x.count} max={max} label={x.month}/>)}</div></div>
      <div className="card p-5"><b>{t('Birthdays vs anniversaries')}</b><div className="mt-5 text-3xl font-bold">{data?.charts?.eventMix?.birthdays??0} / {data?.charts?.eventMix?.anniversaries??0}</div><p className="muted text-sm mt-2">{t('Birthday / anniversary messages, last 12 months')}</p></div>
      <div className="card p-5"><b>{t('Delivery success rate')}</b><div className="mt-5 text-4xl font-bold">{data?.charts?.successRate??100}%</div><p className="muted text-sm mt-2">{t('Sent, delivered or read vs failed')}</p></div>
    </div>
  </>;
}

function Upcoming({rows}:{rows:any[]}){
  const i18n=useI18n();const {t,fmtDate}=i18n;const qc=useQueryClient();
  const me=qc.getQueryData<Me>(['me']);const canEdit=me?.role!=='VIEWER';
  const {data:templates=[]}=useQuery({queryKey:['templates'],queryFn:()=>api.get('/templates').then(r=>r.data)});
  const [preview,setPreview]=useState<any>(null),[err,setErr]=useState(''),[busyKey,setBusyKey]=useState('');
  const keyOf=(x:any)=>`${x.employeeId}|${x.eventType}|${x.eventDate}`;
  async function plan(x:any,action:'skip'|'unskip'|'template',templateId?:string|null){setErr('');setBusyKey(keyOf(x));try{await api.post('/celebrations/plan',{employeeId:x.employeeId,eventType:x.eventType,eventDate:x.eventDate,action,templateId});await qc.invalidateQueries({queryKey:['dashboard']});}catch(e:any){setErr(apiError(t,e,'Could not save the change'))}finally{setBusyKey('')}}
  return <div className="card p-5">
    <div className="flex justify-between items-baseline mb-1"><div className="font-semibold text-lg">{t('Coming up — next 30 days')}</div><div className="muted text-xs">{t('Skip a message or choose a specific template ahead of time.')}</div></div>
    {err&&<div className="my-2 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{err}</div>}
    {rows.length===0?<div className="muted text-sm mt-3">{t('No birthdays or work anniversaries in the next 30 days.')}</div>:
    <table className="mt-2"><thead><tr><th>{t('When')}</th><th>{t('Employee')}</th><th>{t('Celebration')}</th><th>{t('Message')}</th>{canEdit&&<th>{t('Actions')}</th>}</tr></thead><tbody>
      {rows.map(x=>{const skipped=x.status==='CANCELLED';const options=templates.filter((tp:any)=>tp.isActive&&tp.eventType===x.eventType);return <tr key={keyOf(x)} className={skipped?'opacity-60':''}>
        <td className="whitespace-nowrap"><b>{dayLabel(i18n,x.daysAway,x.eventDate)}</b><div className="muted text-xs">{fmtDate(x.eventDate)}</div></td>
        <td><div className="font-semibold">{x.fullName}</div><div className="muted text-xs">{x.department??x.employeeCode}</div></td>
        <td>{eventLabel(t,x.eventType)}{x.yearsOfService!=null&&<span className="muted"> · {(x.yearsOfService===1?t('1 year'):t('{n} years',{n:x.yearsOfService}))}</span>}</td>
        <td>{skipped?<span className="badge">{t('Skipped')}</span>:<button className="text-blue-600 text-sm hover:underline" onClick={()=>setPreview(x)}>{t('Preview')}</button>}</td>
        {canEdit&&<td className="whitespace-nowrap"><div className="flex gap-2 items-center">
          {!skipped&&<select className="input py-1 w-48" disabled={busyKey===keyOf(x)} value={x.templateId??''} onChange={e=>plan(x,'template',e.target.value||null)}><option value="">{t('Automatic template')}</option>{options.map((tp:any)=><option key={tp.id} value={tp.id}>{tp.internalName}</option>)}</select>}
          <button className="btn py-1" disabled={busyKey===keyOf(x)} onClick={()=>plan(x,skipped?'unskip':'skip')}>{skipped?t('Undo skip'):t('Skip')}</button>
        </div></td>}
      </tr>;})}
    </tbody></table>}
    {preview&&<PreviewModal title={`${preview.fullName} · ${eventLabel(t,preview.eventType)}`} target={{employeeId:preview.employeeId,eventType:preview.eventType,yearsOfService:preview.yearsOfService,templateId:preview.templateId}} close={()=>setPreview(null)}/>}
  </div>;
}
