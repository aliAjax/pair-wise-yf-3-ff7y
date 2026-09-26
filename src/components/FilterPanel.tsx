import { RotateCcw, Search, X } from 'lucide-react';
import { SEASONS, SMELL_TYPES, EMOTIONS } from '../utils/constants';
import type { Filters } from '../utils/helpers';

interface Props {
  filters: Filters;
  onChange: (key: keyof Filters, value: string) => void;
  onReset: () => void;
  resultCount: number;
}

function makeSelectClass(active: boolean) {
  return `appearance-none rounded-xl px-4 py-2.5 pr-10 border text-sm font-medium transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-ochre-400 ${
    active
      ? 'bg-ochre-500 text-paper-50 border-ochre-600 shadow-paper'
      : 'bg-paper-50 text-ink-800 border-paper-300 hover:bg-paper-100 hover:border-paper-400'
  }`;
}

function chevron(active: boolean) {
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23${active ? 'FBF7EE' : '8B5A2B'}' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`;
}

export default function FilterPanel({ filters, onChange, onReset, resultCount }: Props) {
  const hasFilter = !!(filters.smellType || filters.season || filters.emotion || filters.keyword.trim());

  return (
    <section className="container max-w-6xl mb-6">
      <div className="bg-paper-50/70 backdrop-blur rounded-2xl border border-paper-300 p-4 md:p-5 shadow-paper">
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
          <div className="flex items-center gap-2 md:w-28 shrink-0">
            <span className="font-hand text-xl text-ochre-600">筛选</span>
            <span className="text-xs text-ink-700/50">· {resultCount} 条匹配</span>
          </div>

          <div className="flex-1 flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-auto sm:min-w-[220px] sm:flex-1 sm:max-w-xs">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ochre-600/60 pointer-events-none" />
              <input
                type="text"
                value={filters.keyword}
                onChange={(e) => onChange('keyword', e.target.value)}
                placeholder="搜索地点、来源或记忆正文…"
                className="scent-input pl-9 pr-8 py-2.5"
              />
              {filters.keyword && (
                <button
                  type="button"
                  onClick={() => onChange('keyword', '')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-ink-700/40 hover:text-ink-800 hover:bg-paper-200 transition-colors"
                  aria-label="清除搜索"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="relative">
              <select
                value={filters.smellType}
                onChange={(e) => onChange('smellType', e.target.value)}
                className={`${makeSelectClass(!!filters.smellType)} w-full sm:w-auto`}
                style={{
                  backgroundImage: chevron(!!filters.smellType),
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                }}
              >
                <option value="">全部气味类型</option>
                {SMELL_TYPES.map((t) => (
                  <option key={t.value} value={t.value} className="bg-paper-50 text-ink-800">
                    {t.emoji} {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <select
                value={filters.season}
                onChange={(e) => onChange('season', e.target.value)}
                className={`${makeSelectClass(!!filters.season)} w-full sm:w-auto`}
                style={{
                  backgroundImage: chevron(!!filters.season),
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                }}
              >
                <option value="">全部季节</option>
                {SEASONS.map((s) => (
                  <option key={s.value} value={s.value} className="bg-paper-50 text-ink-800">
                    {s.emoji} {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <select
                value={filters.emotion}
                onChange={(e) => onChange('emotion', e.target.value)}
                className={`${makeSelectClass(!!filters.emotion)} w-full sm:w-auto`}
                style={{
                  backgroundImage: chevron(!!filters.emotion),
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                }}
              >
                <option value="">全部情绪</option>
                {EMOTIONS.map((e) => (
                  <option key={e.value} value={e.value} className="bg-paper-50 text-ink-800">
                    {e.emoji} {e.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={onReset}
            disabled={!hasFilter}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              hasFilter
                ? 'bg-brick-500 hover:bg-brick-600 text-paper-50 shadow-paper hover:-translate-y-0.5'
                : 'bg-paper-200/50 text-ink-700/40 cursor-not-allowed'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            重置
          </button>
        </div>
      </div>
    </section>
  );
}
