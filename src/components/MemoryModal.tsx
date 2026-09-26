import { useEffect, useState } from 'react';
import { X, Lock, Eye, EyeOff, ShieldCheck, ShieldAlert } from 'lucide-react';
import type { SmellMemory, Season, SmellType, Emotion, Visibility } from '../utils/constants';
import { SEASONS, SMELL_TYPES, EMOTIONS, VISIBILITIES, getVisibilityInfo } from '../utils/constants';
import type { MemoryInput } from '../store/memoryStore';
import { isPasscodeValid, passcodeRuleHint, verifyPasscode, hashPasscode } from '../utils/passcode';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** 返回错误信息字符串表示校验失败，返回 undefined/空表示成功 */
  onSubmit: (data: MemoryInput, oldPasscode?: string) => Promise<string | undefined> | void;
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

type VerifyState = 'idle' | 'checking' | 'passed';

export default function MemoryModal({ isOpen, onClose, onSubmit, editingData }: Props) {
  const [form, setForm] = useState<MemoryInput>(defaultForm);
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // 编辑受保护记录时的旧口令核验
  const [oldPasscode, setOldPasscode] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [verifyState, setVerifyState] = useState<VerifyState>('idle');
  const [verifyError, setVerifyError] = useState('');

  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const wasRestricted = !!editingData && editingData.visibility !== 'public';
  const restricted = form.visibility !== 'public';
  // 编辑且仍为受保护档位时，新口令留空表示沿用原口令
  const keepOriginal =
    !!editingData &&
    restricted &&
    editingData.visibility === form.visibility &&
    newPasscode === '' &&
    confirmPasscode === '';

  useEffect(() => {
    if (isOpen) {
      if (editingData) {
        const { id, created_at, updated_at, ...rest } = editingData;
        void id; void created_at; void updated_at;
        setForm(rest);
      } else {
        setForm(defaultForm);
      }
      setNewPasscode('');
      setConfirmPasscode('');
      setShowNew(false);
      setShowConfirm(false);
      setOldPasscode('');
      setShowOld(false);
      setVerifyState(wasRestricted ? 'idle' : 'passed');
      setVerifyError('');
      setFormError('');
      setSubmitting(false);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingData]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const update = <K extends keyof MemoryInput>(key: K, value: MemoryInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const setVisibility = (v: Visibility) => {
    update('visibility', v);
    // 切到公开时清掉口令草稿
    if (v === 'public') {
      setNewPasscode('');
      setConfirmPasscode('');
    }
  };

  const runVerifyOld = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingData || verifyState === 'checking') return;
    setVerifyState('checking');
    setVerifyError('');
    const ok = await verifyPasscode(oldPasscode, editingData.passcode_hash);
    if (ok) {
      setVerifyState('passed');
    } else {
      setVerifyState('idle');
      setVerifyError('原口令不正确');
    }
  };

  const validatePasscodes = (): string | null => {
    if (!restricted) return null;
    if (keepOriginal) return null;
    if (!newPasscode) return `请设置口令（${passcodeRuleHint()}）`;
    if (!isPasscodeValid(newPasscode)) return passcodeRuleHint();
    if (newPasscode !== confirmPasscode) return '两次输入的口令不一致';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.location.trim()) {
      setFormError('请填写地点');
      return;
    }
    const err = validatePasscodes();
    if (err) {
      setFormError(err);
      return;
    }
    setFormError('');
    setSubmitting(true);
    try {
      // 组装提交数据：公开记录不带口令哈希
      let data = form;
      if (restricted) {
        if (keepOriginal) {
          data = { ...form, passcode_hash: editingData!.passcode_hash };
        } else {
          data = { ...form, passcode_hash: await hashPasscode(newPasscode) };
        }
      } else {
        data = { ...form, passcode_hash: undefined };
      }
      const submitError = await onSubmit(data, wasRestricted ? oldPasscode || undefined : undefined);
      if (submitError) {
        setFormError(submitError);
        return;
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const visInfo = getVisibilityInfo(form.visibility);
  const settingsLocked = wasRestricted && verifyState !== 'passed';

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-4 pt-8 md:p-6 overflow-y-auto">
      <div
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm"
        onClick={onClose}
        style={{ animation: 'fadeIn 0.3s ease-out' }}
      />
      <div
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
          {/* 可见范围 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-paper-200">
              <span className="w-1.5 h-6 bg-brick-500 rounded-full" />
              <h3 className="font-hand text-xl text-brick-500">可见范围</h3>
              <span className="text-xs text-ink-700/50">· 非公开内容需口令展开</span>
            </div>

            {wasRestricted && settingsLocked && (
              <div className="p-4 rounded-2xl border border-brick-400/40 bg-brick-500/5">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-brick-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-800 mb-0.5">
                      这是一段「{getVisibilityInfo(editingData!.visibility).label}」记忆
                    </p>
                    <p className="text-xs text-ink-700/60 mb-3">
                      调整可见范围或口令前，请先核验原口令（其他内容也需解锁后才能修改）
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-700/40" />
                        <input
                          type={showOld ? 'text' : 'password'}
                          inputMode="numeric"
                          autoComplete="off"
                          maxLength={6}
                          value={oldPasscode}
                          onChange={(e) => { setOldPasscode(e.target.value.replace(/\D/g, '')); setVerifyError(''); }}
                          placeholder="输入原口令（4-6 位数字）"
                          className="w-full bg-paper-50 border border-paper-300 rounded-xl pl-9 pr-10 py-2.5 font-mono tracking-widest text-ink-800 placeholder-ink-700/35 placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-brick-400 focus:border-transparent"
                        />
                        <button
                          type="button"
                          onClick={() => setShowOld((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-700/40 hover:text-ink-700/70"
                          tabIndex={-1}
                        >
                          {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={runVerifyOld}
                        disabled={oldPasscode.length < 4 || verifyState === 'checking'}
                        className="btn-primary whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {verifyState === 'checking' ? '核验中…' : '核验口令'}
                      </button>
                    </div>
                    {verifyError && <p className="text-xs text-brick-600 mt-2">{verifyError}</p>}
                  </div>
                </div>
              </div>
            )}

            {wasRestricted && verifyState === 'passed' && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-moss-100/70 text-moss-700 text-sm">
                <ShieldCheck className="w-4 h-4" />
                原口令核验通过，可以修改了
              </div>
            )}

            <fieldset disabled={settingsLocked} className={settingsLocked ? 'opacity-50 pointer-events-none select-none' : ''}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {VISIBILITIES.map((v) => (
                  <button
                    key={v.value}
                    type="button"
                    onClick={() => setVisibility(v.value)}
                    className={`p-3.5 rounded-2xl border-2 text-left transition-all duration-200 ${
                      form.visibility === v.value
                        ? 'border-ochre-500 bg-ochre-100/60 shadow-paper scale-[1.01]'
                        : 'border-paper-200 bg-paper-100/60 hover:border-paper-400'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-lg">{v.emoji}</span>
                      <span className="font-serif text-base font-semibold text-ink-800">{v.label}</span>
                    </div>
                    <p className="text-[11px] leading-snug text-ink-700/60">{v.desc}</p>
                  </button>
                ))}
              </div>

              {restricted && (
                <div className="mt-4 p-4 rounded-2xl bg-paper-100/80 border border-paper-300 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-ink-800">
                    <Lock className="w-4 h-4 text-ochre-600" />
                    {keepOriginal
                      ? '沿用原口令（留空即不改）'
                      : editingData
                        ? '设置新口令'
                        : '为这张卡片设置口令'}
                    <span className="text-xs font-normal text-ink-700/50">· {passcodeRuleHint()}</span>
                  </div>
                  {editingData && restricted && (
                    <button
                      type="button"
                      onClick={() => { setNewPasscode(''); setConfirmPasscode(''); }}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        keepOriginal ? 'bg-ochre-500 text-paper-50 border-ochre-600' : 'bg-paper-50 text-ink-700/70 border-paper-300 hover:border-paper-400'
                      }`}
                    >
                      保持原口令不变
                    </button>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-ink-700/60 mb-1.5">
                        {editingData ? '新口令（留空不改）' : '口令'}
                      </label>
                      <div className="relative">
                        <input
                          type={showNew ? 'text' : 'password'}
                          inputMode="numeric"
                          autoComplete="new-password"
                          maxLength={6}
                          value={newPasscode}
                          onChange={(e) => setNewPasscode(e.target.value.replace(/\D/g, ''))}
                          placeholder="4-6 位数字"
                          className="w-full bg-paper-50 border border-paper-300 rounded-xl pl-4 pr-10 py-2.5 font-mono tracking-[0.3em] text-ink-800 placeholder-ink-700/35 placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-ochre-400 focus:border-transparent"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNew((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-700/40 hover:text-ink-700/70"
                          tabIndex={-1}
                        >
                          {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-ink-700/60 mb-1.5">确认口令</label>
                      <div className="relative">
                        <input
                          type={showConfirm ? 'text' : 'password'}
                          inputMode="numeric"
                          autoComplete="new-password"
                          maxLength={6}
                          value={confirmPasscode}
                          onChange={(e) => setConfirmPasscode(e.target.value.replace(/\D/g, ''))}
                          placeholder="再输入一次"
                          disabled={keepOriginal}
                          className="w-full bg-paper-50 border border-paper-300 rounded-xl pl-4 pr-10 py-2.5 font-mono tracking-[0.3em] text-ink-800 placeholder-ink-700/35 placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-ochre-400 focus:border-transparent disabled:bg-paper-200/50"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-700/40 hover:text-ink-700/70"
                          tabIndex={-1}
                        >
                          {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-ink-700/50 flex items-center gap-1">
                    {visInfo.emoji} 当前档位为「{visInfo.label}」，主页默认不显示其内容，输入口令后才会展开
                  </p>
                </div>
              )}
            </fieldset>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-paper-200">
              <span className="w-1.5 h-6 bg-ochre-500 rounded-full" />
              <h3 className="font-hand text-xl text-ochre-600">基础信息</h3>
            </div>
            <fieldset disabled={settingsLocked} className={settingsLocked ? 'opacity-50 pointer-events-none select-none' : ''}>
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
            </fieldset>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-paper-200">
              <span className="w-1.5 h-6 bg-moss-500 rounded-full" />
              <h3 className="font-hand text-xl text-moss-600">感官属性</h3>
            </div>

            <fieldset disabled={settingsLocked} className={settingsLocked ? 'opacity-50 pointer-events-none select-none' : ''}>
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

            <div className="mt-5">
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
            </fieldset>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-paper-200">
              <span className="w-1.5 h-6 bg-lavender-500 rounded-full" />
              <h3 className="font-hand text-xl text-lavender-600">情感记忆</h3>
            </div>

            <fieldset disabled={settingsLocked} className={settingsLocked ? 'opacity-50 pointer-events-none select-none' : ''}>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-2">唤起的情绪</label>
                <div className="flex flex-wrap gap-1.5">
                  {EMOTIONS.map((em) => (
                    <button
                      key={em.value}
                      type="button"
                      onClick={() => update('emotion', em.value as Emotion)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 inline-flex items-center gap-1 ${
                        form.emotion === em.value
                          ? `${em.bg} ${em.text} ring-2 ring-offset-1 ring-offset-paper-50 ring-ochre-300 scale-[1.03]`
                          : 'bg-paper-100 text-ink-700/70 hover:bg-paper-200 border border-paper-200'
                      }`}
                    >
                      <span>{em.emoji}</span>
                      <span>{em.label}</span>
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
            </fieldset>
          </div>

          {formError && (
            <p className="text-sm text-brick-600 bg-brick-500/5 border border-brick-400/30 rounded-xl px-4 py-2.5">
              {formError}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-paper-200">
            <button type="button" onClick={onClose} className="btn-secondary">
              取消
            </button>
            <button
              type="submit"
              disabled={settingsLocked || submitting}
              className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {submitting ? '保存中…' : editingData ? '保存修改' : '封存这段记忆'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
