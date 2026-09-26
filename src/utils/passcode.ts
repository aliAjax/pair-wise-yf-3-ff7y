/**
 * 口令相关：仅保存加盐 SHA-256 哈希，localStorage 中不落明文。
 * 说明：这是本地单机应用的防窥措施，不构成真正的密码学安全边界。
 */

const SALT = 'scent-archive-v1';
export const PASSCODE_MIN = 4;
export const PASSCODE_MAX = 6;
export const MAX_FAILS = 3;

/** 口令必须是 4-6 位纯数字 */
export function isPasscodeValid(code: string): boolean {
  return new RegExp(`^\\d{${PASSCODE_MIN},${PASSCODE_MAX}}$`).test(code);
}

export function passcodeRuleHint(): string {
  return `口令为 ${PASSCODE_MIN}-${PASSCODE_MAX} 位数字`;
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  if (globalThis.crypto?.subtle) {
    const buf = await globalThis.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // 非安全上下文（http 且非 localhost）下的兜底，不依赖外部库
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `fallback-${h.toString(16).padStart(8, '0')}`;
}

export async function hashPasscode(code: string): Promise<string> {
  return sha256(`${SALT}:${code}`);
}

export async function verifyPasscode(code: string, hash: string | undefined): Promise<boolean> {
  if (!hash) return false;
  return (await sha256(`${SALT}:${code}`)) === hash;
}
