import {useQuery} from '@tanstack/react-query';import {api} from '../lib/api';import {useI18n} from '../lib/i18n';
export default function Audit(){
  const {t,fmtDateTime}=useI18n();
  const {data=[],error}=useQuery({queryKey:['audit'],queryFn:()=>api.get('/audit').then(r=>r.data),retry:false});
  return <>
    <h1 className="text-2xl font-bold">{t('Audit Logs')}</h1><p className="muted mt-1 mb-6">{t('A record of who did what and when. Super Admin only.')}</p>
    {error?<div className="card p-5">{t('You do not have permission to view audit logs.')}</div>:
    <div className="card overflow-auto"><table><thead><tr><th>{t('Time')}</th><th>{t('Actor')}</th><th>{t('Action')}</th><th>{t('Entity')}</th><th>{t('IP')}</th></tr></thead><tbody>{data.map((x:any)=><tr key={x.id}><td className="whitespace-nowrap">{fmtDateTime(x.timestamp)}</td><td>{x.actor}</td><td>{x.action}</td><td className="text-xs">{x.entityType??'—'} {x.entityId??''}</td><td dir="ltr" className="text-start">{x.ip??'—'}</td></tr>)}</tbody></table></div>}
  </>;
}
