import {useQuery} from '@tanstack/react-query';import {api} from '../lib/api';import {useI18n} from '../lib/i18n';
export type PreviewTarget={eventId:string}|{employeeId:string;eventType:string;yearsOfService?:number|null;templateId?:string|null};

/** The WhatsApp text an employee would receive, rendered from the template's preview text. */
export function MessagePreview({target}:{target:PreviewTarget}){
  const {t}=useI18n();
  const {data,isLoading}=useQuery({queryKey:['preview',target],queryFn:()=>('eventId' in target?api.get(`/celebrations/${target.eventId}/preview`):api.get('/celebrations/preview',{params:{employeeId:target.employeeId,eventType:target.eventType,yearsOfService:target.yearsOfService??undefined,templateId:target.templateId??undefined}})).then(r=>r.data)});
  if(isLoading)return <div className="muted text-sm">{t('Loading…')}</div>;
  if(!data?.template)return <div className="text-sm text-red-700">{t('No active template for this celebration. Add one under Message Templates.')}</div>;
  return <div>
    <div className="rounded-2xl rounded-tl-sm bg-[#dcf8c6] text-slate-900 px-4 py-3 text-sm whitespace-pre-wrap shadow-sm" dir="auto">{data.text??<span className="italic text-slate-600">{t('This template has no preview text yet. Add it under Message Templates.')}</span>}</div>
    <div className="muted text-xs mt-2">{t('Template')}: {data.template.internalName}</div>
  </div>;
}

export function PreviewModal({title,target,close,actions}:{title:string;target:PreviewTarget;close:()=>void;actions?:React.ReactNode}){
  const {t}=useI18n();
  return <div className="fixed inset-0 bg-black/20 z-50 grid place-items-center p-4" onClick={close}>
    <div className="card bg-white w-full max-w-md p-6" onClick={e=>e.stopPropagation()}>
      <div className="flex justify-between items-start mb-4 gap-4"><h2 className="text-lg font-bold">{title}</h2><button className="btn" onClick={close}>{t('Close')}</button></div>
      <MessagePreview target={target}/>
      {actions&&<div className="flex gap-2 mt-5">{actions}</div>}
    </div>
  </div>;
}
