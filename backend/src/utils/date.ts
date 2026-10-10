export function parseDateValue(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return asUtcDate(value.getFullYear(), value.getMonth()+1, value.getDate());
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Excel's widely used 1900 date system (including the historical leap-year compatibility offset).
    const ms = Math.round((value - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : asUtcDate(d.getUTCFullYear(), d.getUTCMonth()+1, d.getUTCDate());
  }
  const s=String(value).trim();
  let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return valid(+m[1],+m[2],+m[3]);
  m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m) return valid(+m[3],+m[2],+m[1]);
  return null;
}
function asUtcDate(y:number,m:number,d:number){ return new Date(Date.UTC(y,m-1,d)); }
function valid(y:number,m:number,d:number){ const x=asUtcDate(y,m,d); return x.getUTCFullYear()===y&&x.getUTCMonth()===m-1&&x.getUTCDate()===d?x:null; }
export function isoDate(d:Date|null){ return d ? d.toISOString().slice(0,10) : null; }

/** Calendar date/time parts of an instant as seen in the given IANA timezone. */
export function zonedParts(date:Date,timeZone:string){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
  const p=Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value])) as Record<string,string>;
  return {year:+p.year,month:+p.month,day:+p.day,hour:p.hour,minute:p.minute,isoDate:`${p.year}-${p.month}-${p.day}`};
}
/** Today's local calendar date in the given timezone, as the UTC-midnight Date used for @db.Date columns. */
export function todayInZone(timeZone:string,now=new Date()){const p=zonedParts(now,timeZone);return asUtcDate(p.year,p.month,p.day);}
export const DAY_MS=86400000;
