import { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header';
import FilterPanel from '../components/FilterPanel';
import VisualizationPanel from '../components/VisualizationPanel';
import MemoryCard from '../components/MemoryCard';
import EnvelopeCard from '../components/EnvelopeCard';
import MemoryModal from '../components/MemoryModal';
import { useMemoryStore } from '../store/memoryStore';
import type { MemoryInput, SecuritySubmit, UnlockResult } from '../store/memoryStore';
import { filterMemories, getVisibleMemories, getSealedMemories } from '../utils/helpers';
import type { Filters } from '../utils/helpers';
import type { SmellMemory } from '../utils/constants';
import { BookOpenCheck, Lock } from 'lucide-react';

const defaultFilters: Filters = {
  smellType: '',
  season: '',
  emotion: '',
  keyword: '',
};

export default function Home() {
  const {
    memories, envelopes, unlocked,
    initIfEmpty, addMemory, updateMemoryContent, saveVisibility,
    deleteMemory, tryUnlockEnvelope,
  } = useMemoryStore();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SmellMemory | null>(null);

  useEffect(() => {
    initIfEmpty();
  }, [initIfEmpty]);

  // 可见集合 = 公开记忆 + 本次会话已解封的记忆。
  // 下游的筛选数量、图表、搜索全部只接触这个集合。
  const visibleMemories = useMemo(
    () => getVisibleMemories(memories, unlocked),
    [memories, unlocked],
  );
  const filteredMemories = useMemo(
    () => filterMemories(visibleMemories, filters),
    [visibleMemories, filters],
  );
  // 未解封的封套：默认视图单独陈列；筛选/搜索时完全不出现
  const sealedMemories = useMemo(
    () => getSealedMemories(memories, unlocked),
    [memories, unlocked],
  );

  const hasActiveFilter = !!(filters.smellType || filters.season || filters.emotion || filters.keyword.trim());

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
  };
  const resetFilters = () => setFilters(defaultFilters);

  const openAddModal = () => { setEditing(null); setModalOpen(true); };
  const openEditModal = (m: SmellMemory) => { setEditing(m); setModalOpen(true); };

  const handleSubmit = async (data: MemoryInput, security: SecuritySubmit): Promise<boolean> => {
    if (editing) {
      // 只有调整了可见范围或口令时才需要核验旧口令；只改内容不动封套
      const securityChanged =
        security.visibility !== editing.visibility || !!security.newPasscode;
      if (securityChanged) {
        const result = await saveVisibility(editing.id, security);
        if (result !== 'ok') return false;
      }
      updateMemoryContent(editing.id, data);
      return true;
    }
    await addMemory(data, security.newPasscode);
    return true;
  };

  const handleDelete = (id: string) => {
    const target = memories.find((m) => m.id === id);
    const msg = `确认删除「${target?.location ?? '这段记忆'}」吗？对应的封套与口令也会一起清除。`;
    if (window.confirm(msg)) {
      deleteMemory(id);
      if (expandedId === id) setExpandedId(null);
    }
  };

  const handleUnlock = async (id: string, passcode: string): Promise<UnlockResult> => {
    const result = await tryUnlockEnvelope(id, passcode);
    if (result === 'ok') {
      // 解封后卡片才挂载，稍等一帧再展开并滚动定位
      window.setTimeout(() => {
        setExpandedId(id);
        requestAnimationFrame(() => {
          const el = document.querySelector(`[data-memory-id="${id}"]`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }, 150);
    }
    return result;
  };

  const scrollToCard = (id: string) => {
    setExpandedId(id);
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-memory-id="${id}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const noFilterMatch = visibleMemories.length > 0 && filteredMemories.length === 0 && hasActiveFilter;
  const totallyEmpty = memories.length === 0;

  return (
    <div className="min-h-screen">
      <Header onAdd={openAddModal} memoryCount={visibleMemories.length} sealedCount={sealedMemories.length} />

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

          {totallyEmpty ? (
            <div className="bg-paper-50/70 backdrop-blur rounded-3xl border-2 border-dashed border-paper-400 py-20 text-center">
              <div className="text-6xl mb-4 select-none">🍂</div>
              <h3 className="font-serif text-2xl text-ink-800 mb-2">还没有封存任何气味</h3>
              <p className="text-ink-700/60 max-w-md mx-auto mb-6">
                空气中一定有让你难忘的味道——无论是衣柜里的樟木香，还是雨后操场的青草气
              </p>
              <button onClick={openAddModal} className="btn-primary">
                封存第一段气味
              </button>
            </div>
          ) : (
            <>
              {filteredMemories.length > 0 && (
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
                      />
                    </div>
                  ))}
                </div>
              )}

              {noFilterMatch && (
                <div className="bg-paper-50/70 backdrop-blur rounded-3xl border-2 border-dashed border-paper-400 py-14 text-center">
                  <div className="text-5xl mb-3 select-none">🔍</div>
                  <h3 className="font-serif text-xl text-ink-800 mb-2">没有匹配的气味记忆</h3>
                  <p className="text-ink-700/60 max-w-md mx-auto mb-5 text-sm">
                    换一组筛选条件试试？封在封套里的记忆需先在主页输入口令解封，才会参与筛选与搜索。
                  </p>
                  <button onClick={resetFilters} className="btn-secondary">
                    清除筛选条件
                  </button>
                </div>
              )}

              {/* 封套区：仅在没有筛选/搜索时陈列，且不暴露任何记忆内容 */}
              {!hasActiveFilter && sealedMemories.length > 0 && (
                <div className="mt-8">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-hand text-xl text-lavender-600 flex items-center gap-2">
                      <Lock className="w-5 h-5" />
                      封套中的记忆
                    </h3>
                  </div>
                  <p className="text-xs text-ink-700/50 mb-4">
                    这些记忆已上锁，主页、筛选与图表中都看不到内容；输入对应口令后本次会话可展开，重开页面会重新封上。
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {sealedMemories.map((m) => (
                      <EnvelopeCard
                        key={m.id}
                        id={m.id}
                        visibility={m.visibility}
                        envelope={envelopes[m.id] ?? { passcodeHash: '', fails: 0, locked: false }}
                        onUnlock={handleUnlock}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
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
