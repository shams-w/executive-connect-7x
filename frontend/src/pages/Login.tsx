import {useState} from 'react';import {useNavigate} from 'react-router-dom';import {useQueryClient} from '@tanstack/react-query';import {api,setToken} from '../lib/api';import {useI18n,apiError} from '../lib/i18n';
export default function Login(){
  const {t,lang,setLang}=useI18n();const qc=useQueryClient();const go=useNavigate();
  const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[err,setErr]=useState(''),[busy,setBusy]=useState(false);
  async function submit(e:React.FormEvent){e.preventDefault();setErr('');setBusy(true);try{const r=await api.post('/auth/login',{username,password});qc.clear();setToken(r.data.accessToken);go('/dashboard')}catch(e:any){setErr(apiError(t,e,'Login failed'))}finally{setBusy(false)}}
  return <div className="min-h-screen grid place-items-center p-6">
    <form onSubmit={submit} className="card w-full max-w-md p-8">
      <div className="flex justify-between items-start"><div className="text-2xl font-bold">Executive Connect</div><button type="button" className="text-sm muted" onClick={()=>setLang(lang==='ar'?'en':'ar')}>{lang==='ar'?'English':'العربية'}</button></div>
      <p className="muted mt-2 mb-6">{t('Secure administrator sign in')}</p>
      <label className="text-sm font-semibold">{t('Username')}</label><input className="input mt-1 mb-4" autoComplete="username" autoFocus value={username} onChange={e=>setUsername(e.target.value)}/>
      <label className="text-sm font-semibold">{t('Password')}</label><input type="password" autoComplete="current-password" className="input mt-1 mb-4" value={password} onChange={e=>setPassword(e.target.value)}/>
      {err&&<div className="text-red-600 text-sm mb-3">{err}</div>}
      <button className="btn btn-primary w-full" disabled={busy||!username||!password}>{busy?t('Signing in…'):t('Sign in')}</button>
    </form>
  </div>;
}
