import {useState} from 'react';import {useQuery,useQueryClient} from '@tanstack/react-query';import {api} from '../lib/api';import {useI18n,eventLabel,statusLabel,apiError} from '../lib/i18n';import {PreviewModal} from '../components/MessagePreview';import type {Me} from '../App';
export default function Celebrations(){
  const {t,fmtDate}=useI18n();const qc=useQueryClient();const me=qc.getQueryData<Me>(['me']);
  const canRun=me?.role!=='VIEWER';const canApprove=me?.role==='SUPER_ADMIN'||me?.role==='COMMUNICATIONS_ADMIN';
  const {data=[]}=useQuery({queryKey:['celebrations'],queryFn:()=>api.get('/celebrations').then(r=>r.data)});
  const [preview,setPreview]=useState<any>(null),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
  const refresh=()=>{qc.invalidateQueries({queryKey:['celebrations']});qc.invalidateQueries({queryKey:['dashboard']});};
  async function act(fn:()=>Promise<string>){setBusy(true);setMsg('');try{setMsg(await fn());refresh();}catch(e:any){setMsg(apiError(t,e,'Something went wrong'))}finally{setBusy(false)}}
  const run=(type:string)=>act(async()=>{const r=await api.post(`/celebrations/run/${type}`);return t('{n} new celebration(s) found for today.',{n:r.data.created});});
  const processNow=()=>act(async()=>{const r=await api.post('/celebrations/process');return t('Queued {q}, sent {s}, failed {f}.',{q:r.data.queued,s:r.data.sent,f:r.data.failed});});
  const approve=(id:string)=>act(async()=>{await api.post(`/celebrations/${id}/approve`);setPreview(null);return t('Approved.');});
  const reject=(id:string)=>act(async()=>{await api.post(`/celebrations/${id}/reject`);setPreview(null);return t('Rejected.');});
  return <>
    <div className="flex justify-between items-end mb-6 gap-4 flex-wrap"><div><h1 className="text-2xl font-bold">{t('Celebrations')}</h1><p className="muted mt-1">{t('Messages are sent automatically each day at the configured time. Use these buttons to check or send now.')}</p></div>
      {canRun&&<div className="flex gap-2 flex-wrap"><button className="btn" disabled={busy} onClick={()=>run('birthday')}>{t('Run Birthday Check Now')}</button><button className="btn" disabled={busy} onClick={()=>run('anniversary')}>{t('Run Anniversary Check Now')}</button>{canApprove&&<button className="btn btn-primary" disabled={busy} onClick={processNow}>{t('Send approved now')}</button>}</div>}
    </div>
    {msg&&<div className="mb-4 card p-3 text-sm">{msg}</div>}
    <div className="card overflow-auto"><table><thead><tr><th>{t('Employee')}</th><th>{t('Event')}</th><th>{t('Years')}</th><th>{t('Date')}</th><th>{t('Template')}</th><th>{t('Status')}</th><th>{t('Actions')}</th></tr></thead><tbody>
      {data.length===0&&<tr><td colSpan={7} className="muted">{t('No celebrations yet. They appear here on the day.')}</td></tr>}
      {data.map((x:any)=><tr key={x.id}>
        <td>{x.employee.fullName}</td><td>{eventLabel(t,x.eventType)}</td><td>{x.yearsOfService??'—'}</td><td>{fmtDate(x.eventDate)}</td>
        <td className="text-xs">{x.template?.internalName??<span className="muted">{t('Automatic')}</span>}</td>
        <td><span className="badge">{statusLabel(t,x.status)}</span></td>
        <td className="whitespace-nowrap"><button className="btn py-1" onClick={()=>setPreview(x)}>{x.status==='PENDING_APPROVAL'&&canApprove?t('Preview / Approve'):t('Preview')}</button></td>
      </tr>)}
    </tbody></table></div>
    {preview&&<PreviewModal title={`${preview.employee.fullName} · ${eventLabel(t,preview.eventType)}`} target={{eventId:preview.id}} close={()=>setPreview(null)}
      actions={preview.status==='PENDING_APPROVAL'&&canApprove?<><button className="btn btn-primary flex-1" disabled={busy} onClick={()=>approve(preview.id)}>{t('Approve')}</button><button className="btn" disabled={busy} onClick={()=>reject(preview.id)}>{t('Reject')}</button></>:undefined}/>}
  </>;
}
