import { useState } from 'react';
import { Lock, LockKeyhole, Eye, EyeOff } from 'lucide-react';
import type { Visibility } from '../utils/constants';
import { getVisibilityInfo } from '../utils/constants';
import { MAX_FAILS } from '../utils/passcode';

interface Props {
  visibility: Visibility;
  fails: number;
  locked: boolean;
  onUnlock: (code: string) => Promise<{ ok: boolean; fails: number; locked: boolean }>;
}

export default function EnvelopeCard({ visibility, fails, locked, onUnlock }: Props) {
  const info = getVisibilityInfo(visibility);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showCode, setShowCode] = useState(false);

  const remaining = MAX_FAILS - fails;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!/^\d+$/.test(code)) {
      setError('口令只能包含数字');
      return;
    }
    setBusy(true);
    setError('');
    const res = await onUnlock(code);
    setBusy(false);
    if (!res.ok) {
      if (res.locked) {
        setError('封套已锁定。输入正确口令即可解除');
      } else {
        setError(
          res.fails >= MAX_FAILS
            ? '已连续输错三次，封套进入锁定'
            : `口令不正确，还可尝试 ${MAX_FAILS - res.fails} 次`,
        );
      }
      setCode('');
    }
  };

  return (
    <article
      className="group relative bg-paper-100/80 rounded-2xl border-2 border-dashed border-paper-400 shadow-card overflow-hidden animate-fadeInUp"
      data-envelope={visibility}
    >
      <div className="p-5 flex flex-col items-center text-center">
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-sm border-2 ${
            locked
              ? 'bg-brick-500/10 border-brick-400/40 text-brick-600'
              : 'bg-paper-200 border-paper-400 text-ochre-600'
          }`}
        >
          {locked ? <LockKeyhole className="w-7 h-7" /> : <Lock className="w-7 h-7" />}
        </div>

        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-base">{info.emoji}</span>
          <span className="font-serif text-lg font-semibold text-ink-800">
            {info.label}的气味封套
          </span>
        </div>
        <p className="text-xs text-ink-700/60 mb-4 font-hand text-base">
          {locked
            ? '已锁定 · 只有正确口令能解开'
            : '内容已封缄，输入口令后展开这张卡片'}
        </p>

        <form onSubmit={submit} className="w-full max-w-[240px] space-y-2">
          <div className="relative">
            <input
              type={showCode ? 'text' : 'password'}
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={code}
              disabled={busy}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, ''));
                setError('');
              }}
              placeholder="4-6 位数字口令"
              className="w-full bg-paper-50 border border-paper-300 rounded-xl pl-4 pr-10 py-2.5 text-center tracking-[0.35em] font-mono text-ink-800 placeholder-ink-700/35 placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-ochre-400 focus:border-transparent transition-all"
            />
            <button
              type="button"
              onClick={() => setShowCode((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-700/40 hover:text-ink-700/70 transition-colors"
              tabIndex={-1}
              aria-label={showCode ? '隐藏口令' : '显示口令'}
            >
              {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button
            type="submit"
            disabled={busy || code.length < 4}
            className="w-full btn-primary py-2.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {busy ? '核验中…' : locked ? '用正确口令解除锁定' : '展开封套'}
          </button>
        </form>

        {error ? (
          <p className="mt-2 text-xs text-brick-600 font-medium">{error}</p>
        ) : (
          !locked &&
          fails > 0 && (
            <p className="mt-2 text-xs text-brick-500/80">
              已输错 {fails} 次，还可尝试 {remaining} 次
            </p>
          )
        )}
      </div>
    </article>
  );
}
