import nodemailer from 'nodemailer';
import { prisma } from '../db.js';
import { env } from '../config/env.js';
import { audit } from './audit.js';

export type AlertKind = 'SEND_FAILED' | 'TOKEN_EXPIRED' | 'NO_TEMPLATE' | 'SCHEDULER_FAILED';
export type StoredAlert = { kind: AlertKind; subject: string; details: string; at: string };

const EMAIL_THROTTLE_MS = 60 * 60 * 1000;
export const emailAlertsConfigured = () => Boolean(env.SMTP_HOST && env.ALERT_EMAIL_TO);

/** Records an operational alert for the dashboard banner and emails it (at most once an hour per kind). */
export async function raiseAlert(kind: AlertKind, subject: string, details: string) {
  const alert: StoredAlert = { kind, subject, details, at: new Date().toISOString() };
  await prisma.systemSetting.upsert({ where: { key: 'LAST_ALERT' }, create: { key: 'LAST_ALERT', value: alert }, update: { value: alert } });
  await audit(undefined, 'ALERT_RAISED', 'Alert', kind, { subject });
  if (!emailAlertsConfigured()) return;
  const throttleKey = `ALERT_EMAILED_${kind}`;
  const last = (await prisma.systemSetting.findUnique({ where: { key: throttleKey } }))?.value;
  if (typeof last === 'string' && Date.now() - Date.parse(last) < EMAIL_THROTTLE_MS) return;
  try {
    const transport = nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE, auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined });
    await transport.sendMail({ from: env.ALERT_EMAIL_FROM || env.SMTP_USER, to: env.ALERT_EMAIL_TO, subject: `[Executive Connect] ${subject}`, text: `${details}\n\nOpen the dashboard → Failed Messages for details.` });
    await prisma.systemSetting.upsert({ where: { key: throttleKey }, create: { key: throttleKey, value: alert.at }, update: { value: alert.at } });
  } catch (e) {
    console.error('alert_email_failed', e);
  }
}
