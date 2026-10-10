import {useMemo,useState} from 'react';import {useQueryClient} from '@tanstack/react-query';import {api} from '../lib/api';import {useI18n,apiError} from '../lib/i18n';import {downloadFile} from '../lib/download';
const fields=[['employeeId','Employee ID'],['firstName','First Name'],['lastName','Last Name'],['mobile','Mobile'],['email','Email'],['birthday','Birthday'],['joiningDate','Joining Date'],['preferredLanguage','Language'],['department','Department'],['company','Company'],['jobTitle','Job Title'],['country','Country'],['whatsappConsent','WhatsApp Consent'],['isActive','Active']] as const;
// Employee ID is optional: rows without one are matched by WhatsApp number or given the next EMP number.
const REQUIRED=['firstName','mobile','joiningDate'];
const SUMMARY_LABELS:Record<string,string>={total:'Total',valid:'Valid',new:'New',updates:'Updates',unchanged:'Unchanged',duplicates:'Duplicates',warnings:'Warnings',errors:'Errors',skipped:'Skipped'};
const ROW_LABELS:Record<string,string>={VALID:'Valid',WARNING:'Check',ERROR:'Error',NEW:'New',UPDATE:'Update',UNCHANGED:'Unchanged'};
export default function ImportEmployees(){
  const {t}=useI18n();const qc=useQueryClient();
  const [file,setFile]=useState<File|null>(null),[detected,setDetected]=useState<any>(null),[mapping,setMapping]=useState<Record<string,string>>({}),[preview,setPreview]=useState<any>(null),[busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[done,setDone]=useState(false);
  const step=done?5:preview?4:detected?3:file?2:1;
  async function detect(){if(!file)return;setBusy(true);setMsg('');const fd=new FormData();fd.append('file',file);try{const r=await api.post('/imports/detect',fd);setDetected(r.data);setMapping(r.data.mapping??{})}catch(e:any){setMsg(apiError(t,e,'Detection failed'))}finally{setBusy(false)}}
  async function doPreview(){if(!file)return;setBusy(true);setMsg('');const fd=new FormData();fd.append('file',file);fd.append('mapping',JSON.stringify(mapping));try{const r=await api.post('/imports/preview',fd);setPreview(r.data);setDone(false)}catch(e:any){setMsg(apiError(t,e,'Preview failed'))}finally{setBusy(false)}}
  async function confirm(){if(done)return;setBusy(true);setMsg('');try{await api.post(`/imports/${preview.importId}/confirm`);setDone(true);qc.invalidateQueries({queryKey:['employees']});qc.invalidateQueries({queryKey:['dashboard']});}catch(e:any){if(e.response?.status===409)setDone(true);else setMsg(apiError(t,e,'Import failed'))}finally{setBusy(false)}}
  const requiredMissing=useMemo(()=>REQUIRED.filter(k=>!mapping[k]),[mapping]);
  const labelOf=(key:string)=>t(fields.find(([k])=>k===key)?.[1]??key);
  return <>
    <div className="flex justify-between items-end mb-6"><div><h1 className="text-2xl font-bold">{t('Excel Imports')}</h1><p className="muted mt-1">{t('Upload → Detect → Map → Validate / Preview → Confirm.')}</p></div><button className="btn" onClick={()=>downloadFile('/imports/template','executive-connect-employees-template.xlsx')}>{t('Download Excel Template')}</button></div>
    <div className="flex gap-2 mb-5">{['Upload','Detect','Map','Validate / Preview','Confirm'].map((x,i)=><div key={x} className={`px-3 py-2 rounded-lg text-xs font-semibold ${step>=i+1?'bg-blue-600 text-white':'bg-slate-200 text-slate-500'}`}>{i+1}. {t(x)}</div>)}</div>
    <div className="card p-6 mb-6"><div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center"><input type="file" accept=".xlsx,.xls" onChange={e=>{setFile(e.target.files?.[0]??null);setDetected(null);setPreview(null);setDone(false);setMsg('')}}/><div className="muted text-sm mt-2">{t('Only .xlsx/.xls. Maximum 5 MB. Files are processed in memory and are never served publicly.')}</div></div>{file&&!detected&&<button disabled={busy} onClick={detect} className="btn btn-primary mt-4">{busy?t('Detecting…'):t('Detect columns')}</button>}{msg&&!preview&&<div className="mt-4 text-sm text-red-700">{msg}</div>}</div>
    {detected&&!preview&&<div className="card p-6 mb-6">
      <div className="flex justify-between mb-4"><div><b>{t('Detected sheet:')}</b> {detected.sheetName} · {t('{n} rows',{n:detected.totalRows})}</div><span className="badge">{t('Column Mapping')}</span></div>
      <div className="grid grid-cols-2 gap-4">{fields.map(([key,label])=><label key={key}><div className="text-sm font-semibold mb-1">{t(label)}{REQUIRED.includes(key)?' *':''}</div><select className="input" value={mapping[key]??''} onChange={e=>setMapping(m=>({...m,[key]:e.target.value}))}><option value="">{t('Not mapped')}</option>{detected.headers.map((h:string)=><option key={h} value={h}>{h}</option>)}</select></label>)}</div>
      {requiredMissing.length>0&&<div className="text-red-600 text-sm mt-4">{t('Required columns not mapped:')} {requiredMissing.map(labelOf).join(', ')}</div>}
      <button className="btn btn-primary mt-5" disabled={busy||requiredMissing.length>0} onClick={doPreview}>{busy?t('Validating…'):t('Validate records & preview changes')}</button>
    </div>}
    {preview&&<>
      <div className="grid grid-cols-4 xl:grid-cols-8 gap-3 mb-5">{Object.entries(preview.summary).map(([k,v])=><div className="card p-3" key={k}><div className="muted text-xs">{t(SUMMARY_LABELS[k]??k)}</div><b className="text-xl">{String(v)}</b></div>)}</div>
      <div className="card overflow-auto">
        <div className="p-4 flex justify-between items-center gap-4"><div>{done?<b className="text-green-700">{t('Import completed — {n} employee(s) saved. You can see them on the Employees page.',{n:preview.summary.new+preview.summary.updates})}</b>:<b>{t('Preview only — nothing has been written yet.')}</b>}{preview.summary.warnings>0&&!done&&<div className="text-amber-700 text-sm mt-1">{t('Rows marked "Check" may be duplicates. Review them before confirming.')}</div>}{msg&&!done&&<div className="text-red-600 text-sm mt-1">{msg}</div>}</div>
          <div className="flex gap-2">{preview.summary.errors>0&&<button className="btn" onClick={()=>downloadFile(`/imports/${preview.importId}/errors`,'import-errors.csv')}>{t('Download Error Report')}</button>}<button className="btn btn-primary" disabled={preview.summary.valid===0||busy||done} onClick={confirm}>{done?t('Imported ✓'):busy?t('Importing…'):preview.summary.errors>0?t('Import Valid Records'):t('Confirm import')}</button></div></div>
        <table><thead><tr><th>{t('Row')}</th><th>{t('Status')}</th><th>{t('Change')}</th><th>{t('Employee ID')}</th><th>{t('Name')}</th><th>{t('Phone')}</th><th>{t('Messages')}</th></tr></thead><tbody>
          {preview.rows.map((r:any)=><tr key={r.rowNumber} className={r.status==='ERROR'?'bg-red-50 dark:bg-red-950':r.status==='WARNING'?'bg-amber-50 dark:bg-amber-950':''}><td>{r.rowNumber}</td><td>{t(ROW_LABELS[r.status]??r.status)}</td><td><span className="badge">{t(ROW_LABELS[r.change]??r.change)}</span></td><td>{r.data?.employeeId??'—'}</td><td>{r.data?.fullName??'—'}</td><td dir="ltr" className="text-start">{r.data?.mobile?.replace(/(.{7}).+(.{2})/,'$1***$2')??'—'}</td><td className="text-xs">{[...(r.errors??[]),...(r.warnings??[])].map((m:string)=>t(m)).join('; ')||'—'}</td></tr>)}
        </tbody></table>
      </div>
    </>}
  </>;
}
