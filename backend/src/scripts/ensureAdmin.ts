// Production bootstrap: creates the first Super Admin (and default templates) only when no users exist yet.
// The temporary password comes from ADMIN_INITIAL_PASSWORD; the admin must change it at first sign-in.
import argon2 from 'argon2';import {prisma} from '../db.js';
const templates=[['birthday_greeting_en','en','BIRTHDAY','EN',['firstName'],'Happy birthday, {{1}}! 🎉 Wishing you a wonderful year ahead from all of us.'],['birthday_greeting_ar','ar','BIRTHDAY','AR',['firstName'],'عيد ميلاد سعيد يا {{1}}! 🎉 نتمنى لك عامًا رائعًا مليئًا بالنجاح.'],['work_anniversary_en','en','WORK_ANNIVERSARY','EN',['firstName','yearsOfService'],'Congratulations, {{1}}, on {{2}} year(s) with us! Thank you for everything you do.'],['work_anniversary_ar','ar','WORK_ANNIVERSARY','AR',['firstName','yearsOfService'],'مبروك يا {{1}} على إتمام {{2}} سنة/سنوات معنا! شكرًا لك على كل ما تقدمه.'],['work_anniversary_milestone_en','en','WORK_ANNIVERSARY','EN',['firstName','yearsOfService'],'What a milestone, {{1}}! 🏆 {{2}} year(s) with us. Thank you for your dedication.'],['work_anniversary_milestone_ar','ar','WORK_ANNIVERSARY','AR',['firstName','yearsOfService'],'إنجاز رائع يا {{1}}! 🏆 {{2}} سنة/سنوات معنا. شكرًا لإخلاصك وتفانيك.']] as const;
async function main(){
  for(const [name,metaLang,eventType,language,variables,bodyText] of templates)await prisma.messageTemplate.upsert({where:{internalName:name},create:{internalName:name,metaTemplateName:name,metaTemplateLanguage:metaLang,eventType,language,metaCategory:'UTILITY',variables:[...variables],bodyText},update:{}});
  if(await prisma.user.count())return console.log('ensure_admin: users exist, skipping');
  const pw=process.env.ADMIN_INITIAL_PASSWORD;if(!pw||pw.length<12)return console.log('ensure_admin: ADMIN_INITIAL_PASSWORD not set, no admin created');
  await prisma.user.create({data:{username:'admin',displayName:'Administrator',role:'SUPER_ADMIN',passwordHash:await argon2.hash(pw,{type:argon2.argon2id}),mustChangePassword:true}});
  console.log('ensure_admin: created user "admin"');
}
main().finally(()=>prisma.$disconnect());
