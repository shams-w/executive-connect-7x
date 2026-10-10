import { prisma } from '../db.js';
import { testAllowedNumbers } from '../config/env.js';

export function testRecipientAllowed(mode:'MOCK'|'META_TEST'|'META_PRODUCTION',phone:string,allowlist:Set<string>):boolean{
  return mode!=='META_TEST'||allowlist.has(phone);
}
export async function getTestAllowlist(): Promise<Set<string>> {
  const merged = new Set(testAllowedNumbers);
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key: 'TEST_ALLOWED_NUMBERS' } });
    const list = Array.isArray(row?.value) ? row?.value : [];
    for (const value of list as unknown[]) {
      const phone = String(value).trim();
      if (phone) merged.add(phone);
    }
  } catch {
    // Environment allowlist remains the safe fallback if DB is unavailable.
  }
  return merged;
}
export async function isTestAllowed(phone: string): Promise<boolean> {
  const allowlist = await getTestAllowlist();
  return allowlist.has(phone);
}
