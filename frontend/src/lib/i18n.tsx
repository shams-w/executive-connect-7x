import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {ar} from './ar';

export type Lang='en'|'ar';
type Vars=Record<string,string|number>;
type I18n={lang:Lang;setLang:(l:Lang)=>void;t:(text:string,vars?:Vars)=>string;fmtDate:(value:string|Date|null|undefined,opts?:{year?:boolean})=>string;fmtDateTime:(value:string|Date|null|undefined)=>string};

const Ctx=createContext<I18n|null>(null);
const STORAGE_KEY='ec.lang';
function readLang():Lang{try{return localStorage.getItem(STORAGE_KEY)==='ar'?'ar':'en'}catch{return 'en'}}

export function I18nProvider({children}:{children:ReactNode}){
  const [lang,setLangState]=useState<Lang>(readLang);
  useEffect(()=>{document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';},[lang]);
  const value=useMemo<I18n>(()=>{
    const locale=lang==='ar'?'ar-AE':'en-GB';
    const t=(text:string,vars?:Vars)=>{const base=lang==='ar'?(ar[text]??text):text;return vars?base.replace(/\{(\w+)\}/g,(m,k)=>k in vars?String(vars[k]):m):base;};
    // Celebration dates are stored as UTC midnight, so format in UTC to avoid shifting the day.
    const fmtDate=(v:string|Date|null|undefined,opts?:{year?:boolean})=>{if(!v)return '—';const d=new Date(v);if(Number.isNaN(d.getTime()))return String(v);return new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',year:opts?.year===false?undefined:'numeric',timeZone:'UTC'}).format(d);};
    const fmtDateTime=(v:string|Date|null|undefined)=>{if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);};
    return {lang,setLang:(l:Lang)=>{try{localStorage.setItem(STORAGE_KEY,l)}catch{}setLangState(l)},t,fmtDate,fmtDateTime};
  },[lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useI18n(){const v=useContext(Ctx);if(!v)throw new Error('useI18n must be used inside I18nProvider');return v;}

const EVENT_LABELS:Record<string,string>={BIRTHDAY:'Birthday',WORK_ANNIVERSARY:'Work anniversary'};
const STATUS_LABELS:Record<string,string>={PENDING_APPROVAL:'Waiting for approval',APPROVED:'Approved',REJECTED:'Rejected',QUEUED:'Queued',SENT:'Sent',DELIVERED:'Delivered',READ:'Read',FAILED:'Failed',CANCELLED:'Skipped',EXPIRED:'Expired',PENDING:'Pending'};
const ROLE_LABELS:Record<string,string>={SUPER_ADMIN:'Super Admin',HR_ADMIN:'HR Admin',COMMUNICATIONS_ADMIN:'Communications Admin',VIEWER:'Viewer'};
export const eventLabel=(t:I18n['t'],type:string)=>t(EVENT_LABELS[type]??type);
export const statusLabel=(t:I18n['t'],status:string)=>t(STATUS_LABELS[status]??status);
export const roleLabel=(t:I18n['t'],role:string)=>t(ROLE_LABELS[role]??role);
export function dayLabel(i:I18n,daysAway:number,isoDate:string){if(daysAway===0)return i.t('Today');if(daysAway===1)return i.t('Tomorrow');if(daysAway<7)return new Intl.DateTimeFormat(i.lang==='ar'?'ar-AE':'en-GB',{weekday:'long',timeZone:'UTC'}).format(new Date(isoDate));return i.t('In {n} days',{n:daysAway});}
/** Server error text (translated when we know it) or a fallback. */
export function apiError(t:I18n['t'],e:any,fallback:string){const msg=e?.response?.data?.error;return msg?t(String(msg)):t(fallback);}
