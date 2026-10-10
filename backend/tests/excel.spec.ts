import {describe,it,expect} from 'vitest';
import * as XLSX from 'xlsx';
import {detectColumns,parseWorkbook} from '../src/services/excel.js';

describe('Excel import validation',()=>{
  it('detects flexible Employee ID aliases',()=>{
    expect(detectColumns(['Staff ID','First Name','Mobile','Joining Date'])).toMatchObject({employeeId:'Staff ID'});
  });
  it('normalizes a valid workbook and rejects an invalid phone row',()=>{
    const ws=XLSX.utils.json_to_sheet([
      {'Employee Number':'EMP001','First Name':'Test','Mobile':'0501234567','Joining Date':'28/09/2020','Country':'UAE'},
      {'Employee Number':'EMP002','First Name':'Bad','Mobile':'not-a-phone','Joining Date':'28/09/2020','Country':'UAE'}
    ]);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Employees');const buffer=XLSX.write(wb,{type:'buffer',bookType:'xlsx'});const parsed=parseWorkbook(buffer);
    expect(parsed.rows[0].data?.mobile).toBe('+971501234567');
    expect(parsed.rows[1].status).toBe('ERROR');
  });
});
