// Renames Employee IDs that don't follow the EMP001 format to the next free EMP numbers.
// Usage:  npm run fix:employee-ids -w backend            (shows the plan only)
//         npm run fix:employee-ids -w backend -- --apply (makes the changes)
// Re-upload Excel files only after updating their Employee ID column, or leave it empty so rows match by WhatsApp number.
import {PrismaClient} from '@prisma/client';
import {isValidEmployeeId,nextEmployeeIds,normalizeEmployeeId} from '../src/services/employeeIds.js';

const prisma=new PrismaClient();
const apply=process.argv.includes('--apply');

async function main(){
  const all=await prisma.employee.findMany({select:{id:true,employeeId:true,fullName:true},orderBy:[{createdAt:'asc'},{employeeId:'asc'}]});
  const taken=new Set(all.map(e=>e.employeeId));
  const wrong=all.filter(e=>!isValidEmployeeId(e.employeeId));
  if(!wrong.length){console.log('All Employee IDs already follow the EMP001 format.');return;}
  const fresh=await nextEmployeeIds(wrong.length);let k=0;
  const plan=wrong.map(e=>{
    // "emp12" / "EMP-012" just get tidied when that ID is still free; anything else gets the next number.
    const tidy=normalizeEmployeeId(e.employeeId);
    const to=tidy&&!taken.has(tidy)?tidy:fresh[k++];
    taken.add(to);return {...e,to};
  });
  for(const p of plan)console.log(`${p.employeeId.padEnd(16)} → ${p.to}   ${p.fullName}`);
  if(!apply){console.log('\nNothing changed. Run again with --apply to rename these IDs.');return;}
  await prisma.$transaction(async tx=>{
    for(const p of plan){
      await tx.employee.update({where:{id:p.id},data:{employeeId:p.to}});
      // Keep import history pointing at the new ID too.
      const rows=await tx.excelImportRow.findMany({where:{employeeIdValue:p.employeeId}});
      for(const r of rows)await tx.excelImportRow.update({where:{id:r.id},data:{employeeIdValue:p.to,normalizedData:{...(r.normalizedData as object),employeeId:p.to}}});
      await tx.auditLog.create({data:{actor:'SYSTEM',action:'EMPLOYEE_ID_CHANGED',entityType:'Employee',entityId:p.id,metadata:{from:p.employeeId,to:p.to}}});
    }
  });
  console.log(`\nRenamed ${plan.length} Employee ID(s).`);
}
main().finally(()=>prisma.$disconnect());
