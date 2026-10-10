import {describe,it,expect} from 'vitest';
import {normalizePhone,maskPhone} from '../src/utils/phone.js';
import {parseDateValue,isoDate} from '../src/utils/date.js';
import {getCelebrationCandidates} from '../src/services/celebrationEngine.js';
import {testRecipientAllowed} from '../src/services/testAllowlist.js';

describe('Critical acceptance rules - pure logic',()=>{
  it('3. invalid/ambiguous phone is rejected',()=>{
    expect(normalizePhone('0501234567')).toMatchObject({ok:false});
    expect(normalizePhone('abc','UAE')).toMatchObject({ok:false});
    expect(normalizePhone('0501234567','UAE')).toEqual({ok:true,value:'+971501234567'});
  });
  it('4. birthday employee is detected',()=>{
    const out=getCelebrationCandidates({id:'e',birthday:new Date('2000-09-28T00:00:00Z'),joiningDate:new Date('2020-01-01T00:00:00Z'),isActive:true,whatsappConsent:true},new Date('2026-09-28T05:00:00Z'));
    expect(out.some(x=>x.eventType==='BIRTHDAY')).toBe(true);
  });
  it('5. non-birthday employee is ignored',()=>{
    const out=getCelebrationCandidates({id:'e',birthday:new Date('2000-09-29T00:00:00Z'),joiningDate:new Date('2020-01-01T00:00:00Z'),isActive:true,whatsappConsent:true},new Date('2026-09-28T05:00:00Z'));
    expect(out.some(x=>x.eventType==='BIRTHDAY')).toBe(false);
  });
  it('6. work anniversary years are calculated correctly',()=>{
    const out=getCelebrationCandidates({id:'e',birthday:null,joiningDate:new Date('2020-09-28T00:00:00Z'),isActive:true,whatsappConsent:true},new Date('2026-09-28T05:00:00Z'));
    expect(out.find(x=>x.eventType==='WORK_ANNIVERSARY')?.yearsOfService).toBe(6);
  });
  it('7. joining date today this year is not a one-year anniversary',()=>{
    const out=getCelebrationCandidates({id:'e',birthday:null,joiningDate:new Date('2026-09-28T00:00:00Z'),isActive:true,whatsappConsent:true},new Date('2026-09-28T05:00:00Z'));
    expect(out).toHaveLength(0);
  });
  it('celebration day follows the configured timezone',()=>{
    const employee={id:'e',birthday:new Date('2000-09-28T00:00:00Z'),joiningDate:new Date('2020-01-01T00:00:00Z'),isActive:true,whatsappConsent:true};
    // 22:00 UTC on Sep 27 is already Sep 28 in Dubai but still Sep 27 in New York.
    const now=new Date('2026-09-27T22:00:00Z');
    expect(getCelebrationCandidates(employee,now,'FEB_28','Asia/Dubai')).toHaveLength(1);
    expect(getCelebrationCandidates(employee,now,'FEB_28','America/New_York')).toHaveLength(0);
  });

  it('10. TEST MODE blocks unauthorized phone numbers',()=>{
    const allowed=new Set(['+971500000001']);
    expect(testRecipientAllowed('META_TEST','+971500000009',allowed)).toBe(false);
    expect(testRecipientAllowed('META_TEST','+971500000001',allowed)).toBe(true);
    expect(testRecipientAllowed('MOCK','+971500000009',allowed)).toBe(true);
  });
  it('18. phone numbers are masked in normal UI format',()=>expect(maskPhone('+971501234567')).toBe('+971 50 *** **67'));
  it('20. February 29 defaults to February 28 in non-leap years',()=>{
    const employee={id:'e',birthday:new Date('2000-02-29T00:00:00Z'),joiningDate:new Date('2020-02-29T00:00:00Z'),isActive:true,whatsappConsent:true};
    expect(getCelebrationCandidates(employee,new Date('2026-02-28T08:00:00Z'),'FEB_28')).toHaveLength(2);
    expect(getCelebrationCandidates(employee,new Date('2026-02-27T08:00:00Z'),'FEB_28')).toHaveLength(0);
  });
  it('supports text dates and Excel serial dates',()=>{
    expect(isoDate(parseDateValue('28/09/2000'))).toBe('2000-09-28');
    expect(isoDate(parseDateValue('28-09-2000'))).toBe('2000-09-28');
    expect(isoDate(parseDateValue('2020-09-28'))).toBe('2020-09-28');
    expect(isoDate(parseDateValue(44102))).toBe('2020-09-28');
  });
});
