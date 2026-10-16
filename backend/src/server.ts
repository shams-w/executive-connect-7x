
import cron from 'node-cron';
import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './db.js';
import { runDaily } from './services/jobs.js';
import { runtimeSettings, setRuntimeSetting } from './services/runtimeSettings.js';
import { zonedParts } from './utils/date.js';

let running = false;

cron.schedule('* * * * *', async () => {
  if (running) return;
  running = true;

  try {
    const s = await runtimeSettings();
    const p = zonedParts(new Date(), s.timezone);

    // Compare times numerically, not as unpadded strings.
    const [sendHour, sendMinute] = s.dailySendTime.split(':').map(Number);
    const currentMinutes = Number(p.hour) * 60 + Number(p.minute);
    const scheduledMinutes = sendHour * 60 + sendMinute;

    if (currentMinutes < scheduledMinutes) return;

    const last = (
      await prisma.systemSetting.findUnique({
        where: { key: 'LAST_DAILY_RUN_DATE' }
      })
    )?.value;

    if (last === p.isoDate && Number(p.minute) % 5 !== 0) return;

    await runDaily();

    if (last !== p.isoDate) {
      await setRuntimeSetting('LAST_DAILY_RUN_DATE', p.isoDate);
    }
  } catch (e) {
    console.error('scheduler_failed', e);
  } finally {
    running = false;
  }
});

app.listen(env.PORT, () => {
  console.log(
    `Executive Connect API http://localhost:${env.PORT} [${env.WHATSAPP_MODE}]`
  );
});
