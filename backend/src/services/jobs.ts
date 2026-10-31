
import { prisma } from '../db.js';
import { env } from '../config/env.js';
import { getCelebrationCandidates } from './celebrationEngine.js';
import { maskPhone } from '../utils/phone.js';
import { provider } from '../providers/whatsapp.js';
import { audit } from './audit.js';
import { isTestAllowed } from './testAllowlist.js';
import { runtimeSettings } from './runtimeSettings.js';
import { selectTemplate, templateVariables } from './templateSelector.js';
import { raiseAlert } from './alerts.js';
import { getWhatsAppConfig } from './whatsappConfig.js';
import { DAY_MS, todayInZone } from '../utils/date.js';

const TOKEN_ERRORS = new Set(['190', '102', '463', '467']);

// Retrying these cannot help until someone fixes the cause (token,
// template, parameters or number).
const PERMANENT_ERRORS = new Set([
  ...TOKEN_ERRORS,
  '100', '131008', '131009', '131030', '131051',
  '132000', '132001', '132005', '132007', '132012', '132015', '132016',
  'INVALID_PHONE', 'INVALID_TEMPLATE', 'CONFIG_MISSING'
]);

const AUTO_RETRIES = 3;
const AUTO_RETRY_DELAY_MS = 15 * 60000;

const RATE_LIMIT_ERRORS = new Set(['429', '130429', '131048', '131056']);

export async function createEligibleEvents(
  now = new Date(),
  only?: 'BIRTHDAY' | 'WORK_ANNIVERSARY'
) {
  const employees = await prisma.employee.findMany({
    where: {
      isActive: true,
      whatsappConsent: true
    }
  });

  const settings = await runtimeSettings();
  let created = 0;

  for (const e of employees) {
    for (const c of getCelebrationCandidates(
      e,
      now,
      settings.leapDayPolicy,
      settings.timezone
    )) {
      if (only && c.eventType !== only) continue;

      const r = await prisma.celebrationEvent.upsert({
        where: {
          employeeId_eventType_eventYear: {
            employeeId: e.id,
            eventType: c.eventType,
            eventYear: c.eventYear
          }
        },
        create: {
          employeeId: e.id,
          eventType: c.eventType,
          eventYear: c.eventYear,
          yearsOfService: c.yearsOfService,
          eventDate: c.eventDate,
          status: settings.sendPolicy === 'AUTO'
            ? 'APPROVED'
            : 'PENDING_APPROVAL'
        },
        update: {}
      });

      if (r.createdAt.getTime() > Date.now() - 5000) {
        created++;
      }
    }
  }

  // Under AUTO, today's events left waiting from an earlier REVIEW policy are sent too.
  if (settings.sendPolicy === 'AUTO') {
    const today = todayInZone(settings.timezone, now);

    await prisma.celebrationEvent.updateMany({
      where: {
        status: 'PENDING_APPROVAL',
        eventDate: {
          gte: today,
          lt: new Date(today.getTime() + DAY_MS)
        },
        ...(only ? { eventType: only } : {})
      },
      data: { status: 'APPROVED' }
    });
  }

  return { created };
}

async function expireStale(today: Date) {
  const expiredEvents = await prisma.celebrationEvent.updateMany({
    where: {
      status: { in: ['PENDING_APPROVAL', 'APPROVED'] },
      eventDate: { lt: today }
    },
    data: { status: 'EXPIRED' }
  });

  const stale = await prisma.messageDelivery.findMany({
    where: {
      status: { in: ['PENDING', 'QUEUED'] },
      celebrationEvent: {
        eventDate: { lt: today }
      }
    },
    select: {
      id: true,
      celebrationEventId: true
    }
  });

  if (stale.length) {
    await prisma.messageDelivery.updateMany({
      where: {
        id: { in: stale.map(x => x.id) }
      },
      data: {
        status: 'CANCELLED',
        failureCode: 'EXPIRED',
        failureReason: 'The celebration day passed before the message could be sent'
      }
    });

    await prisma.celebrationEvent.updateMany({
      where: {
        id: { in: stale.map(x => x.celebrationEventId) }
      },
      data: { status: 'EXPIRED' }
    });
  }

  return expiredEvents.count + stale.length;
}

export async function queueApprovedEvents(now = new Date()) {
  const settings = await runtimeSettings();
  const today = todayInZone(settings.timezone, now);

  const expired = await expireStale(today);

  const minAge = new Date(
    Date.now() - settings.minimumImportAgeMinutes * 60000
  );

  const events = await prisma.celebrationEvent.findMany({
    where: {
      status: 'APPROVED',
      eventDate: {
        gte: today,
        lt: new Date(today.getTime() + DAY_MS)
      },
      employee: {
        isActive: true,
        whatsappConsent: true,
        importedAt: { lte: minAge }
      }
    },
    include: {
      employee: true,
      template: true
    },
    take: env.MESSAGE_BATCH_SIZE
  });

  let queued = 0;
  const missing = new Set<string>();

  for (const ev of events) {
    const template = ev.template?.isActive
      ? ev.template
      : await selectTemplate(
          ev.eventType,
          ev.employee.preferredLanguage,
          ev.yearsOfService
        );

    if (!template) {
      missing.add(
        `${ev.eventType} / ${ev.employee.preferredLanguage}`
      );
      continue;
    }

    await prisma.messageDelivery.upsert({
      where: {
        celebrationEventId: ev.id
      },
      create: {
        celebrationEventId: ev.id,
        employeeId: ev.employeeId,
        templateName: template.metaTemplateName,
        recipientPhoneMasked: maskPhone(ev.employee.mobile),
        status: 'QUEUED',
        queuedAt: new Date()
      },
      update: {}
    });

    await prisma.celebrationEvent.update({
      where: { id: ev.id },
      data: { status: 'QUEUED' }
    });

    queued++;
  }

  if (missing.size) {
    await raiseAlert(
      'NO_TEMPLATE',
      'No active message template',
      `Today's celebrations could not be queued because there is no active template for: ${[...missing].join(', ')}. Add or activate one under Message Templates.`
    );
  }

  return { queued, expired };
}

export async function processQueue() {
  const p = await provider();
  const mode = (await getWhatsAppConfig()).mode;
  const settings = await runtimeSettings();
  const today = todayInZone(settings.timezone);

  const rows = await prisma.messageDelivery.findMany({
    where: {
      status: 'QUEUED',
      OR: [
        { nextAttemptAt: null },
        { nextAttemptAt: { lte: new Date() } }
      ]
    },
    include: {
      employee: true,
      celebrationEvent: true
    },
    take: env.MESSAGE_BATCH_SIZE,
    orderBy: { createdAt: 'asc' }
  });

  let sent = 0;
  let failed = 0;
  const failures: string[] = [];
  let tokenProblem = false;

  const delayMs = Math.ceil(
    1000 / env.MESSAGE_RATE_PER_SECOND
  );

  for (const d of rows) {
    // Re-check eligibility immediately before sending.
    const employee = await prisma.employee.findFirst({
      where: {
        id: d.employeeId,
        isActive: true,
        whatsappConsent: true
      }
    });

    if (!employee) {
      await prisma.messageDelivery.update({
        where: { id: d.id },
        data: {
          status: 'CANCELLED',
          failureCode: 'EMPLOYEE_NOT_ELIGIBLE',
          failureReason: 'Employee is inactive or WhatsApp consent is missing'
        }
      });

      await audit(
        undefined,
        'MESSAGE_CANCELLED',
        'MessageDelivery',
        d.id,
        { reason: 'EMPLOYEE_NOT_ELIGIBLE' }
      );

      continue;
    }

    // Never send a celebration on a different date.
    const eventDate = d.celebrationEvent.eventDate;

    if (
      eventDate.getTime() < today.getTime() ||
      eventDate.getTime() >= today.getTime() + DAY_MS
    ) {
      await prisma.messageDelivery.update({
        where: { id: d.id },
        data: {
          status: 'CANCELLED',
          failureCode: 'INVALID_EVENT_DATE',
          failureReason: 'Celebration is not scheduled for today'
        }
      });

      continue;
    }

    if (
      mode === 'META_TEST' &&
      !(await isTestAllowed(employee.mobile))
    ) {
      await prisma.messageDelivery.update({
        where: { id: d.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          failureCode: 'TEST_RECIPIENT_BLOCKED',
          failureReason: 'Recipient is not in the test allowlist'
        }
      });

      failed++;
      continue;
    }

    // The queued template may have been deactivated since; pick the current one instead.
    let tpl = await prisma.messageTemplate.findFirst({
      where: {
        metaTemplateName: d.templateName,
        isActive: true
      }
    }) ?? await selectTemplate(
      d.celebrationEvent.eventType,
      employee.preferredLanguage,
      d.celebrationEvent.yearsOfService
    );

    if (!tpl) {
      await prisma.messageDelivery.update({
        where: { id: d.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          failureCode: 'NO_ACTIVE_TEMPLATE',
          failureReason: `No active ${d.celebrationEvent.eventType} template`
        }
      });

      failed++;
      continue;
    }

    const send = (t: NonNullable<typeof tpl>) => p.sendTemplateMessage({
      to: employee.mobile,
      templateName: t.metaTemplateName,
      language: t.metaTemplateLanguage,
      variables: templateVariables(
        t.variables,
        d.celebrationEvent.eventType,
        {
          firstName: employee.firstName,
          lastName: employee.lastName,
          fullName: employee.fullName,
          yearsOfService: d.celebrationEvent.yearsOfService
        }
      )
    });

    let result = await send(tpl);

    // 132001: this name/language is not approved on the WhatsApp account.
    // Try the other active templates for the same celebration type.
    if (String(result.errorCode ?? '') === '132001') {
      const others = await prisma.messageTemplate.findMany({
        where: {
          eventType: d.celebrationEvent.eventType,
          isActive: true,
          id: { not: tpl.id }
        },
        orderBy: { internalName: 'asc' }
      });

      for (const alt of others) {
        const retry = await send(alt);
        if (String(retry.errorCode ?? '') === '132001') continue;
        tpl = alt;
        result = retry;
        break;
      }
    }

    if (tpl.metaTemplateName !== d.templateName) {
      await prisma.messageDelivery.update({
        where: { id: d.id },
        data: { templateName: tpl.metaTemplateName }
      });
    }

    // Rate limited: put it back in the queue and stop this batch, since
    // every further request would be rejected too.
    if (RATE_LIMIT_ERRORS.has(String(result.errorCode ?? '')) && d.retryCount < 8) {
      await prisma.messageDelivery.update({
        where: { id: d.id },
        data: {
          status: 'QUEUED',
          failureCode: result.errorCode,
          failureReason: result.errorReason,
          retryCount: { increment: 1 },
          nextAttemptAt: new Date(Date.now() + Math.min(2 ** d.retryCount, 30) * 60000)
        }
      });

      break;
    }

    if (result.status === 'SENT') {
      await prisma.messageDelivery.update({
        where: { id: d.id },
        data: {
          status: 'SENT',
          metaMessageId: result.messageId,
          sentAt: new Date()
        }
      });

      await prisma.celebrationEvent.update({
        where: { id: d.celebrationEventId },
        data: { status: 'SENT' }
      });

      sent++;

      await audit(
        undefined,
        'MESSAGE_SENT',
        'MessageDelivery',
        d.id,
        { templateName: d.templateName }
      );

      if (mode === 'MOCK') {
        setTimeout(async () => {
          await prisma.messageDelivery.update({
            where: { id: d.id },
            data: {
              status: 'READ',
              deliveredAt: new Date(),
              readAt: new Date()
            }
          }).catch(() => {});
        }, 100);
      }
    } else {
      if (TOKEN_ERRORS.has(String(result.errorCode ?? ''))) {
        tokenProblem = true;
      }

      // Anything that is not a permanent error is retried automatically,
      // 15 minutes apart, up to 3 times.
      const permanent = PERMANENT_ERRORS.has(
        String(result.errorCode ?? '')
      );

      const nextRetry = d.retryCount + 1;

      if (!permanent && nextRetry <= AUTO_RETRIES) {
        const backoffMs = AUTO_RETRY_DELAY_MS;

        await prisma.messageDelivery.update({
          where: { id: d.id },
          data: {
            status: 'QUEUED',
            failureCode: result.errorCode,
            failureReason: result.errorReason,
            retryCount: { increment: 1 },
            nextAttemptAt: new Date(
              Date.now() + backoffMs
            )
          }
        });
      } else {
        await prisma.messageDelivery.update({
          where: { id: d.id },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            failureCode: result.errorCode,
            failureReason: result.errorReason,
            retryCount: { increment: 1 }
          }
        });

        failed++;

        failures.push(
          `${employee.fullName}: ${result.errorReason ?? result.errorCode ?? 'unknown error'}`
        );

        await audit(
          undefined,
          'MESSAGE_FAILED',
          'MessageDelivery',
          d.id,
          { code: result.errorCode }
        );
      }
    }

    if (delayMs > 0) {
      await new Promise(resolve =>
        setTimeout(resolve, delayMs)
      );
    }
  }

  if (tokenProblem) {
    await raiseAlert(
      'TOKEN_EXPIRED',
      'WhatsApp access token problem',
      'Meta rejected the access token (expired or revoked). No celebration messages can be sent until META_ACCESS_TOKEN is replaced on the server.'
    );
  }

  if (failures.length) {
    await raiseAlert(
      'SEND_FAILED',
      `${failures.length} celebration message(s) failed`,
      failures.join('\n')
    );
  }

  return { sent, failed };
}

export async function runDaily() {
  try {
    const a = await createEligibleEvents();
    const b = await queueApprovedEvents();
    const c = await processQueue();

    return { ...a, ...b, ...c };
  } catch (e: any) {
    await raiseAlert(
      'SCHEDULER_FAILED',
      'Daily celebration run failed',
      String(e?.stack ?? e)
    ).catch(() => {});

    throw e;
  }
}
