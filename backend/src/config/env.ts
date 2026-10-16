
import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum([
    'development',
    'test',
    'production'
  ]).default('development'),

  PORT: z.coerce.number().default(8000),

  FRONTEND_URL: z.string()
    .default('http://localhost:5173'),

  DATABASE_URL: z.string()
    .default(
      'postgresql://executive_connect:executive_connect@localhost:5432/executive_connect?schema=public'
    ),

  JWT_SECRET: z.string().min(16)
    .default('development-jwt-secret-change-me'),

  REFRESH_SECRET: z.string().min(16)
    .default('development-refresh-secret-change-me'),

  // WhatsApp provider modes
  WHATSAPP_MODE: z.enum([
    'MOCK',
    'META_TEST',
    'META_PRODUCTION',
    'DIALOG360_TEST'
  ]).default('MOCK'),

  // Meta WhatsApp API settings
  META_GRAPH_API_VERSION: z.string().default(''),
  META_ACCESS_TOKEN: z.string().default(''),
  META_PHONE_NUMBER_ID: z.string().default(''),
  META_WABA_ID: z.string().default(''),
  META_WEBHOOK_VERIFY_TOKEN: z.string().default(''),
  META_APP_SECRET: z.string().default(''),

  // 360dialog WhatsApp API settings
  DIALOG360_API_KEY: z.string().default(''),

  DIALOG360_API_BASE_URL: z.string()
    .url()
    .default('https://waba-v2.360dialog.io'),

  // Three approved test recipients only
  DIALOG360_TEST_NUMBERS: z.string().default(''),

  // Safety switch: disabled by default
  DIALOG360_SEND_ENABLED: z.enum([
    'true',
    'false'
  ])
    .default('false')
    .transform(value => value === 'true'),

  // Existing Meta test allowlist
  TEST_ALLOWED_NUMBERS: z.string().default(''),

  // Scheduling
  APP_TIMEZONE: z.string().default('Asia/Dubai'),

  DAILY_SEND_TIME: z.string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .default('09:00'),

  // Require manual review during testing
  SEND_POLICY: z.enum([
    'AUTO',
    'REVIEW'
  ]).default('REVIEW'),

  INBOUND_MODE: z.enum([
    'STORE_ONLY',
    'ROUTE_TO_CORPORATE_INBOX',
    'AUTO_ACKNOWLEDGE',
    'DISABLED'
  ]).default('STORE_ONLY'),

  MINIMUM_IMPORT_AGE_MINUTES: z.coerce.number()
    .int()
    .nonnegative()
    .default(30),

  LEAP_DAY_POLICY: z.enum([
    'FEB_28',
    'MAR_01'
  ]).default('FEB_28'),

  MESSAGE_BATCH_SIZE: z.coerce.number()
    .int()
    .positive()
    .max(100)
    .default(10),

  MESSAGE_RATE_PER_SECOND: z.coerce.number()
    .positive()
    .max(50)
    .default(5),

  // Encryption for saved WhatsApp settings
  SETTINGS_ENCRYPTION_KEY: z.string().default(''),

  // Optional email alerts
  SMTP_HOST: z.string().default(''),

  SMTP_PORT: z.coerce.number()
    .int()
    .positive()
    .default(587),

  SMTP_SECURE: z.enum([
    'true',
    'false'
  ])
    .default('false')
    .transform(value => value === 'true'),

  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  ALERT_EMAIL_FROM: z.string().default(''),
  ALERT_EMAIL_TO: z.string().default('')
});

export const env = schema.parse(process.env);

export const testAllowedNumbers = new Set(
  env.TEST_ALLOWED_NUMBERS
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
);

export const dialog360TestNumbers = new Set(
  env.DIALOG360_TEST_NUMBERS
    .split(',')
    .map(value => value.replace(/\D/g, ''))
    .filter(Boolean)
);

