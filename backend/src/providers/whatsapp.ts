
import axios from 'axios';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { isTestAllowed } from '../services/testAllowlist.js';
import {
  getWhatsAppConfig,
  isDialog360,
  type WhatsAppConfig
} from '../services/whatsappConfig.js';

export type SendTemplateInput = {
  to: string;
  templateName: string;
  language: string;
  variables: string[];
};

export type SendResult = {
  messageId: string;
  status: 'SENT' | 'FAILED';
  errorCode?: string;
  errorReason?: string;
};

export type ValidationResult = {
  ok: boolean;
  message: string;
  phone?: {
    displayPhoneNumber?: string;
    verifiedName?: string;
    qualityRating?: string;
  };
};

export type MetaTemplate = {
  name: string;
  language: string;
  status: string;
  category?: string;
};

export interface WhatsAppProvider {
  sendTemplateMessage(input: SendTemplateInput): Promise<SendResult>;
  validateConfiguration(): Promise<ValidationResult>;
  verifyWebhookSignature(rawBody: Buffer, signature?: string): boolean;
  listTemplates?(): Promise<MetaTemplate[]>;
}

const normalizePhone = (value: string): string =>
  value.replace(/\D/g, '');

const failure = (
  errorCode: string,
  errorReason: string
): SendResult => ({
  messageId: '',
  status: 'FAILED',
  errorCode,
  errorReason
});

const apiError = (error: any): string =>
  String(
    error?.response?.data?.error?.message ??
    error?.message ??
    'WhatsApp API request failed'
  ).slice(0, 500);

const templateComponents = (variables: string[]) =>
  variables.length
    ? [{
        type: 'body',
        parameters: variables.map(text => ({
          type: 'text',
          text
        }))
      }]
    : [];

// Recipients allowed in 360dialog test mode: the dashboard allowlist plus DIALOG360_TEST_NUMBERS.
async function allowed360TestRecipient(to: string): Promise<boolean> {
  const phone = normalizePhone(to);

  const fromEnv = env.DIALOG360_TEST_NUMBERS
    .split(',')
    .map(normalizePhone)
    .filter(Boolean);

  return (
    fromEnv.includes(phone) ||
    (await isTestAllowed(to)) ||
    (await isTestAllowed(`+${phone}`))
  );
}

async function check360Safety(
  to: string
): Promise<SendResult | null> {
  const cfg = await getWhatsAppConfig();

  if (!isDialog360(cfg.mode)) {
    return failure(
      'MODE_BLOCKED',
      '360dialog is not the selected WhatsApp provider'
    );
  }

  if (
    cfg.mode === 'DIALOG360_TEST' &&
    !(await allowed360TestRecipient(to))
  ) {
    return failure(
      'TEST_RECIPIENT_BLOCKED',
      'Recipient is not on the test allowlist'
    );
  }

  return null;
}

/** Secret path segment that authenticates 360dialog webhook calls (360dialog does not sign them). */
export function dialog360WebhookToken(): string {
  return crypto
    .createHmac('sha256', env.JWT_SECRET)
    .update('dialog360-webhook')
    .digest('hex')
    .slice(0, 40);
}

export class MockWhatsAppProvider implements WhatsAppProvider {
  async sendTemplateMessage(
    input: SendTemplateInput
  ): Promise<SendResult> {
    return {
      messageId: `mock_${Date.now()}_${input.to.slice(-4)}`,
      status: 'SENT'
    };
  }

  async validateConfiguration(): Promise<ValidationResult> {
    return {
      ok: true,
      message: 'MOCK mode ready. No real message will be sent.'
    };
  }

  verifyWebhookSignature(): boolean {
    return true;
  }
}

export class MetaWhatsAppProvider implements WhatsAppProvider {
  constructor(private cfg: WhatsAppConfig) {}

  private base(): string {
    return `https://graph.facebook.com/${this.cfg.graphApiVersion}`;
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.cfg.accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  async sendTemplateMessage(
    input: SendTemplateInput
  ): Promise<SendResult> {
    const current = await getWhatsAppConfig();

    if (
      current.mode !== 'META_TEST' &&
      current.mode !== 'META_PRODUCTION'
    ) {
      return failure(
        'MODE_BLOCKED',
        'Meta is not the selected WhatsApp provider'
      );
    }

    if (
      this.cfg.mode === 'META_TEST' &&
      !(await isTestAllowed(input.to))
    ) {
      return failure(
        'TEST_RECIPIENT_BLOCKED',
        'Recipient is not on the Meta test allowlist'
      );
    }

    if (
      !this.cfg.graphApiVersion ||
      !this.cfg.accessToken ||
      !this.cfg.phoneNumberId
    ) {
      return failure(
        'CONFIG_MISSING',
        'Meta credentials are incomplete'
      );
    }

    try {
      const response = await axios.post(
        `${this.base()}/${this.cfg.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: input.to,
          type: 'template',
          template: {
            name: input.templateName,
            language: { code: input.language },
            components: templateComponents(input.variables)
          }
        },
        {
          headers: this.headers(),
          timeout: 15000
        }
      );

      return {
        messageId: response.data.messages?.[0]?.id ?? '',
        status: 'SENT'
      };
    } catch (error: any) {
      return failure(
        String(error.response?.data?.error?.code ?? 'META_ERROR'),
        apiError(error)
      );
    }
  }

  async validateConfiguration(): Promise<ValidationResult> {
    const missing = [
      ['API version', this.cfg.graphApiVersion],
      ['Access token', this.cfg.accessToken],
      ['Phone number ID', this.cfg.phoneNumberId],
      ['WhatsApp Business Account ID', this.cfg.wabaId]
    ]
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missing.length) {
      return {
        ok: false,
        message: `Missing: ${missing.join(', ')}`
      };
    }

    try {
      const response = await axios.get(
        `${this.base()}/${this.cfg.phoneNumberId}`,
        {
          params: {
            fields: 'display_phone_number,verified_name,quality_rating'
          },
          headers: this.headers(),
          timeout: 15000
        }
      );

      return {
        ok: true,
        message: 'Connected to Meta WhatsApp.',
        phone: {
          displayPhoneNumber: response.data.display_phone_number,
          verifiedName: response.data.verified_name,
          qualityRating: response.data.quality_rating
        }
      };
    } catch (error) {
      return {
        ok: false,
        message: `Meta connection failed: ${apiError(error)}`
      };
    }
  }

  async listTemplates(): Promise<MetaTemplate[]> {
    const output: MetaTemplate[] = [];

    let url: string | undefined =
      `${this.base()}/${this.cfg.wabaId}/message_templates`;

    let params: any = {
      fields: 'name,language,status,category',
      limit: 200
    };

    for (let page = 0; url && page < 10; page++) {
      const response: any = await axios.get(url, {
        params,
        headers: this.headers(),
        timeout: 15000
      });

      output.push(...(response.data.data ?? []));
      url = response.data.paging?.next;
      params = undefined;
    }

    return output;
  }

  verifyWebhookSignature(
    rawBody: Buffer,
    signature?: string
  ): boolean {
    if (
      !this.cfg.appSecret ||
      !signature?.startsWith('sha256=')
    ) {
      return false;
    }

    const expected = 'sha256=' +
      crypto
        .createHmac('sha256', this.cfg.appSecret)
        .update(rawBody)
        .digest('hex');

    const a = Buffer.from(expected);
    const b = Buffer.from(signature);

    return a.length === b.length &&
      crypto.timingSafeEqual(a, b);
  }
}

export class Dialog360WhatsAppProvider implements WhatsAppProvider {
  constructor(private cfg: WhatsAppConfig) {}

  private url(path: string): string {
    return `${env.DIALOG360_API_BASE_URL.replace(/\/$/, '')}${path}`;
  }

  private headers() {
    return {
      'D360-API-KEY': this.cfg.dialog360ApiKey,
      'Content-Type': 'application/json'
    };
  }

  async sendTemplateMessage(
    input: SendTemplateInput
  ): Promise<SendResult> {
    const blocked = await check360Safety(input.to);

    if (blocked) return blocked;

    if (!this.cfg.dialog360ApiKey) {
      return failure(
        'CONFIG_MISSING',
        '360dialog API key is missing'
      );
    }

    const phone = normalizePhone(input.to);

    if (!phone) {
      return failure(
        'INVALID_PHONE',
        'Recipient phone number is invalid'
      );
    }

    try {
      const response = await axios.post(
        this.url('/messages'),
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phone,
          type: 'template',
          template: {
            name: input.templateName,
            language: { code: input.language },
            components: templateComponents(input.variables)
          }
        },
        {
          headers: this.headers(),
          timeout: 15000
        }
      );

      const messageId = response.data.messages?.[0]?.id;

      if (!messageId) {
        return failure(
          'NO_MESSAGE_ID',
          '360dialog did not return a message ID'
        );
      }

      return {
        messageId,
        status: 'SENT'
      };
    } catch (error: any) {
      return failure(
        String(
          error.response?.data?.error?.code ??
          error.response?.status ??
          'DIALOG360_ERROR'
        ),
        apiError(error)
      );
    }
  }

  // Reading the account's templates proves the API key works.
  async validateConfiguration(): Promise<ValidationResult> {
    if (!this.cfg.dialog360ApiKey) {
      return {
        ok: false,
        message: '360dialog API key is missing'
      };
    }

    try {
      const templates = await this.listTemplates();

      return {
        ok: true,
        message: `Connected to 360dialog. ${templates.length} template(s) found on the account.`
      };
    } catch (error: any) {
      return {
        ok: false,
        message: `360dialog connection failed: ${apiError(error)}`
      };
    }
  }

  async listTemplates(): Promise<MetaTemplate[]> {
    const response = await axios.get(
      this.url('/v1/configs/templates'),
      {
        headers: this.headers(),
        params: { limit: 1000 },
        timeout: 15000
      }
    );

    return (response.data?.waba_templates ?? []).map((x: any) => ({
      name: String(x.name),
      language: String(x.language),
      status: String(x.status ?? '').toUpperCase(),
      category: x.category ? String(x.category) : undefined
    }));
  }

  /** Points 360dialog delivery receipts and replies at this app. */
  async registerWebhook(url: string): Promise<void> {
    await axios.post(
      this.url('/v1/configs/webhook'),
      { url },
      {
        headers: this.headers(),
        timeout: 15000
      }
    );
  }

  // 360dialog webhooks are authenticated by the secret token in their URL instead.
  verifyWebhookSignature(): boolean {
    return true;
  }
}

export async function provider(): Promise<WhatsAppProvider> {
  const cfg = await getWhatsAppConfig();

  if (cfg.mode === 'MOCK') {
    return new MockWhatsAppProvider();
  }

  if (isDialog360(cfg.mode)) {
    return new Dialog360WhatsAppProvider(cfg);
  }

  if (
    cfg.mode === 'META_TEST' ||
    cfg.mode === 'META_PRODUCTION'
  ) {
    return new MetaWhatsAppProvider(cfg);
  }

  throw new Error('Unsupported WhatsApp mode');
}

export async function metaProvider(): Promise<MetaWhatsAppProvider> {
  return new MetaWhatsAppProvider(await getWhatsAppConfig());
}

export async function dialog360Provider(): Promise<Dialog360WhatsAppProvider> {
  return new Dialog360WhatsAppProvider(await getWhatsAppConfig());
}
