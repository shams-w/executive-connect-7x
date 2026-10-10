export type PhoneResult = { ok: true; value: string; warning?: string } | { ok: false; error: string };

// Dialing code + national mobile number pattern (without the leading 0) for countries we can convert local numbers for.
const COUNTRIES: { names: string[]; label: string; code: string; mobile: RegExp }[] = [
  { names: ['UAE','AE','ARE','UNITED ARAB EMIRATES','EMIRATES'], label: 'UAE', code: '971', mobile: /^5\d{8}$/ },
  { names: ['SA','KSA','SAU','SAUDI ARABIA','SAUDI'], label: 'Saudi', code: '966', mobile: /^5\d{8}$/ },
  { names: ['EG','EGY','EGYPT'], label: 'Egyptian', code: '20', mobile: /^1\d{9}$/ },
  { names: ['KW','KWT','KUWAIT'], label: 'Kuwaiti', code: '965', mobile: /^[569]\d{7}$/ },
  { names: ['QA','QAT','QATAR'], label: 'Qatari', code: '974', mobile: /^[3567]\d{7}$/ },
  { names: ['BH','BHR','BAHRAIN'], label: 'Bahraini', code: '973', mobile: /^[36]\d{7}$/ },
  { names: ['OM','OMN','OMAN'], label: 'Omani', code: '968', mobile: /^[79]\d{7}$/ },
  { names: ['JO','JOR','JORDAN'], label: 'Jordanian', code: '962', mobile: /^7\d{8}$/ },
  { names: ['LB','LBN','LEBANON'], label: 'Lebanese', code: '961', mobile: /^(3\d{6}|[78]\d{7})$/ },
  { names: ['IN','IND','INDIA'], label: 'Indian', code: '91', mobile: /^[6-9]\d{9}$/ },
  { names: ['PK','PAK','PAKISTAN'], label: 'Pakistani', code: '92', mobile: /^3\d{9}$/ },
  { names: ['PH','PHL','PHILIPPINES'], label: 'Philippine', code: '63', mobile: /^9\d{9}$/ },
  { names: ['GB','UK','GBR','UNITED KINGDOM'], label: 'UK', code: '44', mobile: /^7\d{9}$/ },
];
const byName = (country?: string | null) => { const c = (country ?? '').trim().toUpperCase(); return c ? COUNTRIES.find(x => x.names.includes(c)) : undefined; };
// Longest dialing code first so +971… isn't mistaken for another code that shares a prefix.
const byPrefix = (digits: string) => [...COUNTRIES].sort((a, b) => b.code.length - a.code.length).find(x => digits.startsWith(x.code));

function checkKnownCountry(e164: string): PhoneResult {
  const digits = e164.slice(1);
  const c = byPrefix(digits);
  if (c && !c.mobile.test(digits.slice(c.code.length))) return { ok:false, error:`${e164} is not a valid ${c.label} mobile number (check for a missing or extra digit)` };
  return { ok:true, value:e164 };
}

export function normalizePhone(input: unknown, country?: string | null): PhoneResult {
  if (input == null || String(input).trim() === '') return { ok:false, error:'Mobile is required' };
  let raw = String(input).trim().replace(/[\s().\-]/g,'');
  if (raw.startsWith('00')) raw = `+${raw.slice(2)}`;
  if (raw.startsWith('+')) return /^\+\d{8,15}$/.test(raw) ? checkKnownCountry(raw) : { ok:false, error:'Phone must contain only digits after the + country code, e.g. +971501234567' };
  if (!/^\d+$/.test(raw)) return { ok:false, error:'Phone must contain only digits, e.g. +971501234567' };
  const c = byName(country);
  if (c) {
    const local = raw.replace(/^0+/, '');
    if (c.mobile.test(local)) return { ok:true, value:`+${c.code}${local}` };
    if (raw.startsWith(c.code) && c.mobile.test(raw.slice(c.code.length))) return { ok:true, value:`+${raw}` };
    return { ok:false, error:`${String(input).trim()} is not a valid ${c.label} mobile number` };
  }
  if (/^971\d{9}$/.test(raw)) return checkKnownCountry(`+${raw}`);
  return { ok:false, error:'Add the country code (e.g. +971501234567), or fill in Country so local numbers can be converted' };
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g,'');
  if (digits.length < 6) return '***';
  const code = phone.startsWith('+') ? (byPrefix(digits)?.code ?? digits.slice(0,3)) : '';
  const cc = code ? `+${code} ` : '';
  const local = digits.slice(code.length);
  const first = local.slice(0,2);
  const last = local.slice(-2);
  return `${cc}${first} *** **${last}`.trim();
}
