import {describe,it,expect} from 'vitest';
import {normalizePhone} from '../src/utils/phone.js';
import {passwordProblem} from '../src/services/passwords.js';
import {todayInZone} from '../src/utils/date.js';
import {templateVariables,renderBody} from '../src/services/templateSelector.js';

describe('phone validation',()=>{
  it('converts 00 international prefix',()=>expect(normalizePhone('00971501234567')).toEqual({ok:true,value:'+971501234567'}));
  it('converts local numbers for known countries',()=>{
    expect(normalizePhone('01001234567','Egypt')).toEqual({ok:true,value:'+201001234567'});
    expect(normalizePhone('0551234567','KSA')).toEqual({ok:true,value:'+966551234567'});
  });
  it('rejects a UAE mobile with a missing digit',()=>expect(normalizePhone('+97150123456')).toMatchObject({ok:false}));
  it('asks for a country code when it cannot tell',()=>expect(normalizePhone('0501234567')).toMatchObject({ok:false,error:expect.stringContaining('country code')}));
  it('still accepts numbers from countries it has no rules for',()=>expect(normalizePhone('+33612345678')).toEqual({ok:true,value:'+33612345678'}));
});

describe('passwords',()=>{
  it('rejects short, letter-only, username-containing and demo passwords',()=>{
    expect(passwordProblem('short1','admin')).toBeTruthy();
    expect(passwordProblem('onlyletterspassword','admin')).toBeTruthy();
    expect(passwordProblem('admin12345678','admin')).toBeTruthy();
    expect(passwordProblem('ChangeMe!2026','hr')).toBeTruthy();
  });
  it('accepts a reasonable password',()=>expect(passwordProblem('Celebrate2026now','admin')).toBeNull());
});

describe('dates and templates',()=>{
  it('today follows the configured timezone',()=>{
    const now=new Date('2026-10-09T21:30:00Z');
    expect(todayInZone('Asia/Dubai',now).toISOString().slice(0,10)).toBe('2026-10-10');
    expect(todayInZone('Europe/London',now).toISOString().slice(0,10)).toBe('2026-10-09');
  });
  it('fills template variables in the configured order',()=>{
    const values=templateVariables(['firstName','yearsOfService'],'WORK_ANNIVERSARY',{firstName:'Aysha',fullName:'Aysha Ali',yearsOfService:5});
    expect(values).toEqual(['Aysha','5']);
    expect(renderBody('Congrats {{1}} on {{2}} years',values)).toBe('Congrats Aysha on 5 years');
  });
});

describe('employee IDs',async()=>{
  const {normalizeEmployeeId}=await import('../src/services/employeeIds.js');
  const {normalizeRow}=await import('../src/services/excel.js');
  const map={employeeId:'id',firstName:'name',mobile:'phone',joiningDate:'joined'};
  it('tidies common variants to the EMP001 format',()=>{
    expect(normalizeEmployeeId('emp12')).toBe('EMP012');
    expect(normalizeEmployeeId('EMP-007')).toBe('EMP007');
    expect(normalizeEmployeeId('EMP1234')).toBe('EMP1234');
    expect(normalizeEmployeeId('7X001')).toBeNull();
  });
  it('rejects IDs in another format but allows a missing ID',()=>{
    expect(normalizeRow({id:'7X001',name:'A',phone:'+971501234567',joined:'2020-01-01'},map,2).errors.join()).toContain('EMP001');
    const blank=normalizeRow({id:'',name:'A',phone:'+971501234567',joined:'2020-01-01'},map,2);
    expect(blank.status).toBe('VALID');expect(blank.data?.employeeId).toBe('');
  });
});

describe('secret storage',async()=>{
  const {encryptSecret,decryptSecret}=await import('../src/services/secretBox.js');
  it('round-trips and does not store the plain value',()=>{
    const box=encryptSecret('EAAG-secret-token-1234');
    expect(box).not.toContain('secret-token');
    expect(decryptSecret(box)).toBe('EAAG-secret-token-1234');
  });
  it('detects tampering',()=>{const [v,iv,tag,data]=encryptSecret('abc').split(':');expect(decryptSecret([v,iv,tag,Buffer.from('xyz').toString('base64')].join(':'))).toBeNull();});
});
