import { useEffect, useRef, useState } from 'react';
import { X, ShieldCheck, Lock, KeyRound, AlertCircle } from 'lucide-react';
import type { SmellMemory, Season, SmellType, Emotion, Visibility } from '../utils/constants';
import { SEASONS, SMELL_TYPES, EMOTIONS, VISIBILITY_LEVELS } from '../utils/constants';
import type { MemoryInput, SecuritySubmit } from '../store/memoryStore';
import { isValidPasscodeFormat, PASSCODE_PATTERN_HINT } from '../utils/privacy';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: MemoryInput, security: SecuritySubmit) => Promise<boolean>;
  editingData: SmellMemory | null;
}

const defaultForm: MemoryInput = {
  location: '',
  source_guess: '',
  intensity: 5,
  humidity: 5,
  season: 'autumn',
  smell_type: 'woody',
  memory_text: '',
  color_association: '#8B5A2B',
  emotion: 'nostalgic',
  want_again: true,
  visibility: 'public',
};

const intensityTicks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const humidityTicks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function MemoryModal({ isOpen, onClose, onSubmit, editingData }: Props) {
  const [form, setForm] = useState<MemoryInput>(defaultForm);
  const [oldPasscode, setOldPasscode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const isEdit = !!editingData;
  const wasProtected = !!editingData && editingData.visibility !== 'public';
  const targetProtected = form.visibility !== 'public';
  // 需要新建封套：新增受保护记录，或把公开记录改成受保护
  const needNewPasscode = targetProtected && (!isEdit || !wasProtected);
  // 原本受保护、且正在调整范围或口令时，必须先核旧口令
  const needOldPasscode =
    wasProtected &&
    (form.visibility !== editingData!.visibility || newPasscode.length > 0);

  useEffect(() => {
    if (isOpen) {
      if (editingData) {
        const { id, created_at, updated_at, ...rest } = editingData;
        void id; void created_at; void updated_at;
        setForm(rest);
      } else {
        setForm(defaultForm);
      }
      setOldPasscode('');
      setNewPasscode('');
      setConfirmPasscode('');
      setSecurityError(null);
      setSubmitting(false);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen, editingData]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const update = <K extends keyof MemoryInput>(key: K, value: MemoryInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSecurityError(null);
  };

  const validateSecurity = (): string | null => {
    if (!targetProtected) {
      // 从受保护转为公开：必须核旧口令
      if (wasProtected && !oldPasscode) return '转为公开前，请先输入当前口令以核验身份';
      return null;
    }
    if (needOldPasscode && !oldPasscode) return '调整可见范围或口令前，请先输入当前口令';
    if (newPasscode) {
      if (!isValidPasscodeFormat(newPasscode)) return `新口令必须是 ${PASSCODE_PATTERN_HINT}`;
      if (newPasscode !== confirmPasscode) return '两次输入的新口令不一致';
    }
    if (needNewPasscode) {
      if (!newPasscode) return `该可见范围需要设置 ${PASSCODE_PATTERN_HINT} 口令`;
      if (!isValidPasscodeFormat(newPasscode)) return `口令必须是 ${PASSCODE_PATTERN_HINT}`;
      if (newPasscode !== confirmPasscode) return '两次输入的口令不一致';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.location.trim() || submitting) return;
    const err = validateSecurity();
    if (err) { setSecurityError(err); return; }

    const security: SecuritySubmit = {
      visibility: form.visibility,
      oldPasscode: wasProtected ? oldPasscode : undefined,
      newPasscode: newPasscode || undefined,
    };

    setSubmitting(true);
    const ok = await onSubmit(form, security);
    setSubmitting(false);
    if (ok) {
      onClose();
    } else {
      setSecurityError('当前口令不正确，封套设置未更改');
    }
  };

  if (!isOpen) return null;

  const passcodeInputCls = (value: string) =>
    `scent-input tracking-[0.3em] ${value && !isValidPasscodeFormat(value) ? 'border-brick-400 focus:ring-brick-400' : ''}`;

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-4 pt-8 md:p-6 overflow-y-auto">
      <div
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm"
        onClick={onClose}
        style={{ animation: 'fadeIn 0.3s ease-out' }}
      />
      <div
        ref={modalRef}
        className="relative w-full max-w-2xl bg-paper-50 rounded-3xl shadow-2xl border border-paper-300 animate-slideDown"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.54 0 0 0 0 0.35 0 0 0 0 0.18 0 0 0 0.04 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-paper-200 rounded-t-3xl bg-paper-50/95 backdrop-blur">
          <div>
            <h2 className="font-serif text-2xl font-bold text-ink-800">
              {editingData ? '编辑这段气味' : '封存一段新气味'}
            </h2>
            <p className="text-sm text-ink-700/60 mt-0.5 font-hand">
              {editingData ? '回忆已经变了吗？修改它吧～' : '把此刻空气中的味道记录下来'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-ink-700/60 hover:text-ink-800 hover:bg-paper-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 可见范围 / 封套口令 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-paper-200">
              <span className="w-1.5 h-6 bg-lavender-500 rounded-full" />
              <h3 className="font-hand text-xl text-lavender-600">可见范围</h3>
              {wasProtected && (
                <span className="ml-auto text-xs text-ink-700/50">
                  当前：{VISIBILITY_LEVELS.find((v) => v.value === editingData!.visibility)?.label}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {VISIBILITY_LEVELS.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => update('visibility', v.value as Visibility)}
                  className={`text-left p-3 rounded-2xl border-2 transition-all duration-200 ${
                    form.visibility === v.value
                      ? 'border-ochre-500 bg-ochre-50 shadow-paper scale-[1.01]'
                      : 'border-paper-200 bg-paper-100/60 hover:bg-paper-100 hover:border-paper-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-lg">{v.emoji}</span>
                    <span className="font-serif text-base font-semibold text-ink-800">{v.label}</span>
                    {form.visibility === v.value && <ShieldCheck className="w-4 h-4 text-ochre-500 ml-auto" />}
                  </div>
                  <p className="text-[11px] leading-snug text-ink-700/60">{v.desc}</p>
                </button>
              ))}
            </div>

            {targetProtected && (
              <div className="p-4 rounded-2xl bg-lavender-300/15 border border-lavender-300/40 space-y-4">
                {needOldPasscode && (
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-ink-700 mb-1.5">
                      <KeyRound className="w-4 h-4 text-lavender-600" />
                      核验当前口令
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      autoComplete="off"
                      value={oldPasscode}
                      onChange={(e) => { setOldPasscode(e.target.value.replace(/\D/g, '').slice(0, 6)); setSecurityError(null); }}
                      placeholder={`输入当前 ${PASSCODE_PATTERN_HINT} 口令`}
                      className={passcodeInputCls(oldPasscode)}
                    />
                    <p className="text-[11px] text-ink-700/50 mt-1">调整可见范围或口令前，需先核验旧口令</p>
                  </div>
                )}
                {wasProtected && !needOldPasscode && (
                  <p className="flex items-center gap-1.5 text-xs text-ink-700/60">
                    <Lock className="w-3.5 h-3.5 text-lavender-600" />
                    范围与口令均未改动时无需重新核验；想换口令可在下方输入新口令（同样需先核验当前口令）
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1.5">
                      {needNewPasscode ? '设置口令 *' : '新口令（留空则不变）'}
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      autoComplete="new-password"
                      value={newPasscode}
                      onChange={(e) => { setNewPasscode(e.target.value.replace(/\D/g, '').slice(0, 6)); setSecurityError(null); }}
                      placeholder={PASSCODE_PATTERN_HINT}
                      className={passcodeInputCls(newPasscode)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1.5">确认口令</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      autoComplete="new-password"
                      value={confirmPasscode}
                      onChange={(e) => { setConfirmPasscode(e.target.value.replace(/\D/g, '').slice(0, 6)); setSecurityError(null); }}
                      placeholder="再输入一次"
                      className={passcodeInputCls(confirmPasscode)}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-ink-700/50">
                  口令为 {PASSCODE_PATTERN_HINT}，记忆会封入封套；主页默认只显示公开内容，输入口令后才展开。同一口令可解封多条记忆。
                </p>
              </div>
            )}

            {wasProtected && !targetProtected && (
              <div className="p-4 rounded-2xl bg-paper-100 border border-paper-300 space-y-3">
                <label className="flex items-center gap-1.5 text-sm font-medium text-ink-700 mb-0">
                  <KeyRound className="w-4 h-4 text-ochre-600" />
                  核验当前口令
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="off"
                  value={oldPasscode}
                  onChange={(e) => { setOldPasscode(e.target.value.replace(/\D/g, '').slice(0, 6)); setSecurityError(null); }}
                  placeholder={`输入当前 ${PASSCODE_PATTERN_HINT} 口令以解除封套`}
                  className={passcodeInputCls(oldPasscode)}
                />
                <p className="text-[11px] text-ink-700/50">转为公开后封套将被移除，任何人都能直接翻阅这条记忆</p>
              </div>
            )}

            {securityError && (
              <p className="flex items-center gap-1.5 text-sm text-brick-600 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {securityError}
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-paper-200">
              <span className="w-1.5 h-6 bg-ochre-500 rounded-full" />
              <h3 className="font-hand text-xl text-ochre-600">基础信息</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">地点 *</label>
                <input
                  type="text"
                  required
                  value={form.location}
                  onChange={(e) => update('location', e.target.value)}
                  placeholder="例如：外婆家的老衣柜"
                  className="scent-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">气味来源猜测</label>
                <input
                  type="text"
                  value={form.source_guess}
                  onChange={(e) => update('source_guess', e.target.value)}
                  placeholder="例如：樟木 + 旧毛衣"
                  className="scent-input"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-paper-200">
              <span className="w-1.5 h-6 bg-moss-500 rounded-full" />
              <h3 className="font-hand text-xl text-moss-600">感官属性</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-ink-700">气味强度</label>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-ochre-100 text-ochre-600 font-semibold text-sm">
                    {form.intensity} / 10
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={form.intensity}
                  onChange={(e) => update('intensity', Number(e.target.value))}
                  className="scent-slider"
                />
                <div className="scent-slider-ticks">
                  {intensityTicks.map((v) => (
                    <span key={v} data-value={v} />
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-ink-700">湿度感</label>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-moss-100 text-moss-600 font-semibold text-sm">
                    {form.humidity <= 3 ? '极干' : form.humidity <= 6 ? '适中' : '极湿'}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={form.humidity}
                  onChange={(e) => update('humidity', Number(e.target.value))}
                  className="scent-slider"
                  style={{ background: 'linear-gradient(90deg, #E0D1B3 0%, #7DA08C 100%)' }}
                />
                <div className="scent-slider-ticks">
                  {humidityTicks.map((v) => (
                    <span key={v} data-value={v} />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">季节</label>
                <div className="grid grid-cols-4 gap-2">
                  {SEASONS.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => update('season', s.value as Season)}
                      className={`py-2.5 rounded-xl text-sm font-medium transition-all duration-200 flex flex-col items-center gap-0.5 ${
                        form.season === s.value
                          ? 'bg-ochre-500 text-paper-50 shadow-paper scale-[1.02]'
                          : 'bg-paper-100 text-ink-700 hover:bg-paper-200 border border-paper-200'
                      }`}
                    >
                      <span className="text-lg leading-none">{s.emoji}</span>
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">颜色联想</label>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-paper-100 border border-paper-200">
                  <input
                    type="color"
                    value={form.color_association}
                    onChange={(e) => update('color_association', e.target.value)}
                    className="scent-color shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm text-ink-800 font-semibold">{form.color_association.toUpperCase()}</div>
                    <div className="text-xs text-ink-700/60 mt-0.5">想到这种味道时，脑中浮现的颜色</div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-700 mb-2">气味类型</label>
              <div className="flex flex-wrap gap-2">
                {SMELL_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => update('smell_type', t.value as SmellType)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 inline-flex items-center gap-1.5 ${
                      form.smell_type === t.value
                        ? 'text-paper-50 shadow-paper scale-[1.03]'
                        : 'bg-paper-100 text-ink-700 hover:bg-paper-200 border border-paper-200'
                    }`}
                    style={form.smell_type === t.value ? { backgroundColor: t.color } : {}}
                  >
                    <span>{t.emoji}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-paper-200">
              <span className="w-1.5 h-6 bg-lavender-500 rounded-full" />
              <h3 className="font-hand text-xl text-lavender-600">情感记忆</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1.5">关联记忆</label>
              <textarea
                value={form.memory_text}
                onChange={(e) => update('memory_text', e.target.value)}
                rows={4}
                placeholder="这种味道让你想起了什么人、什么事？尽情写下来吧..."
                className="scent-textarea font-serif"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-2">唤起的情绪</label>
                <div className="flex flex-wrap gap-1.5">
                  {EMOTIONS.map((e) => (
                    <button
                      key={e.value}
                      type="button"
                      onClick={() => update('emotion', e.value as Emotion)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 inline-flex items-center gap-1 ${
                        form.emotion === e.value
                          ? `${e.bg} ${e.text} ring-2 ring-offset-1 ring-offset-paper-50 ring-ochre-300 scale-[1.03]`
                          : 'bg-paper-100 text-ink-700/70 hover:bg-paper-200 border border-paper-200'
                      }`}
                    >
                      <span>{e.emoji}</span>
                      <span>{e.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-700 mb-2">还想再闻到吗？</label>
                <div
                  className="flex items-center gap-4 p-3 rounded-xl bg-paper-100 border border-paper-200 cursor-pointer select-none"
                  onClick={() => update('want_again', !form.want_again)}
                >
                  <div className={`toggle-switch ${form.want_again ? 'active' : ''}`} />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-ink-800">
                      {form.want_again ? '🌿 希望有机会再次闻到' : '😮‍💨 就让它留在记忆里吧'}
                    </div>
                    <div className="text-[11px] text-ink-700/55 mt-0.5">
                      {form.want_again ? '标记的气味会显示在卡片上' : '偶尔，不完美的回忆更珍贵'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-paper-200">
            <button type="button" onClick={onClose} className="btn-secondary">
              取消
            </button>
            <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
              {submitting ? '封存中…' : editingData ? '保存修改' : '封存这段记忆'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
