// 真实 store 集成测试：可见范围 / 锁定 / 校验 / 持久化 / 删除联动
import { useMemoryStore } from '../src/store/memoryStore';
import { hashPasscode } from '../src/utils/passcode';
import type { MemoryInput } from '../src/store/memoryStore';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let pass = 0;
let fail = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { pass++; console.log('  ✓', msg); }
  else { fail++; console.error('  ✗', msg); process.exitCode = 1; }
}

const base: MemoryInput = {
  location: '测试地点',
  source_guess: '测试来源',
  intensity: 6,
  humidity: 5,
  season: 'autumn',
  smell_type: 'woody',
  memory_text: '秘密回忆正文',
  color_association: '#8B5A2B',
  emotion: 'nostalgic',
  want_again: true,
  visibility: 'family',
  passcode_hash: undefined,
};

async function main() {
  const s = useMemoryStore.getState;
  // 干净起手
  localStorage.clear();
  useMemoryStore.setState({ memories: [], envelopes: {}, unlockedIds: [] });

  console.log('1) 新建受保护记忆：自动解锁，本地无明文');
  const h = await hashPasscode('2468');
  const id = s().addMemory({ ...base, visibility: 'private', passcode_hash: h });
  assert(s().isUnlocked(id), '新建后本次会话为展开状态');
  const raw = localStorage.getItem('scent-memory-storage')!;
  assert(!raw.includes('2468'), 'localStorage 中不出现明文口令');
  assert(raw.includes('passcode_hash'), 'localStorage 中保存的是哈希');

  console.log('2) 刷新（仅恢复持久化字段）后重新封套');
  const persisted = JSON.parse(raw).state;
  useMemoryStore.setState({
    memories: persisted.memories,
    envelopes: persisted.envelopes,
    unlockedIds: [], // 会话态丢弃
  });
  assert(!s().isUnlocked(id), '重开页面后未解锁');

  console.log('3) 错两次不锁，第三次锁定');
  await s().tryUnlock(id, '0000');
  await s().tryUnlock(id, '1111');
  assert(!s().getEnvelope(id).locked, '错两次尚未锁定');
  const third = await s().tryUnlock(id, '9999');
  assert(!third.ok && third.reason === 'wrong' && third.locked, '第三次错误后锁定');
  assert(s().getEnvelope(id).locked, 'store 中为锁定态');

  console.log('4) 锁定持久化（重开页面仍锁定）');
  const raw2 = localStorage.getItem('scent-memory-storage')!;
  const persisted2 = JSON.parse(raw2).state;
  assert(persisted2.envelopes[id]?.locked === true, '锁定标记已持久化');
  useMemoryStore.setState({
    memories: persisted2.memories,
    envelopes: persisted2.envelopes,
    unlockedIds: [],
  });

  console.log('5) 锁定后错误口令不解除也不再计数；正确口令解除');
  const wrongLocked = await s().tryUnlock(id, '0000');
  assert(wrongLocked.ok === false && wrongLocked.reason === 'locked', '锁定态错误口令被拒');
  assert(s().getEnvelope(id).fails === 3, '错误口令不增加计数');
  const okUnlock = await s().tryUnlock(id, '2468');
  assert(okUnlock.ok, '正确口令解除锁定并展开');
  assert(s().isUnlocked(id), '已解锁');
  assert(s().getEnvelope(id).fails === 0, '失败计数清零');

  console.log('6) 改可见范围/口令：需核验旧口令');
  const newH = await hashPasscode('8888');
  const bad = await s().updateMemory(id, { ...base, visibility: 'private', passcode_hash: newH }, '0000');
  assert(!bad.ok, '旧口令错误时拒绝修改');
  const none = await s().updateMemory(id, { ...base, visibility: 'private', passcode_hash: newH });
  assert(!none.ok, '未提供旧口令时拒绝修改');
  const good = await s().updateMemory(id, { ...base, visibility: 'private', passcode_hash: newH }, '2468');
  assert(good.ok, '旧口令正确时允许修改');
  const verifyNew = await s().tryUnlock === null ? null : null;
  void verifyNew;
  // 换口令后已重置封套且会话内展开；重新封套后用新口令验证
  s().reseal(id);
  assert((await s().tryUnlock(id, '2468')).ok === false, '旧口令已失效');
  assert((await s().tryUnlock(id, '8888')).ok, '新口令可用');

  console.log('7) 降为公开：无需口令，封套清除');
  const pub = await s().updateMemory(id, { ...base, visibility: 'public', passcode_hash: undefined }, '8888');
  assert(pub.ok, '降为公开成功');
  assert(s().envelopes[id] === undefined, '封套状态被移除');
  assert(!s().unlockedIds.includes(id), '解锁态被移除（公开无需解锁）');

  console.log('8) 删除记录：封套一起清掉');
  // 重新做一个锁定的
  const id2 = s().addMemory({ ...base, location: '将删', visibility: 'family', passcode_hash: h });
  s().reseal(id2);
  await s().tryUnlock(id2, '0000'); await s().tryUnlock(id2, '0000'); await s().tryUnlock(id2, '0000');
  assert(s().envelopes[id2]?.locked, '前置：第二条已锁定');
  s().deleteMemory(id2);
  assert(!s().memories.find((m) => m.id === id2), '记忆已删除');
  assert(s().envelopes[id2] === undefined, '封套一并清除');

  console.log('9) 筛选/统计只碰可访问数据（由 Home 的 accessible 派生保证）');
  const fam = s().addMemory({ ...base, location: '封套中的秘密', visibility: 'family', passcode_hash: h });
  s().reseal(fam);
  const accessible = s().memories.filter(
    (m) => m.visibility === 'public' || s().isUnlocked(m.id),
  );
  assert(!accessible.find((m) => m.id === fam), '未解锁记录不在可访问集合内');
  const rawLeak = JSON.stringify(accessible);
  assert(!rawLeak.includes('封套中的秘密'), '可访问数据中不泄露未解锁内容');

  console.log(`10) 哈希一致性：正确口令命中，错误不命中`);
  assert((await hashPasscode('2468')) === h, '相同口令哈希稳定');
  assert((await hashPasscode('2467')) !== h, '不同口令哈希不同');

  await sleep(10);
  console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
}
main();
