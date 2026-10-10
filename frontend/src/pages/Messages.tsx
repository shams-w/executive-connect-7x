import {useState} from 'react';import {useQuery,useQueryClient} from '@tanstack/react-query';import {useLocation} from 'react-router-dom';import {api} from '../lib/api';import {useI18n,eventLabel,statusLabel,apiError} from '../lib/i18n';import type {Me} from '../App';
export default function Messages(){
  const {t,fmtDate,fmtDateTime}=useI18n();const loc=useLocation(),qc=useQueryClient();const me=qc.getQueryData<Me>(['me']);const canAct=me?.role==='SUPER_ADMIN'||me?.role==='COMMUNICATIONS_ADMIN';
  const status=loc.pathname.includes('failed')?'FAILED':loc.pathname.includes('pending')?'QUEUED':undefined;
  const {data=[]}=useQuery({queryKey:['messages',status],queryFn:()=>api.get('/messages',{params:{status}}).then(r=>r.data)});
  const [msg,setMsg]=useState('');
  async function act(path:string){setMsg('');try{await api.post(path);qc.invalidateQueries({queryKey:['messages']});qc.invalidateQueries({queryKey:['alerts']});}catch(e:any){setMsg(apiError(t,e,'Something went wrong'))}}
  const title=status==='FAILED'?'Failed Messages':status==='QUEUED'?'Scheduled Messages':'Delivery History';
  const subtitle=status==='FAILED'?'Messages WhatsApp could not deliver. Fix the cause (e.g. a wrong number), then retry the same day.':status==='QUEUED'?'Messages waiting to be sent today.':'Every celebration message and its delivery status.';
  return <>
    <h1 className="text-2xl font-bold">{t(title)}</h1><p className="muted mt-1 mb-6">{t(subtitle)}</p>
    {msg&&<div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{msg}</div>}
    <div className="card overflow-auto"><table><thead><tr><th>{t('Employee')}</th><th>{t('Event')}</th><th>{t('Date')}</th><th>{t('Template')}</th><th>{t('Recipient')}</th><th>{t('Status')}</th><th>{t('Retries')}</th><th>{t('Error')}</th><th>{t('Last update')}</th>{canAct&&<th>{t('Actions')}</th>}</tr></thead><tbody>
      {data.length===0&&<tr><td colSpan={10} className="muted">{t('Nothing here.')}</td></tr>}
      {data.map((x:any)=><tr key={x.id}>
        <td>{x.employee.fullName}</td><td>{eventLabel(t,x.celebrationEvent.eventType)}</td><td className="whitespace-nowrap">{fmtDate(x.celebrationEvent.eventDate)}</td><td className="text-xs">{x.templateName}</td><td dir="ltr" className="text-start whitespace-nowrap">{x.recipientPhoneMasked}</td>
        <td><span className="badge">{statusLabel(t,x.status)}</span></td><td>{x.retryCount}</td><td className="text-xs max-w-xs">{x.failureReason?t(x.failureReason):'—'}</td><td className="whitespace-nowrap text-xs">{fmtDateTime(x.updatedAt)}</td>
        {canAct&&<td className="whitespace-nowrap">{x.status==='FAILED'&&<button className="btn py-1" onClick={()=>act(`/messages/${x.id}/retry`)}>{t('Retry')}</button>}{x.status==='QUEUED'&&<button className="btn py-1" onClick={()=>act(`/messages/${x.id}/cancel`)}>{t('Cancel')}</button>}</td>}
      </tr>)}
    </tbody></table></div>
  </>;
}
