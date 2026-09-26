/**
 * 封套口令工具。
 * 说明：这是纯前端的"防家人随手翻看"级别的保护，不是安全加密——
 * 同设备的人仍可直接读 localStorage。口令经 SHA-256 加盐哈希后存储，
 * 避免明文被一眼看到。
 */

const PEPPER = 'scent-archive-v1';

export async function hashPasscode(passcode: string): Promise<string> {
  const data = new TextEncoder().encode(`${PEPPER}::${passcode}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** 口令必须是 4-6 位数字 */
export function isValidPasscodeFormat(passcode: string): boolean {
  return /^\d{4,6}$/.test(passcode);
}

export const PASSCODE_PATTERN_HINT = '4-6 位数字';

/** 供模拟数据使用的预计算哈希，保持与 hashPasscode 相同算法 */
export const PRECOMPUTED_HASHES: Record<string, string> = {
  '1234': '2c799407373575a5cf7f237b79528e3798ea293ffb1cdb5a9fb787c640fbf51d',
  '2468': 'b0d3253d832d76827706f8917ce0a62246d180242abb5f18674b6f30b79e69ec',
};
