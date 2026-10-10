import {useQuery,useQueryClient} from '@tanstack/react-query';import {useMemo,useState} from 'react';import {api} from '../lib/api';import {useI18n,apiError} from '../lib/i18n';import {downloadFile} from '../lib/download';import type {Me} from '../App';
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
// The list API returns birthdays as "DD Mon" (birth year is intentionally hidden).
const birthdayParts=(b:string|null)=>{if(!b)return null;const [d,m]=b.split(' ');const month=MONTHS.indexOf(m);return month<0?null:{day:Number(d),month};};

export default function Employees(){
  const {t,lang:uiLang,fmtDate}=useI18n();const qc=useQueryClient();const me=qc.getQueryData<Me>(['me']);const canEdit=me?.role==='SUPER_ADMIN'||me?.role==='HR_ADMIN';
  const [q,setQ]=useState(''),[lang,setLang]=useState(''),[active,setActive]=useState(''),[dept,setDept]=useState(''),[birthdayMonth,setBirthdayMonth]=useState(''),[anniversaryMonth,setAnniversaryMonth]=useState(''),[selected,setSelected]=useState<any>(null),[adding,setAdding]=useState(false),[msg,setMsg]=useState('');
  const {data=[]}=useQuery({queryKey:['employees',q],queryFn:()=>api.get('/employees',{params:{q}}).then(r=>r.data)});
  const depts=useMemo(()=>[...new Set(data.map((e:any)=>e.department).filter(Boolean))].sort() as string[],[data]);
  const monthNames=useMemo(()=>MONTHS.map((_,i)=>new Intl.DateTimeFormat(uiLang==='ar'?'ar-AE':'en-GB',{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2000,i,1)))),[uiLang]);
  const showBirthday=(b:string|null)=>{const p=birthdayParts(b);return p?`${p.day} ${monthNames[p.month]}`:'—';};
  const rows=data.filter((e:any)=>{const b=birthdayParts(e.birthday);const jMonth=Number(String(e.joiningDate).slice(5,7));return(!lang||e.preferredLanguage===lang)&&(!active||String(e.isActive)===active)&&(!dept||e.department===dept)&&(!birthdayMonth||(b&&b.month+1===Number(birthdayMonth)))&&(!anniversaryMonth||jMonth===Number(anniversaryMonth));});
  async function exportAll(){setMsg('');try{await downloadFile('/employees/export','employees.xlsx')}catch(e:any){setMsg(apiError(t,e,'Export failed'))}}
  return <>
    <div className="flex justify-between items-end mb-6 gap-4 flex-wrap"><div><h1 className="text-2xl font-bold">{t('Employees')}</h1><p className="muted mt-1">{t('Click an employee to see details, edit, deactivate or delete.')}</p></div>
      <div className="flex gap-3 items-center"><input className="input max-w-xs" placeholder={t('Search name, ID, department')} value={q} onChange={e=>setQ(e.target.value)}/>{canEdit&&<><button className="btn whitespace-nowrap" onClick={exportAll}>{t('Export to Excel')}</button><button className="btn btn-primary whitespace-nowrap" onClick={()=>setAdding(true)}>{t('+ Add employee')}</button></>}</div></div>
    {msg&&<div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{msg}</div>}
    <div className="card p-4 mb-4 grid grid-cols-5 gap-3">
      <select className="input" value={dept} onChange={e=>setDept(e.target.value)}><option value="">{t('All departments')}</option>{depts.map(x=><option key={x}>{x}</option>)}</select>
      <select className="input" value={lang} onChange={e=>setLang(e.target.value)}><option value="">{t('All languages')}</option><option value="EN">{t('English')}</option><option value="AR">{t('Arabic')}</option></select>
      <select className="input" value={active} onChange={e=>setActive(e.target.value)}><option value="">{t('Active + Inactive')}</option><option value="true">{t('Active')}</option><option value="false">{t('Inactive')}</option></select>
      <select className="input" value={birthdayMonth} onChange={e=>setBirthdayMonth(e.target.value)}><option value="">{t('Birthday month')}</option>{monthNames.map((m,i)=><option value={i+1} key={i}>{m}</option>)}</select>
      <select className="input" value={anniversaryMonth} onChange={e=>setAnniversaryMonth(e.target.value)}><option value="">{t('Anniversary month')}</option>{monthNames.map((m,i)=><option value={i+1} key={i}>{m}</option>)}</select>
    </div>
    <div className="card overflow-auto"><table><thead><tr><th>{t('Employee')}</th><th>{t('ID')}</th><th>{t('Department')}</th><th>{t('Job title')}</th><th>{t('Birthday')}</th><th>{t('Joining date')}</th><th>{t('Language')}</th><th>{t('WhatsApp')}</th><th>{t('Status')}</th></tr></thead><tbody>
      {rows.length===0&&<tr><td colSpan={9} className="muted">{t('No employees match.')}</td></tr>}
      {rows.map((e:any)=><tr key={e.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800" onClick={()=>setSelected(e)}><td className="font-semibold">{e.fullName}</td><td>{e.employeeId}</td><td>{e.department??'—'}</td><td>{e.jobTitle??'—'}</td><td>{showBirthday(e.birthday)}</td><td>{fmtDate(e.joiningDate)}</td><td>{e.preferredLanguage}</td><td dir="ltr" className="text-start">{e.mobile}</td><td><span className="badge">{e.isActive?t('Active'):t('Inactive')}</span></td></tr>)}
    </tbody></table></div>
    {selected&&<Drawer e={selected} canEdit={canEdit} showBirthday={showBirthday} close={()=>setSelected(null)}/>}
    {adding&&<EmployeeForm close={()=>setAdding(false)}/>}
  </>;
}

function Drawer({e,canEdit,showBirthday,close}:{e:any,canEdit:boolean,showBirthday:(b:string|null)=>string,close:()=>void}){
  const {t,fmtDate}=useI18n();const qc=useQueryClient();
  const [editing,setEditing]=useState(false),[confirmDelete,setConfirmDelete]=useState(false),[err,setErr]=useState(''),[busy,setBusy]=useState(false);
  if(editing)return <EmployeeForm employee={e} close={close}/>;
  const years=Math.max(0,new Date().getFullYear()-Number(String(e.joiningDate).slice(0,4)));
  async function remove(){setBusy(true);setErr('');try{await api.delete(`/employees/${e.id}`);await qc.invalidateQueries({queryKey:['employees']});qc.invalidateQueries({queryKey:['dashboard']});close();}catch(x:any){setErr(apiError(t,x,'Could not delete employee'))}finally{setBusy(false)}}
  return <div className="fixed inset-0 bg-black/20 z-50" onClick={close}><div className="absolute end-0 top-0 h-full w-[430px] max-w-full overflow-y-auto bg-white dark:bg-slate-900 p-7 shadow-2xl" onClick={x=>x.stopPropagation()}>
    <div className="flex justify-between items-start gap-3"><div><h2 className="text-xl font-bold">{e.fullName}</h2><div className="muted text-sm mt-1">{e.employeeId}</div></div><div className="flex gap-2">{canEdit&&<button className="btn" onClick={()=>setEditing(true)}>{t('Edit')}</button>}<button className="btn" onClick={close}>{t('Close')}</button></div></div>
    <div className="mt-7 space-y-4 text-sm">{[['Department',e.department],['Job title',e.jobTitle],['Birthday',showBirthday(e.birthday)],['Joining date',fmtDate(e.joiningDate)],['Years of service',years],['Message language',e.preferredLanguage==='AR'?t('Arabic'):t('English')],['WhatsApp',e.mobile],['WhatsApp consent',e.whatsappConsent?t('Yes'):t('No')],['Status',e.isActive?t('Active'):t('Inactive')]].map(([k,v])=><div key={String(k)}><div className="muted text-xs">{t(String(k))}</div><div className="font-semibold mt-1">{k==='WhatsApp'?<span dir="ltr">{v}</span>:v??'—'}</div></div>)}</div>
    <div className="card p-4 mt-7"><b>{t('Celebration privacy')}</b><p className="muted text-xs mt-2">{t('Birth year is hidden in this view and phone numbers are masked.')}</p></div>
    {canEdit&&<div className="mt-7 border-t border-slate-200 pt-5">
      {!confirmDelete?<button className="btn text-red-700" onClick={()=>setConfirmDelete(true)}>{t('Delete employee…')}</button>:
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900"><b>{t('Delete {name} permanently?',{name:e.fullName})}</b><p className="mt-1">{t('Their celebration and message history is removed too. To stop messages but keep history, edit and untick "Active employee" instead.')}</p>
        <div className="flex gap-2 mt-3"><button className="btn btn-primary !bg-red-600 !border-red-600" disabled={busy} onClick={remove}>{busy?t('Deleting…'):t('Yes, delete')}</button><button className="btn" onClick={()=>setConfirmDelete(false)}>{t('Cancel')}</button></div></div>}
      {err&&<div className="mt-3 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{err}</div>}
    </div>}
  </div></div>;
}

function EmployeeForm({employee,close}:{employee?:any,close:()=>void}){
  const {t}=useI18n();const qc=useQueryClient();const editing=Boolean(employee);
  const [f,setF]=useState<Record<string,any>>(editing?{firstName:employee.firstName,lastName:employee.lastName??'',mobile:'',birthday:'',joiningDate:String(employee.joiningDate).slice(0,10),preferredLanguage:employee.preferredLanguage,country:employee.country??'',department:employee.department??'',jobTitle:employee.jobTitle??'',whatsappConsent:employee.whatsappConsent,isActive:employee.isActive}:{employeeId:'',firstName:'',lastName:'',mobile:'',birthday:'',joiningDate:'',preferredLanguage:'EN',country:'',department:'',jobTitle:'',whatsappConsent:true,isActive:true});
  const [err,setErr]=useState(''),[busy,setBusy]=useState(false),[duplicates,setDuplicates]=useState<any[]|null>(null);
  const set=(k:string)=>(e:any)=>{setDuplicates(null);setF({...f,[k]:e.target.type==='checkbox'?e.target.checked:e.target.value});};
  async function save(ev?:React.FormEvent,confirmDuplicates=false){ev?.preventDefault();setErr('');setBusy(true);try{const body:any={...f,confirmDuplicates};if(editing){if(!body.mobile)delete body.mobile;if(!body.birthday)delete body.birthday;await api.patch(`/employees/${employee.id}`,body);}else await api.post('/employees',body);await qc.invalidateQueries({queryKey:['employees']});qc.invalidateQueries({queryKey:['dashboard']});close();}
    catch(e:any){if(e.response?.data?.code==='POSSIBLE_DUPLICATE')setDuplicates(e.response.data.duplicates);else setErr(apiError(t,e,'Could not save employee'));}finally{setBusy(false)}}
  const field=(label:string,k:string,props:any={})=><label className="block"><span className="muted text-xs">{label}</span><input className="input mt-1" value={f[k]} onChange={set(k)} {...props}/></label>;
  return <div className="fixed inset-0 bg-black/20 z-50" onClick={close}><form onSubmit={save} className="absolute end-0 top-0 h-full w-[430px] max-w-full overflow-y-auto bg-white dark:bg-slate-900 p-7 shadow-2xl space-y-4" onClick={x=>x.stopPropagation()}>
    <div className="flex justify-between items-center"><h2 className="text-xl font-bold">{editing?t('Edit {name}',{name:employee.fullName}):t('Add employee')}</h2><button type="button" className="btn" onClick={close}>{t('Close')}</button></div>
    {!editing&&field(t('Employee ID (optional — next EMP number is used if empty)'),'employeeId',{placeholder:'EMP011',dir:'ltr'})}
    <div className="grid grid-cols-2 gap-3">{field(t('First name *'),'firstName',{required:true})}{field(t('Last name'),'lastName')}</div>
    {field(editing?t('WhatsApp number (current {value}; leave empty to keep)',{value:employee.mobile}):t('WhatsApp number *'),'mobile',{required:!editing,placeholder:'+971501234567',dir:'ltr'})}
    {field(t('Country (needed only for local numbers, e.g. UAE)'),'country')}
    {field(editing?t('Birthday (current {value}; leave empty to keep)',{value:employee.birthday??t('none')}):t('Birthday'),'birthday',{type:'date'})}
    {field(t('Date joined the company *'),'joiningDate',{type:'date',required:true})}
    <label className="block"><span className="muted text-xs">{t('Message language')}</span><select className="input mt-1" value={f.preferredLanguage} onChange={set('preferredLanguage')}><option value="EN">{t('English')}</option><option value="AR">{t('Arabic')}</option></select></label>
    <div className="grid grid-cols-2 gap-3">{field(t('Department'),'department')}{field(t('Job title'),'jobTitle')}</div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.whatsappConsent} onChange={set('whatsappConsent')}/>{t('Agreed to receive WhatsApp messages')}</label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isActive} onChange={set('isActive')}/>{t('Active employee')}</label>
    {duplicates&&<div className="rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-sm p-3"><b>{t('This may be a duplicate:')}</b><ul className="list-disc ps-5 mt-1">{duplicates.map((d:any)=><li key={d.employeeId}>{d.fullName} ({d.employeeId}) — {t(d.reason)}</li>)}</ul><button type="button" className="btn mt-3" disabled={busy} onClick={()=>save(undefined,true)}>{t('Save anyway')}</button></div>}
    {err&&<div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{err}</div>}
    <button className="btn btn-primary w-full" disabled={busy}>{busy?t('Saving…'):editing?t('Save changes'):t('Add employee')}</button>
  </form></div>;
}
