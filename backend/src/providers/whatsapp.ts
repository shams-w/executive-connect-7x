
import axios from 'axios';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { isTestAllowed } from '../services/testAllowlist.js';
import {
  getWhatsAppConfig,
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

// Keep real 360dialog sending disabled until explicitly enabled.
function realSendingEnabled(): boolean {
  return env.DIALOG360_SEND_ENABLED === true;
}

function allowed360TestNumbers(): Set<string> {
  return new Set(
    env.DIALOG360_TEST_NUMBERS
      .split(',')
      .map(normalizePhone)
      .filter(Boolean)
  );
}

async function check360Safety(
  to: string
): Promise<SendResult | null> {
  if (!realSendingEnabled()) {
    return failure(
      'SENDING_DISABLED',
      'Real WhatsApp sending is disabled'
    );
  }

  const cfg = await getWhatsAppConfig();

  if (cfg.mode !== 'DIALOG360_TEST') {
    return failure(
      'MODE_BLOCKED',
      '360dialog sending is restricted to test mode'
    );
  }

  const numbers = allowed360TestNumbers();

  if (
    numbers.size !== 3 ||
    !numbers.has(normalizePhone(to))
  ) {
    return failure(
      'TEST_RECIPIENT_BLOCKED',
      'Recipient is not in the approved test allowlist'
    );
  }

  return null;
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
    // Block Meta sends while 360dialog integration is being prepared.
    if (realSendingEnabled()) {
      return failure(
        'META_SENDING_BLOCKED',
        'Meta sending is disabled during 360dialog integration'
      );
    }

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
  async sendTemplateMessage(
    input: SendTemplateInput
  ): Promise<SendResult> {
    const blocked = await check360Safety(input.to);

    if (blocked) return blocked;

    if (!env.DIALOG360_API_KEY) {
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
        `${env.DIALOG360_API_BASE_URL.replace(/\/$/, '')}/messages`,
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
          headers: {
            'D360-API-KEY': env.DIALOG360_API_KEY,
            'Content-Type': 'application/json'
          },
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
          'DIALOG360_ERROR'
        ),
        apiError(error)
      );
    }
  }

  async validateConfiguration(): Promise<ValidationResult> {
    if (!env.DIALOG360_API_KEY) {
      return {
        ok: false,
        message: '360dialog API key is missing'
      };
    }

    const numbers = allowed360TestNumbers();

    if (numbers.size !== 3) {
      return {
        ok: false,
        message: 'Exactly three unique test numbers are required'
      };
    }

    return {
      ok: true,
      message: '360dialog configuration is present. Live connection not verified.'
    };
  }

  // Webhook verification will be implemented separately.
  verifyWebhookSignature(): boolean {
    return false;
  }
}

export async function provider(): Promise<WhatsAppProvider> {
  const cfg = await getWhatsAppConfig();

  if (cfg.mode === 'MOCK') {
    return new MockWhatsAppProvider();
  }

  if (cfg.mode === 'DIALOG360_TEST') {
    return new Dialog360WhatsAppProvider();
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
