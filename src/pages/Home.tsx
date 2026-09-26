import { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header';
import FilterPanel from '../components/FilterPanel';
import VisualizationPanel from '../components/VisualizationPanel';
import MemoryCard from '../components/MemoryCard';
import EnvelopeCard from '../components/EnvelopeCard';
import MemoryModal from '../components/MemoryModal';
import { useMemoryStore } from '../store/memoryStore';
import type { Filters } from '../utils/helpers';
import { filterMemories } from '../utils/helpers';
import type { SmellMemory, Visibility } from '../utils/constants';
import type { MemoryInput } from '../store/memoryStore';
import { BookOpenCheck, Mailbox } from 'lucide-react';

const defaultFilters: Filters = {
  smellType: '',
  season: '',
  emotion: '',
  keyword: '',
};

interface SealedItem {
  id: string;
  visibility: Visibility;
  fails: number;
  locked: boolean;
}

export default function Home() {
  const {
    memories,
    envelopes,
    unlockedIds,
    initIfEmpty,
    addMemory,
    updateMemory,
    deleteMemory,
    tryUnlock,
    reseal,
  } = useMemoryStore();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SmellMemory | null>(null);

  useEffect(() => {
    initIfEmpty();
  }, [initIfEmpty]);

  // 当前可访问：公开 + 本次会话已解锁。未解锁记录不进入这里，
  // 因此筛选数量、图表、搜索都接触不到其任何字段。
  const accessible = useMemo(
    () =>
      memories.filter(
        (m) => m.visibility === 'public' || unlockedIds.includes(m.id),
      ),
    [memories, unlockedIds],
  );

  // 封套：非公开且未解锁，保留列表顺序；只取档位信息，不携带任何记忆内容
  const sealed = useMemo<SealedItem[]>(
    () =>
      memories
        .filter((m) => m.visibility !== 'public' && !unlockedIds.includes(m.id))
        .map((m) => ({
          id: m.id,
          visibility: m.visibility,
          fails: envelopes[m.id]?.fails ?? 0,
          locked: envelopes[m.id]?.locked ?? false,
        })),
    [memories, unlockedIds, envelopes],
  );

  const filteredMemories = useMemo(
    () => filterMemories(accessible, filters),
    [accessible, filters],
  );

  const hasFilter = !!(filters.smellType || filters.season || filters.emotion || filters.keyword);

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
  };
  const resetFilters = () => setFilters(defaultFilters);

  const openAddModal = () => { setEditing(null); setModalOpen(true); };
  const openEditModal = (m: SmellMemory) => { setEditing(m); setModalOpen(true); };

  const handleSubmit = async (data: MemoryInput, oldPasscode?: string) => {
    if (editing) {
      const res = await updateMemory(editing.id, data, oldPasscode);
      return res.ok ? undefined : res.error;
    }
    addMemory(data);
    return undefined;
  };

  const handleDelete = (id: string) => {
    const target = memories.find((m) => m.id === id);
    const msg = `确认删除「${target?.location ?? '这段记忆'}」吗？对应的封套也会一并清除。`;
    if (window.confirm(msg)) {
      deleteMemory(id);
      if (expandedId === id) setExpandedId(null);
    }
  };

  const scrollToCard = (id: string) => {
    setExpandedId(id);
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-memory-id="${id}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const handleUnlock = async (id: string, code: string) => {
    const res = await tryUnlock(id, code);
    if ('reason' in res) {
      if (res.reason === 'wrong' || res.reason === 'locked') {
        const { fails, locked } = res;
        return { ok: false as const, fails, locked };
      }
      return { ok: false as const, fails: 0, locked: false };
    }
    setExpandedId(id);
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-memory-id="${id}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return { ok: true as const, fails: 0, locked: false };
  };

  return (
    <div className="min-h-screen">
      <Header onAdd={openAddModal} memoryCount={accessible.length} />

      <main className="container max-w-6xl pb-20">
        <FilterPanel
          filters={filters}
          onChange={handleFilterChange}
          onReset={resetFilters}
          resultCount={filteredMemories.length}
        />

        <VisualizationPanel memories={filteredMemories} onSelect={scrollToCard} />

        <section className="mt-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-hand text-2xl text-ochre-600 flex items-center gap-2">
              <BookOpenCheck className="w-5 h-5" />
              气味档案
            </h2>
            <span className="text-xs text-ink-700/50">
              点击卡片展开完整回忆
            </span>
          </div>

          {filteredMemories.length === 0 ? (
            <div className="bg-paper-50/70 backdrop-blur rounded-3xl border-2 border-dashed border-paper-400 py-20 text-center">
              <div className="text-6xl mb-4 select-none">🍂</div>
              <h3 className="font-serif text-2xl text-ink-800 mb-2">
                {hasFilter ? '没有匹配的气味记忆' : '还没有封存任何气味'}
              </h3>
              <p className="text-ink-700/60 max-w-md mx-auto mb-6">
                {hasFilter
                  ? '换一组筛选条件试试？或者先封存一段新的气味'
                  : '空气中一定有让你难忘的味道——无论是衣柜里的樟木香，还是雨后操场的青草气'}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button onClick={openAddModal} className="btn-primary">
                  封存第一段气味
                </button>
                {hasFilter && (
                  <button onClick={resetFilters} className="btn-secondary">
                    清除筛选条件
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="masonry-grid">
              {filteredMemories.map((m, idx) => (
                <div key={m.id} data-memory-id={m.id}>
                  <MemoryCard
                    memory={m}
                    index={idx}
                    isExpanded={expandedId === m.id}
                    onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
                    onEdit={() => openEditModal(m)}
                    onDelete={() => handleDelete(m.id)}
                    onReseal={() => {
                      reseal(m.id);
                      if (expandedId === m.id) setExpandedId(null);
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {sealed.length > 0 && (
          <section className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-hand text-2xl text-brick-500 flex items-center gap-2">
                <Mailbox className="w-5 h-5" />
                封套
              </h2>
              <span className="text-xs text-ink-700/50">
                {sealed.length} 张未展开 · 不参与筛选与统计
              </span>
            </div>
            <div className="masonry-grid">
              {sealed.map((s) => (
                <div key={s.id} data-envelope-id={s.id}>
                  <EnvelopeCard
                    visibility={s.visibility}
                    fails={s.fails}
                    locked={s.locked}
                    onUnlock={(code) => handleUnlock(s.id, code)}
                  />
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="pb-10 pt-4 text-center text-xs text-ink-700/40 font-hand text-lg">
        <p>愿每一缕气味，都是打开旧时光的钥匙 · Scent Archive</p>
      </footer>

      <MemoryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        editingData={editing}
      />
    </div>
  );
}
