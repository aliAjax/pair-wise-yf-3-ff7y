import { create, type StateCreator } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SmellMemory, Season, SmellType, Emotion, Visibility } from '../utils/constants';
import { generateId } from '../utils/helpers';
import { mockMemories } from '../data/mockData';
import { verifyPasscode, MAX_FAILS } from '../utils/passcode';

export interface MemoryInput {
  location: string;
  source_guess: string;
  intensity: number;
  humidity: number;
  season: Season;
  smell_type: SmellType;
  memory_text: string;
  color_association: string;
  emotion: Emotion;
  want_again: boolean;
  visibility: Visibility;
  /** 新建时为口令的加盐哈希；公开记录为 undefined */
  passcode_hash?: string;
}

/** 封套状态：连续失败次数与锁定标记，随 localStorage 持久化 */
export interface EnvelopeState {
  fails: number;
  locked: boolean;
}

export type UnlockResult =
  | { ok: true }
  | { ok: false; reason: 'locked' | 'wrong'; fails: number; locked: boolean }
  | { ok: false; reason: 'not-found' | 'public' };

interface MemoryStore {
  memories: SmellMemory[];
  envelopes: Record<string, EnvelopeState>;
  /** 已解锁的卡片 id，只存在于当前会话，刷新后重新封套 */
  unlockedIds: string[];

  addMemory: (input: MemoryInput) => string;
  updateMemory: (
    id: string,
    input: MemoryInput,
    oldPasscode?: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  deleteMemory: (id: string) => void;
  /** 尝试展开封套；连续输错 MAX_FAILS 次后锁定，锁定后只能用正确口令解除 */
  tryUnlock: (id: string, code: string) => Promise<UnlockResult>;
  /** 重新封套（不清除内容，只是本次会话收起） */
  reseal: (id: string) => void;
  isUnlocked: (id: string) => boolean;
  getEnvelope: (id: string) => EnvelopeState;
  initIfEmpty: () => void;
}

function getMem(memories: SmellMemory[], id: string) {
  return memories.find((m) => m.id === id);
}

const baseCreator: StateCreator<MemoryStore, [], [], MemoryStore> = (set, get) => ({
  memories: [],
  envelopes: {},
  unlockedIds: [],

  addMemory: (input) => {
    const now = new Date().toISOString();
    const id = generateId();
    const newMem: SmellMemory = {
      id,
      ...input,
      created_at: now,
      updated_at: now,
    };
    set({ memories: [newMem, ...get().memories] });
    // 新建者刚输入过口令，本次会话直接展开
    if (input.visibility !== 'public' && !get().unlockedIds.includes(id)) {
      set({ unlockedIds: [id, ...get().unlockedIds] });
    }
    return id;
  },

  updateMemory: async (id, input, oldPasscode) => {
    const target = getMem(get().memories, id);
    if (!target) return { ok: false, error: '记录不存在' };

    const settingsChanged =
      target.visibility !== input.visibility ||
      (target.passcode_hash ?? '') !== (input.passcode_hash ?? '');

    // 调整可见范围或口令前，先核旧口令
    if (settingsChanged && target.visibility !== 'public') {
      if (!oldPasscode) return { ok: false, error: '请先输入原口令以核验身份' };
      const passed = await verifyPasscode(oldPasscode, target.passcode_hash);
      if (!passed) return { ok: false, error: '原口令不正确，无法修改' };
    }

    const envelopes = { ...get().envelopes };
    let unlockedIds = get().unlockedIds;

    if (input.visibility === 'public') {
      // 降为公开：封套随之失效
      delete envelopes[id];
      unlockedIds = unlockedIds.filter((x) => x !== id);
    } else if (settingsChanged) {
      // 换了档位或口令：重置失败计数与锁定，本次会话保持展开
      delete envelopes[id];
      if (!unlockedIds.includes(id)) unlockedIds = [id, ...unlockedIds];
    }

    set({
      memories: get()
        .memories.map((m) =>
          m.id === id ? { ...m, ...input, updated_at: new Date().toISOString() } : m,
        ),
      envelopes,
      unlockedIds,
    });
    return { ok: true };
  },

  deleteMemory: (id) => {
    // 移除记录时封套一起清掉
    const envelopes = { ...get().envelopes };
    delete envelopes[id];
    set({
      memories: get().memories.filter((m) => m.id !== id),
      envelopes,
      unlockedIds: get().unlockedIds.filter((x) => x !== id),
    });
  },

  tryUnlock: async (id, code) => {
    const mem = getMem(get().memories, id);
    if (!mem) return { ok: false, reason: 'not-found' };
    if (mem.visibility === 'public') return { ok: false, reason: 'public' };

    const env = get().envelopes[id] ?? { fails: 0, locked: false };

    // 锁定后：错误口令一律拒绝且不再计数，只有正确口令能解除
    if (env.locked) {
      const passed = await verifyPasscode(code, mem.passcode_hash);
      if (!passed) {
        return { ok: false, reason: 'locked', fails: env.fails, locked: true };
      }
      const envelopes = { ...get().envelopes };
      delete envelopes[id];
      set({
        envelopes,
        unlockedIds: [id, ...get().unlockedIds.filter((x) => x !== id)],
      });
      return { ok: true };
    }

    const passed = await verifyPasscode(code, mem.passcode_hash);
    if (passed) {
      const envelopes = { ...get().envelopes };
      delete envelopes[id];
      set({
        envelopes,
        unlockedIds: [id, ...get().unlockedIds.filter((x) => x !== id)],
      });
      return { ok: true };
    }

    const fails = env.fails + 1;
    const locked = fails >= MAX_FAILS;
    set({
      envelopes: { ...get().envelopes, [id]: { fails, locked } },
    });
    return { ok: false, reason: 'wrong', fails, locked };
  },

  reseal: (id) => {
    set({ unlockedIds: get().unlockedIds.filter((x) => x !== id) });
  },

  isUnlocked: (id) => get().unlockedIds.includes(id),
  getEnvelope: (id) => get().envelopes[id] ?? { fails: 0, locked: false },

  initIfEmpty: () => {
    if (get().memories.length === 0) {
      set({ memories: mockMemories });
    }
  },
});

export const useMemoryStore = create<MemoryStore>()(
  persist(baseCreator, {
    name: 'scent-memory-storage',
    version: 2,
    storage: createJSONStorage(() => localStorage),
    // 解锁态仅保活于当前会话；刷新页面后恢复封套
    partialize: (state) => ({
      memories: state.memories,
      envelopes: state.envelopes,
    }),
    migrate: (persisted) => {
      const state = (persisted ?? {}) as Partial<MemoryStore>;
      const memories = (state.memories ?? []).map((m) =>
        m.visibility ? m : { ...m, visibility: 'public' as Visibility },
      );
      return {
        memories,
        envelopes: state.envelopes ?? {},
      } as Partial<MemoryStore>;
    },
  }),
);
