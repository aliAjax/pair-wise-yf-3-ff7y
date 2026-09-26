import { useState } from 'react';
import { Lock, KeyRound, ShieldAlert } from 'lucide-react';
import type { Visibility, EnvelopeRecord } from '../utils/constants';
import { getVisibilityInfo } from '../utils/constants';
import { isValidPasscodeFormat, PASSCODE_PATTERN_HINT } from '../utils/privacy';
import type { UnlockResult } from '../store/memoryStore';

interface Props {
  id: string;
  visibility: Visibility;
  envelope: EnvelopeRecord;
  onUnlock: (id: string, passcode: string) => Promise<UnlockResult>;
}

const MAX_FAILS = 3;

export default function EnvelopeCard({ id, visibility, envelope, onUnlock }: Props) {
  const info = getVisibilityInfo(visibility);
  const [passcode, setPasscode] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  // 本地反馈以最近一次提交结果为准，持久态以 envelope 为准
  const [lastResult, setLastResult] = useState<UnlockResult | null>(null);

  const remaining = MAX_FAILS - envelope.fails;
  const isLocked = envelope.locked;

  const submit = async () => {
    if (busy || !passcode) return;
    if (!isValidPasscodeFormat(passcode)) {
      setLastResult('wrong');
      triggerShake();
      return;
    }
    setBusy(true);
    const result = await onUnlock(id, passcode);
    setBusy(false);
    setLastResult(result);
    if (result === 'ok') {
      setPasscode('');
    } else {
      setPasscode('');
      triggerShake();
    }
  };

  const triggerShake = () => {
    setShake(true);
    window.setTimeout(() => setShake(false), 400);
  };

  const hint = isLocked
    ? '封套已锁定：连续三次口令不符。只有正确口令能解除锁定。'
    : lastResult === 'wrong'
      ? `口令不对，再试一次。还可错 ${Math.max(remaining, 0)} 次，之后封套将锁定。`
      : `这是${info.label}记忆，已封入封套。输入 ${PASSCODE_PATTERN_HINT} 口令展开。`;

  return (
    <article
      className={`relative bg-paper-100/80 rounded-2xl border-2 border-dashed border-paper-400 shadow-card overflow-hidden animate-fadeInUp ${
        shake ? 'animate-shake' : ''
      } ${isLocked ? 'ring-2 ring-brick-400/50' : ''}`}
      data-envelope-id={id}
    >
      <div className="p-5 flex flex-col items-center text-center">
        {/* 信封视觉 */}
        <div className="relative w-24 h-[72px] mb-3 mt-1">
          <div className="absolute inset-0 rounded-lg border-2 border-paper-400 bg-paper-50 overflow-hidden shadow-inner">
            <div
              className="absolute -top-[2px] left-0 w-0 h-0"
              style={{
                borderLeft: '46px solid transparent',
                borderRight: '46px solid transparent',
                borderTop: '38px solid #E0D1B3',
              }}
            />
          </div>
          <div
            className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full flex items-center justify-center text-base shadow-md border-2 border-paper-50 ${
              isLocked ? 'bg-brick-500/90' : visibility === 'self' ? 'bg-ink-700/90' : 'bg-lavender-400/90'
            } text-paper-50`}
          >
            {isLocked ? <ShieldAlert className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          </div>
        </div>

        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-sm">{info.emoji}</span>
          <span className="font-hand text-lg text-ink-800">
            {isLocked ? '已锁定的封套' : `${info.label}封套`}
          </span>
        </div>
        <p
          className={`text-xs leading-relaxed mb-4 max-w-[240px] ${
            isLocked ? 'text-brick-600 font-medium' : 'text-ink-700/60'
          }`}
        >
          {hint}
        </p>

        <div className="w-full max-w-[240px] flex items-center gap-2">
          <div className="relative flex-1">
            <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ochre-600/50 pointer-events-none" />
            <input
              type="password"
              inputMode="numeric"
              pattern="\d{4,6}"
              maxLength={6}
              autoComplete="off"
              value={passcode}
              disabled={busy}
              onChange={(e) => setPasscode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              placeholder="4-6 位数字口令"
              aria-label={`${info.label}封套口令`}
              className="scent-input pl-9 py-2 text-sm tracking-[0.3em] text-center"
            />
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !passcode}
            className="shrink-0 px-4 py-2 rounded-xl text-sm font-medium bg-ochre-500 hover:bg-ochre-600 text-paper-50 shadow-paper transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? '核对中' : '解封'}
          </button>
        </div>

        {!isLocked && (
          <div className="mt-3 flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${
                  i < remaining ? 'bg-ochre-400' : 'bg-brick-400/70'
                }`}
              />
            ))}
            <span className="text-[10px] text-ink-700/45 ml-1">剩余尝试 {Math.max(remaining, 0)} 次</span>
          </div>
        )}
      </div>
    </article>
  );
}
