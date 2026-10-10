import {useState} from 'react';import {useQuery,useQueryClient} from '@tanstack/react-query';import {api} from '../lib/api';import {useI18n,apiError,roleLabel} from '../lib/i18n';import type {Me} from '../App';
const ROLES=['SUPER_ADMIN','HR_ADMIN','COMMUNICATIONS_ADMIN','VIEWER'];
const ROLE_HELP:Record<string,string>={SUPER_ADMIN:'Everything, including users and settings',HR_ADMIN:'Employees and Excel imports',COMMUNICATIONS_ADMIN:'Templates, approvals and sending',VIEWER:'Read-only'};
export default function UsersPage({me}:{me:Me}){
  const {t,fmtDate}=useI18n();const qc=useQueryClient();
  const {data=[]}=useQuery({queryKey:['users'],queryFn:()=>api.get('/users').then(r=>r.data)});
  const [adding,setAdding]=useState(false),[resetFor,setResetFor]=useState<any>(null),[msg,setMsg]=useState('');
  async function update(u:any,data:any){setMsg('');try{await api.patch(`/users/${u.id}`,data);qc.invalidateQueries({queryKey:['users']})}catch(e:any){setMsg(apiError(t,e,'Could not update user'))}}
  return <>
    <div className="flex justify-between items-end mb-6"><div><h1 className="text-2xl font-bold">{t('Users')}</h1><p className="muted mt-1">{t('People who can sign in to this dashboard. New users must choose their own password at first sign-in.')}</p></div><button className="btn btn-primary" onClick={()=>setAdding(true)}>{t('+ Add user')}</button></div>
    {msg&&<div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{msg}</div>}
    <div className="card overflow-auto"><table><thead><tr><th>{t('Name')}</th><th>{t('Username')}</th><th>{t('Role')}</th><th>{t('Status')}</th><th>{t('Created')}</th><th>{t('Actions')}</th></tr></thead><tbody>
      {data.map((u:any)=><tr key={u.id}>
        <td className="font-semibold">{u.displayName}{u.id===me.id&&<span className="muted text-xs"> ({t('you')})</span>}</td>
        <td>{u.username}</td>
        <td><select className="input py-1" value={u.role} disabled={u.id===me.id} onChange={e=>update(u,{role:e.target.value})}>{ROLES.map(r=><option key={r} value={r}>{roleLabel(t,r)}</option>)}</select></td>
        <td><span className="badge">{u.isActive?t('Active'):t('Inactive')}</span>{u.mustChangePassword&&<div className="muted text-xs mt-1">{t('Must change password')}</div>}</td>
        <td>{fmtDate(u.createdAt)}</td>
        <td className="whitespace-nowrap">{u.id!==me.id&&<><button className="btn" onClick={()=>update(u,{isActive:!u.isActive})}>{u.isActive?t('Deactivate'):t('Activate')}</button> <button className="btn" onClick={()=>setResetFor(u)}>{t('Reset password')}</button></>}</td>
      </tr>)}
    </tbody></table></div>
    <div className="card p-5 mt-5 text-sm"><b>{t('Roles')}</b><ul className="mt-2 space-y-1">{ROLES.map(r=><li key={r}><b>{roleLabel(t,r)}:</b> <span className="muted">{t(ROLE_HELP[r])}</span></li>)}</ul></div>
    {adding&&<AddUser close={()=>setAdding(false)}/>}
    {resetFor&&<ResetPassword user={resetFor} close={()=>setResetFor(null)}/>}
  </>;
}
function Modal({title,close,children}:{title:string,close:()=>void,children:React.ReactNode}){return <div className="fixed inset-0 bg-black/20 z-50 grid place-items-center p-4" onClick={close}><div className="card bg-white w-full max-w-md p-6" onClick={e=>e.stopPropagation()}><h2 className="text-xl font-bold mb-4">{title}</h2>{children}</div></div>}
function AddUser({close}:{close:()=>void}){
  const {t}=useI18n();const qc=useQueryClient();
  const [f,setF]=useState({username:'',displayName:'',role:'HR_ADMIN',password:''}),[err,setErr]=useState(''),[busy,setBusy]=useState(false);
  async function save(e:React.FormEvent){e.preventDefault();setErr('');setBusy(true);try{await api.post('/users',f);qc.invalidateQueries({queryKey:['users']});close()}catch(e:any){setErr(apiError(t,e,'Could not add user'))}finally{setBusy(false)}}
  return <Modal title={t('Add user')} close={close}><form onSubmit={save} className="space-y-3">
    <label className="block"><span className="muted text-xs">{t('Full name')}</span><input className="input mt-1" required value={f.displayName} onChange={e=>setF({...f,displayName:e.target.value})}/></label>
    <label className="block"><span className="muted text-xs">{t('Username')}</span><input className="input mt-1" required value={f.username} onChange={e=>setF({...f,username:e.target.value})}/></label>
    <label className="block"><span className="muted text-xs">{t('Role')}</span><select className="input mt-1" value={f.role} onChange={e=>setF({...f,role:e.target.value})}>{ROLES.map(r=><option key={r} value={r}>{roleLabel(t,r)}</option>)}</select></label>
    <label className="block"><span className="muted text-xs">{t('Temporary password (they will change it at first sign-in)')}</span><input className="input mt-1" type="text" required value={f.password} onChange={e=>setF({...f,password:e.target.value})}/></label>
    {err&&<div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{err}</div>}
    <div className="flex gap-2"><button className="btn btn-primary flex-1" disabled={busy}>{busy?t('Saving…'):t('Add user')}</button><button type="button" className="btn" onClick={close}>{t('Cancel')}</button></div>
  </form></Modal>;
}
function ResetPassword({user,close}:{user:any,close:()=>void}){
  const {t}=useI18n();const qc=useQueryClient();
  const [password,setPassword]=useState(''),[err,setErr]=useState(''),[done,setDone]=useState(false);
  async function save(e:React.FormEvent){e.preventDefault();setErr('');try{await api.post(`/users/${user.id}/reset-password`,{password});qc.invalidateQueries({queryKey:['users']});setDone(true)}catch(e:any){setErr(apiError(t,e,'Could not reset password'))}}
  return <Modal title={t('Reset password for {name}',{name:user.displayName})} close={close}>{done?<><p className="text-sm">{t('Password reset. Give the temporary password to {name}; they will be asked to change it when they sign in.',{name:user.displayName})}</p><button className="btn mt-4" onClick={close}>{t('Close')}</button></>:<form onSubmit={save} className="space-y-3">
    <label className="block"><span className="muted text-xs">{t('New temporary password')}</span><input className="input mt-1" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
    {err&&<div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{err}</div>}
    <div className="flex gap-2"><button className="btn btn-primary flex-1">{t('Reset password')}</button><button type="button" className="btn" onClick={close}>{t('Cancel')}</button></div>
  </form>}</Modal>;
}
