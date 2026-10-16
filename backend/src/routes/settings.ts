
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, allow } from '../middleware/auth.js';
import { getTestAllowlist } from '../services/testAllowlist.js';
import { normalizePhone } from '../utils/phone.js';
import {
  metaProvider,
  provider
} from '../providers/whatsapp.js';
import { audit } from '../services/audit.js';
import { runtimeSettings } from '../services/runtimeSettings.js';
import {
  describeWhatsAppConfig,
  getWhatsAppConfig,
  resetWhatsAppConfig,
  saveWhatsAppConfig,
  PLAIN_FIELDS,
  SECRET_FIELDS
} from '../services/whatsappConfig.js';

const r = Router();
r.use(requireAuth);

const masked = (v: string) =>
  v ? `${v.slice(0, 3)}••••${v.slice(-3)}` : 'Not configured';

const setting = async (key: string) =>
  (await prisma.systemSetting.findUnique({
    where: { key }
  }))?.value;

function providerName(mode: string): string {
  if (mode === 'MOCK') return 'Mock';
  if (mode === 'DIALOG360_TEST') return '360dialog WhatsApp API';
  return 'Meta WhatsApp Cloud API';
}

r.get('/whatsapp', async (req, res) => {
  const rs = await runtimeSettings();
  const cfg = await getWhatsAppConfig();

  res.json({
    mode: cfg.mode,
    provider: providerName(cfg.mode),
    wabaId: masked(cfg.wabaId),
    phoneNumberId: masked(cfg.phoneNumberId),
    businessDisplayName:
      (await setting('BUSINESS_DISPLAY_NAME')) ?? 'Tareq',
    webhookConfigured:
      cfg.mode === 'DIALOG360_TEST'
        ? false
        : Boolean(cfg.webhookVerifyToken && cfg.appSecret),
    testAllowedNumbers: [
      ...(await getTestAllowlist())
    ].map(x => x.replace(/(.{4}).+(.{2})/, '$1••••$2')),
    inboundMode: rs.inboundMode,
    productionActivated:
      (await setting('PRODUCTION_ACTIVATED')) === true,
    connection:
      req.user?.role === 'SUPER_ADMIN'
        ? await describeWhatsAppConfig()
        : undefined,
    notice:
      'The approved WhatsApp Business display name is controlled by Meta/WhatsApp. The application can send through the configured business number and display name, but visibility of the underlying number in WhatsApp account details is controlled by WhatsApp and cannot be guaranteed by this application.'
  });
});

const connectionSchema = z.object({
  mode: z.enum([
    'MOCK',
    'META_TEST',
    'DIALOG360_TEST'
  ]).optional(),

  graphApiVersion: z.string()
    .trim()
    .regex(/^(v\d+\.\d+)?$/, 'API version looks like v23.0')
    .optional(),

  phoneNumberId: z.string()
    .trim()
    .regex(/^\d*$/, 'Phone number ID contains only digits')
    .optional(),

  wabaId: z.string()
    .trim()
    .regex(/^\d*$/, 'WhatsApp Business Account ID contains only digits')
    .optional(),

  accessToken: z.string().trim().max(1000).optional(),
  appSecret: z.string().trim().max(200).optional(),
  webhookVerifyToken: z.string().trim().max(200).optional(),

  clear: z.array(
    z.enum([
      ...PLAIN_FIELDS,
      ...SECRET_FIELDS
    ] as [string, ...string[]])
  ).optional()
});

r.put(
  '/whatsapp/connection',
  allow('SUPER_ADMIN'),
  async (req, res) => {
    const p = connectionSchema.safeParse(req.body);

    if (!p.success) {
      return res.status(400).json({
        error: p.error.issues[0]?.message ?? 'Invalid settings'
      });
    }

    const { clear = [], ...patch } = p.data;

    await saveWhatsAppConfig(patch, clear as any);

    const changed = Object.entries(patch)
      .filter(([, v]) => v)
      .map(([k]) => k);

    await audit(
      req.user,
      'WHATSAPP_CONNECTION_CHANGED',
      'SystemSetting',
      'WHATSAPP_CONFIG',
      { changed, cleared: clear },
      req.ip
    );

    res.json({
      ok: true,
      connection: await describeWhatsAppConfig(),
      mode: (await getWhatsAppConfig()).mode
    });
  }
);

r.delete(
  '/whatsapp/connection',
  allow('SUPER_ADMIN'),
  async (req, res) => {
    await resetWhatsAppConfig();

    await audit(
      req.user,
      'WHATSAPP_CONNECTION_CHANGED',
      'SystemSetting',
      'WHATSAPP_CONFIG',
      { reset: true },
      req.ip
    );

    res.json({ ok: true });
  }
);

// Validate the selected provider without sending a message.
r.post(
  '/whatsapp/validate',
  allow('SUPER_ADMIN'),
  async (_req, res) => {
    const cfg = await getWhatsAppConfig();

    const selectedProvider =
      cfg.mode === 'MOCK'
        ? await metaProvider()
        : await provider();

    const result =
      await selectedProvider.validateConfiguration();

    await prisma.systemSetting.upsert({
      where: { key: 'LAST_CONNECTION_CHECK' },
      create: {
        key: 'LAST_CONNECTION_CHECK',
        value: {
          ok: result.ok,
          at: new Date().toISOString()
        }
      },
      update: {
        value: {
          ok: result.ok,
          at: new Date().toISOString()
        }
      }
    });

    res.json(result);
  }
);

r.get(
  '/whatsapp/templates-check',
  allow('SUPER_ADMIN', 'COMMUNICATIONS_ADMIN'),
  async (_req, res) => {
    const cfg = await getWhatsAppConfig();

    if (cfg.mode === 'DIALOG360_TEST') {
      return res.status(400).json({
        error:
          '360dialog template synchronization is not configured yet. Verify approved templates in 360dialog Manager.'
      });
    }

    let remote;

    try {
      remote = await (await metaProvider()).listTemplates();
    } catch (e: any) {
      return res.status(400).json({
        error:
          `Could not read templates from Meta: ${
            String(
              e?.response?.data?.error?.message ??
              e?.message
            ).slice(0, 300)
          }`
      });
    }

    const local = await prisma.messageTemplate.findMany({
      where: { isActive: true },
      orderBy: { internalName: 'asc' }
    });

    res.json(
      local.map(t => {
        const m = remote.find(
          x =>
            x.name === t.metaTemplateName &&
            x.language === t.metaTemplateLanguage
        );

        const sameName = remote
          .filter(x => x.name === t.metaTemplateName)
          .map(x => x.language);

        return {
          internalName: t.internalName,
          metaTemplateName: t.metaTemplateName,
          language: t.metaTemplateLanguage,
          status: m?.status ?? 'NOT_FOUND',
          category: m?.category ?? null,
          otherLanguages: m ? [] : sameName
        };
      })
    );
  }
);

r.put(
  '/whatsapp/preferences',
  allow('SUPER_ADMIN'),
  async (req, res) => {
    const displayName = String(
      req.body?.businessDisplayName ?? ''
    ).trim();

    const raw = Array.isArray(req.body?.testAllowedNumbers)
      ? req.body.testAllowedNumbers
      : [];

    const phones: string[] = [];

    for (const value of raw) {
      const n = normalizePhone(value, 'UAE');

      if (!n.ok) {
        return res.status(400).json({
          error: `Invalid test number: ${String(value)}`
        });
      }

      phones.push(n.value);
    }

    if (displayName) {
      await prisma.systemSetting.upsert({
        where: { key: 'BUSINESS_DISPLAY_NAME' },
        create: {
          key: 'BUSINESS_DISPLAY_NAME',
          value: displayName
        },
        update: {
          value: displayName
        }
      });
    }

    await prisma.systemSetting.upsert({
      where: { key: 'TEST_ALLOWED_NUMBERS' },
      create: {
        key: 'TEST_ALLOWED_NUMBERS',
        value: phones
      },
      update: {
        value: phones
      }
    });

    await audit(
      req.user,
      'SETTINGS_CHANGED',
      'SystemSetting',
      'WHATSAPP_PREFERENCES',
      {
        testAllowlistCount: phones.length,
        businessDisplayName: displayName || undefined
      },
      req.ip
    );

    res.json({ ok: true });
  }
);

async function checklist() {
  const cfg = await getWhatsAppConfig();

  const templates = await prisma.messageTemplate.count({
    where: { isActive: true }
  });

  return {
    credentials: Boolean(cfg.accessToken),
    phoneNumberId: Boolean(cfg.phoneNumberId),
    waba: Boolean(cfg.wabaId),
    templates: templates >= 2,
    webhook: Boolean(
      cfg.webhookVerifyToken && cfg.appSecret
    ),
    timezone:
      (await runtimeSettings()).timezone === 'Asia/Dubai',
    testPassed:
      (await setting('LAST_TEST_PASSED')) === true,
    backupConfigured:
      (await setting('DATABASE_BACKUP_CONFIGURED')) === true
  };
}

r.get(
  '/production-checklist',
  allow('SUPER_ADMIN'),
  async (_req, res) => {
    res.json(await checklist());
  }
);

// Preserve the existing Meta production activation process.
r.post(
  '/activate-production',
  allow('SUPER_ADMIN'),
  async (req, res) => {
    if (
      req.body?.confirmation !== 'ACTIVATE PRODUCTION'
    ) {
      return res.status(400).json({
        error:
          'Confirmation phrase must be ACTIVATE PRODUCTION'
      });
    }

    const c = await checklist();
    const { timezone: _tz, ...required } = c;

    if (!Object.values(required).every(Boolean)) {
      return res.status(400).json({
        error: 'Production checklist is incomplete'
      });
    }

    const check =
      await (await metaProvider()).validateConfiguration();

    if (!check.ok) {
      return res.status(400).json({
        error: check.message
      });
    }

    await saveWhatsAppConfig({
      mode: 'META_PRODUCTION'
    });

    await prisma.systemSetting.upsert({
      where: { key: 'PRODUCTION_ACTIVATED' },
      create: {
        key: 'PRODUCTION_ACTIVATED',
        value: true
      },
      update: {
        value: true
      }
    });

    await audit(
      req.user,
      'PRODUCTION_ACTIVATED',
      'SystemSetting',
      'PRODUCTION_ACTIVATED',
      undefined,
      req.ip
    );

    res.json({
      ok: true,
      note:
        'Production is on. Celebration messages now go to real employees.'
    });
  }
);

export default r;
