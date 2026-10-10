import cron from 'node-cron';import {app} from './app.js';import {env} from './config/env.js';import {prisma} from './db.js';import {runDaily} from './services/jobs.js';import {runtimeSettings,setRuntimeSetting} from './services/runtimeSettings.js';import {zonedParts} from './utils/date.js';
// Every minute: once the daily send time has passed, run today's job if it hasn't run yet (this also catches up after
// the server was down at send time). After that, re-run every 5 minutes so employees added later in the day, approvals
// and retries are still sent the same day. Every step is idempotent, so repeated runs never double-send.
let running=false;
cron.schedule('* * * * *',async()=>{if(running)return;running=true;try{const s=await runtimeSettings();const p=zonedParts(new Date(),s.timezone);if(`${p.hour}:${p.minute}`<s.dailySendTime)return;const last=(await prisma.systemSetting.findUnique({where:{key:'LAST_DAILY_RUN_DATE'}}))?.value;if(last===p.isoDate&&Number(p.minute)%5!==0)return;await runDaily();if(last!==p.isoDate)await setRuntimeSetting('LAST_DAILY_RUN_DATE',p.isoDate);}catch(e){console.error('scheduler_failed',e)}finally{running=false}});
app.listen(env.PORT,()=>console.log(`Executive Connect API http://localhost:${env.PORT} [${env.WHATSAPP_MODE}]`));
