import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SmellMemory, Season, SmellType, Emotion, Visibility, EnvelopeRecord } from '../utils/constants';
import { generateId } from '../utils/helpers';
import { hashPasscode } from '../utils/privacy';
import { mockMemories, mockEnvelopes } from '../data/mockData';

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
}

/** 弹窗提交安全设置时的参数：新口令可选（范围不变时可留空） */
export interface SecuritySubmit {
  visibility: Visibility;
  newPasscode?: string;
  /** 编辑受保护记录时必须提供旧口令 */
  oldPasscode?: string;
}

export type UnlockResult = 'ok' | 'wrong' | 'locked' | 'not-found';
export type SecuritySaveResult = 'ok' | 'wrong-old' | 'bad-passcode' | 'not-found';

interface PersistedState {
  memories: SmellMemory[];
  envelopes: Record<string, EnvelopeRecord>;
}

interface MemoryStore extends PersistedState {
  /** 本次会话已解封的记忆 id；只存内存，重开页面即清空（重新封套） */
  unlocked: string[];
  addMemory: (input: MemoryInput, passcode?: string) => Promise<string>;
  /** 只更新内容字段，不动可见范围与封套 */
  updateMemoryContent: (id: string, input: MemoryInput) => void;
  /** 调整可见范围 / 口令：旧记录若原本受保护，必须先核旧口令 */
  saveVisibility: (id: string, submit: SecuritySubmit) => Promise<SecuritySaveResult>;
  deleteMemory: (id: string) => void;
  tryUnlockEnvelope: (id: string, passcode: string) => Promise<UnlockResult>;
  initIfEmpty: () => void;
}

function isProtected(v: Visibility) {
  return v !== 'public';
}

export const useMemoryStore = create<MemoryStore>()(
  persist(
    (set, get) => ({
      memories: [],
      envelopes: {},
      unlocked: [],

      addMemory: async (input, passcode) => {
        const now = new Date().toISOString();
        const id = generateId();
        const newMem: SmellMemory = { id, ...input, created_at: now, updated_at: now };
        const envelopes = { ...get().envelopes };
        if (isProtected(input.visibility)) {
          envelopes[id] = {
            passcodeHash: await hashPasscode(passcode ?? ''),
            fails: 0,
            locked: false,
          };
        }
        set({ memories: [newMem, ...get().memories], envelopes });
        return id;
      },

      updateMemoryContent: (id, input) => {
        set({
          memories: get().memories.map((m) =>
            m.id === id
              ? {
                  ...m,
                  location: input.location,
                  source_guess: input.source_guess,
                  intensity: input.intensity,
                  humidity: input.humidity,
                  season: input.season,
                  smell_type: input.smell_type,
                  memory_text: input.memory_text,
                  color_association: input.color_association,
                  emotion: input.emotion,
                  want_again: input.want_again,
                  visibility: input.visibility,
                  updated_at: new Date().toISOString(),
                }
              : m,
          ),
        });
      },

      saveVisibility: async (id, { visibility, newPasscode, oldPasscode }) => {
        const mem = get().memories.find((m) => m.id === id);
        if (!mem) return 'not-found';
        const env = get().envelopes[id];
        // 原本受保护：先核旧口令
        if (env) {
          const ok = await hashPasscode(oldPasscode ?? '') === env.passcodeHash;
          if (!ok) return 'wrong-old';
        }
        const envelopes = { ...get().envelopes };
        if (isProtected(visibility)) {
          if (newPasscode) {
            envelopes[id] = { passcodeHash: await hashPasscode(newPasscode), fails: 0, locked: false };
          } else if (!envelopes[id]) {
            // 公开 → 受保护却没给口令：调用方应先拦截，这里兜底
            return 'bad-passcode';
          }
          // 改范围时清掉旧的错误计数与锁定
          if (envelopes[id]) envelopes[id] = { ...envelopes[id]!, fails: 0, locked: false };
        } else {
          // 转为公开：封套一起移除
          delete envelopes[id];
        }
        set({
          memories: get().memories.map((m) =>
            m.id === id ? { ...m, visibility, updated_at: new Date().toISOString() } : m,
          ),
          envelopes,
          // 仍受保护时保持本次解封态；转公开则从解封列表移除（已无封套）
          unlocked: isProtected(visibility)
            ? Array.from(new Set([...get().unlocked, id]))
            : get().unlocked.filter((x) => x !== id),
        });
        return 'ok';
      },

      deleteMemory: (id) => {
        const envelopes = { ...get().envelopes };
        delete envelopes[id];
        set({
          memories: get().memories.filter((m) => m.id !== id),
          envelopes,
          unlocked: get().unlocked.filter((x) => x !== id),
        });
      },

      tryUnlockEnvelope: async (id, passcode) => {
        const env = get().envelopes[id];
        if (!env) return 'not-found';
        // 已锁定：只能用正确口令解除；错误口令继续保持锁定
        if (env.locked) {
          const ok = await hashPasscode(passcode) === env.passcodeHash;
          if (!ok) return 'locked';
        } else {
          const ok = await hashPasscode(passcode) === env.passcodeHash;
          if (!ok) {
            const fails = env.fails + 1;
            const locked = fails >= 3;
            const envelopes = { ...get().envelopes, [id]: { ...env, fails, locked } };
            set({ envelopes });
            return locked ? 'locked' : 'wrong';
          }
        }
        // 口令正确：解封并清除错误计数 / 锁定
        const envelopes = { ...get().envelopes, [id]: { ...env, fails: 0, locked: false } };
        set({ envelopes, unlocked: Array.from(new Set([...get().unlocked, id])) });
        return 'ok';
      },

      initIfEmpty: () => {
        if (get().memories.length === 0) {
          set({ memories: mockMemories, envelopes: mockEnvelopes });
        }
      },
    }),
    {
      name: 'scent-memory-storage',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // unlocked 只保留在内存中，重开页面后封套重新锁上
      partialize: (state): PersistedState => ({
        memories: state.memories,
        envelopes: state.envelopes,
      }),
      migrate: (persisted) => {
        const state = persisted as Partial<PersistedState> | undefined;
        if (state && Array.isArray(state.memories)) {
          state.memories = state.memories.map((m) =>
            m.visibility ? m : { ...m, visibility: 'public' as Visibility },
          );
        }
        return state as PersistedState;
      },
    },
  ),
);
