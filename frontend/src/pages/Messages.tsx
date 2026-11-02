import {useState} from 'react';import {useQuery,useQueryClient} from '@tanstack/react-query';import {useLocation} from 'react-router-dom';import {api} from '../lib/api';import {useI18n,eventLabel,statusLabel,dayLabel,apiError} from '../lib/i18n';import type {Me} from '../App';
export default function Messages(){
  const loc=useLocation();
  return loc.pathname.includes('pending')?<Scheduled/>:<History/>;
}

/** Every celebration message from today forward, built from the employees' current dates. */
function Scheduled(){
  const i18n=useI18n();const {t,fmtDate}=i18n;const qc=useQueryClient();const me=qc.getQueryData<Me>(['me']);const canAct=me?.role==='SUPER_ADMIN'||me?.role==='COMMUNICATIONS_ADMIN';
  const [days,setDays]=useState(30);
  const {data=[],isLoading}=useQuery({queryKey:['messages','scheduled',days],queryFn:()=>api.get('/messages/scheduled',{params:{days}}).then(r=>r.data),refetchInterval:60000});
  const [msg,setMsg]=useState('');
  async function act(path:string){setMsg('');try{await api.post(path);qc.invalidateQueries({queryKey:['messages']});}catch(e:any){setMsg(apiError(t,e,'Something went wrong'))}}
  return <>
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">{t('Scheduled Messages')}</h1><select className="input w-auto" value={days} onChange={e=>setDays(Number(e.target.value))}>{[7,30,90,365].map(n=><option key={n} value={n}>{t('Next {n} days',{n})}</option>)}</select></div>
    <p className="muted mt-1 mb-6">{t('Birthdays and work anniversaries are detected automatically and sent on the day. Changes to employee dates show up here straight away.')}</p>
    {msg&&<div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{msg}</div>}
    <div className="card overflow-auto"><table><thead><tr><th>{t('When')}</th><th>{t('Employee')}</th><th>{t('Event')}</th><th>{t('Template')}</th><th>{t('Status')}</th><th>{t('Error')}</th>{canAct&&<th>{t('Actions')}</th>}</tr></thead><tbody>
      {!isLoading&&data.length===0&&<tr><td colSpan={7} className="muted">{t('Nothing here.')}</td></tr>}
      {data.map((x:any)=><tr key={`${x.employeeId}-${x.eventType}-${x.eventDate}`}>
        <td className="whitespace-nowrap"><b>{dayLabel(i18n,x.daysAway,x.eventDate)}</b><div className="muted text-xs">{fmtDate(x.eventDate)}</div></td>
        <td>{x.fullName}<div className="muted text-xs">{x.employeeCode}</div></td><td>{eventLabel(t,x.eventType)}{x.yearsOfService?<div className="muted text-xs">{t('{n} year(s)',{n:x.yearsOfService})}</div>:null}</td>
        <td className="text-xs">{x.templateName??<span className="text-red-600">{t('No active template')}</span>}</td>
        <td><span className="badge">{statusLabel(t,x.status)}</span></td><td className="text-xs max-w-xs">{x.failureReason&&!["SENT","DELIVERED","READ"].includes(x.status)?t(x.failureReason):'—'}</td>
        {canAct&&<td className="whitespace-nowrap">{x.deliveryId&&x.status==='FAILED'&&<button className="btn py-1" onClick={()=>act(`/messages/${x.deliveryId}/retry`)}>{t('Retry')}</button>}{x.deliveryId&&x.status==='QUEUED'&&<button className="btn py-1" onClick={()=>act(`/messages/${x.deliveryId}/cancel`)}>{t('Cancel')}</button>}</td>}
      </tr>)}
    </tbody></table></div>
  </>;
}

function History(){
  const {t,fmtDate,fmtDateTime}=useI18n();const loc=useLocation(),qc=useQueryClient();const me=qc.getQueryData<Me>(['me']);const canAct=me?.role==='SUPER_ADMIN'||me?.role==='COMMUNICATIONS_ADMIN';
  const status=loc.pathname.includes('failed')?'FAILED':loc.pathname.includes('pending')?'QUEUED':undefined;
  const {data=[]}=useQuery({queryKey:['messages',status],queryFn:()=>api.get('/messages',{params:{status}}).then(r=>r.data)});
  const [msg,setMsg]=useState('');const [info,setInfo]=useState('');
  async function retryAll(){setMsg('');setInfo('');try{const {data:out}=await api.post('/messages/retry-failed-today');setInfo(t('{n} message(s) queued to send again.').replace('{n}',String(out.count)));qc.invalidateQueries({queryKey:['messages']});qc.invalidateQueries({queryKey:['alerts']});}catch(e:any){setMsg(apiError(t,e,'Something went wrong'))}}
  async function act(path:string){setMsg('');try{await api.post(path);qc.invalidateQueries({queryKey:['messages']});qc.invalidateQueries({queryKey:['alerts']});}catch(e:any){setMsg(apiError(t,e,'Something went wrong'))}}
  const title=status==='FAILED'?'Failed Messages':status==='QUEUED'?'Scheduled Messages':'Delivery History';
  const subtitle=status==='FAILED'?'Messages WhatsApp could not deliver. Temporary errors are retried automatically every 15 minutes, up to 3 times. Fix any other cause (e.g. a wrong number), then retry the same day.':status==='QUEUED'?'Messages waiting to be sent today.':'Every celebration message and its delivery status.';
  return <>
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">{t(title)}</h1>{canAct&&status==='FAILED'&&<button className="btn" onClick={retryAll}>{t('Retry all failed today')}</button>}</div><p className="muted mt-1 mb-6">{t(subtitle)}</p>
    {info&&<div className="mb-4 rounded-lg bg-green-50 text-green-700 text-sm px-3 py-2">{info}</div>}
    {msg&&<div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{msg}</div>}
    <div className="card overflow-auto"><table><thead><tr><th>{t('Employee')}</th><th>{t('Event')}</th><th>{t('Date')}</th><th>{t('Template')}</th><th>{t('Recipient')}</th><th>{t('Status')}</th><th>{t('Retries')}</th><th>{t('Error')}</th><th>{t('Last update')}</th>{canAct&&<th>{t('Actions')}</th>}</tr></thead><tbody>
      {data.length===0&&<tr><td colSpan={10} className="muted">{t('Nothing here.')}</td></tr>}
      {data.map((x:any)=><tr key={x.id}>
        <td>{x.employee.fullName}</td><td>{eventLabel(t,x.celebrationEvent.eventType)}</td><td className="whitespace-nowrap">{fmtDate(x.celebrationEvent.eventDate)}</td><td className="text-xs">{x.templateName}</td><td dir="ltr" className="text-start whitespace-nowrap">{x.recipientPhoneMasked}</td>
        <td><span className="badge">{statusLabel(t,x.status)}</span></td><td>{x.retryCount}</td><td className="text-xs max-w-xs">{x.failureReason&&!["SENT","DELIVERED","READ"].includes(x.status)?t(x.failureReason):'—'}</td><td className="whitespace-nowrap text-xs">{fmtDateTime(x.updatedAt)}</td>
        {canAct&&<td className="whitespace-nowrap">{x.status==='FAILED'&&<button className="btn py-1" onClick={()=>act(`/messages/${x.id}/retry`)}>{t('Retry')}</button>}{x.status==='QUEUED'&&<button className="btn py-1" onClick={()=>act(`/messages/${x.id}/cancel`)}>{t('Cancel')}</button>}</td>}
      </tr>)}
    </tbody></table></div>
  </>;
}
