import bcrypt from "bcrypt";

const ROUNDS = 10;
const LEGACY_PREFIX = "legacy:";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, stored: string): Promise<{
  ok: boolean;
  isLegacy: boolean;
}> {
  if (stored.startsWith(LEGACY_PREFIX)) {
    return {
      ok: stored.slice(LEGACY_PREFIX.length) === plain,
      isLegacy: true,
    };
  }
  return { ok: await bcrypt.compare(plain, stored), isLegacy: false };
}
