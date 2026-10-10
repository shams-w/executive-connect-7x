import {useState} from 'react';import {useQueryClient} from '@tanstack/react-query';import {api,setToken} from '../lib/api';import {useI18n,apiError} from '../lib/i18n';
export default function ChangePassword({forced=false}:{forced?:boolean}){
  const {t}=useI18n();const qc=useQueryClient();
  const [current,setCurrent]=useState(''),[next,setNext]=useState(''),[confirm,setConfirm]=useState(''),[err,setErr]=useState(''),[ok,setOk]=useState(false),[busy,setBusy]=useState(false);
  async function submit(e:React.FormEvent){e.preventDefault();setErr('');setOk(false);if(next!==confirm)return setErr(t('The new passwords do not match'));setBusy(true);
    try{const r=await api.post('/auth/change-password',{currentPassword:current,newPassword:next});setToken(r.data.accessToken);qc.setQueryData(['me'],r.data.user);setCurrent('');setNext('');setConfirm('');setOk(true);}
    catch(e:any){setErr(apiError(t,e,'Could not change password'))}finally{setBusy(false)}}
  async function logout(){try{await api.post('/auth/logout')}finally{setToken(null);qc.clear()}}
  return <form onSubmit={submit} className={`card p-8 ${forced?'':'max-w-md'}`}>
    <h1 className="text-2xl font-bold">{t('Change password')}</h1>
    <p className="muted mt-2 mb-6 text-sm">{forced?t('You are using a default or temporary password. Choose a new password to continue.'):t('Choose a new password for your account.')}</p>
    <label className="text-sm font-semibold">{t('Current password')}</label><input type="password" autoComplete="current-password" className="input mt-1 mb-4" value={current} onChange={e=>setCurrent(e.target.value)}/>
    <label className="text-sm font-semibold">{t('New password')}</label><input type="password" autoComplete="new-password" className="input mt-1 mb-1" value={next} onChange={e=>setNext(e.target.value)}/>
    <div className="muted text-xs mb-4">{t('At least 10 characters, with letters and numbers.')}</div>
    <label className="text-sm font-semibold">{t('Confirm new password')}</label><input type="password" autoComplete="new-password" className="input mt-1 mb-4" value={confirm} onChange={e=>setConfirm(e.target.value)}/>
    {err&&<div className="text-red-600 text-sm mb-3">{err}</div>}
    {ok&&<div className="text-green-700 text-sm mb-3">{t('Password changed.')}</div>}
    <button className="btn btn-primary w-full" disabled={busy||!current||!next||!confirm}>{busy?t('Saving…'):t('Change password')}</button>
    {forced&&<button type="button" className="btn w-full mt-2" onClick={logout}>{t('Logout')}</button>}
  </form>;
}
