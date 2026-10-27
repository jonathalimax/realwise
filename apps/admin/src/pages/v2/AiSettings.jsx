import { useEffect, useState } from 'react';
import { AlertTriangle, Info, Megaphone, Save, Sparkles } from 'lucide-react';
import { settingsResource } from '../../lib/api/resources/settings';
import { friendlyError } from '../../lib/api/errors';
import { useAsync } from '../../lib/useAsync';
import { fromLocalInput, toLocalInput } from '../../lib/format';
import { AsyncView, Button, Card, Field, InlineMessage, PageHeader, Toast, Toggle, inputClass } from '../../components/ui';

const AI_DEFAULTS = {
  monthlyBudgetUsd: '', trialBudgetUsd: '', hardCapMultiplier: '',
  modelChat: '', modelChatLight: '', modelInsights: '', modelFallback: '', promptCache: true,
};
const NUMERIC = ['monthlyBudgetUsd', 'trialBudgetUsd', 'hardCapMultiplier'];
const MODELS = [
  ['modelChat', 'Modelo do chat', 'Respostas principais do assistente.'],
  ['modelChatLight', 'Modelo do chat (leve)', 'Perguntas simples, mais barato.'],
  ['modelInsights', 'Modelo de insights', 'Análises e resumos em segundo plano.'],
  ['modelFallback', 'Modelo de contingência', 'Usado quando o principal falha.'],
];

function toAiForm(data) {
  const f = { ...AI_DEFAULTS };
  Object.keys(AI_DEFAULTS).forEach((k) => {
    const v = data?.[k];
    if (v === undefined || v === null) return;
    f[k] = typeof AI_DEFAULTS[k] === 'boolean' ? Boolean(v) : String(v);
  });
  return f;
}

function AiCard() {
  const state = useAsync(() => settingsResource.getAi(), 'ai');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  useEffect(() => { if (state.data) setForm(toAiForm(state.data)); }, [state.data]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const invalid = form && NUMERIC.some((k) => form[k].trim() !== '' && !(Number(form[k].replace(',', '.')) >= 0));

  async function save() {
    setSaving(true);
    setError('');
    try {
      const body = { promptCache: form.promptCache };
      NUMERIC.forEach((k) => { if (form[k].trim() !== '') body[k] = Number(form[k].replace(',', '.')); });
      MODELS.forEach(([k]) => { if (form[k].trim() !== '') body[k] = form[k].trim(); });
      const saved = await settingsResource.saveAi(body);
      if (saved && typeof saved === 'object') setForm(toAiForm(saved));
      setToast('Configurações de IA salvas.');
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AsyncView state={state} isEmpty={() => false}>
      {() => !form ? null : (
        <div className="space-y-4">
          <Card title="Orçamento de IA" subtitle="Limite mensal de custo por usuário, em dólares. Um limite individual no perfil do usuário tem prioridade.">
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Assinantes (US$/mês)"><input className={inputClass} inputMode="decimal" value={form.monthlyBudgetUsd} onChange={(e) => set({ monthlyBudgetUsd: e.target.value })} placeholder="padrão" /></Field>
              <Field label="Em teste (US$)"><input className={inputClass} inputMode="decimal" value={form.trialBudgetUsd} onChange={(e) => set({ trialBudgetUsd: e.target.value })} placeholder="padrão" /></Field>
              <Field label="Multiplicador do teto rígido" hint="Ex.: 1,5 bloqueia em 150% do orçamento."><input className={inputClass} inputMode="decimal" value={form.hardCapMultiplier} onChange={(e) => set({ hardCapMultiplier: e.target.value })} placeholder="padrão" /></Field>
            </div>
          </Card>

          <Card title="Modelos" subtitle="Identificadores do OpenRouter. Campos vazios usam o valor padrão do servidor.">
            <div className="grid sm:grid-cols-2 gap-3">
              {MODELS.map(([key, label, hint]) => (
                <Field key={key} label={label} hint={hint}>
                  <input className={inputClass} value={form[key]} onChange={(e) => set({ [key]: e.target.value })} placeholder="provedor/modelo" />
                </Field>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-800 pt-4">
              <div>
                <p className="text-sm text-gray-200">Cache de prompt</p>
                <p className="text-xs text-gray-500">Reduz o custo reaproveitando o contexto repetido.</p>
              </div>
              <Toggle checked={form.promptCache} onChange={(v) => set({ promptCache: v })} label="Cache de prompt" />
            </div>
          </Card>

          {invalid && <InlineMessage tone="warning">Os valores de orçamento precisam ser números maiores ou iguais a zero.</InlineMessage>}
          {error && <InlineMessage>{error}</InlineMessage>}
          <div className="flex justify-end">
            <Button variant="primary" icon={Save} onClick={save} loading={saving} disabled={invalid}>Salvar configurações de IA</Button>
          </div>
          <Toast message={toast} onDone={() => setToast('')} />
        </div>
      )}
    </AsyncView>
  );
}

const LEVELS = [
  { value: 'info', label: 'Informação', cls: 'bg-sky-600/90 text-white', icon: Info },
  { value: 'warning', label: 'Alerta', cls: 'bg-amber-500 text-black', icon: AlertTriangle },
  { value: 'promo', label: 'Promoção', cls: 'bg-emerald-600 text-white', icon: Sparkles },
];

function AnnouncementCard() {
  const state = useAsync(() => settingsResource.getAnnouncement(), 'announcement');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (state.data === null && state.loading) return;
    const d = state.data ?? {};
    setForm({
      enabled: Boolean(d.enabled ?? (state.data ? true : false)),
      text: d.text ?? '',
      level: d.level ?? 'info',
      linkLabel: d.linkLabel ?? '',
      linkUrl: d.linkUrl ?? '',
      until: toLocalInput(d.until),
    });
  }, [state.data, state.loading]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const level = LEVELS.find((l) => l.value === form?.level) ?? LEVELS[0];
  const linkOk = !form?.linkLabel.trim() || /^(https?:\/\/|\/)/i.test(form.linkUrl.trim());
  const needsText = form?.enabled && form.text.trim().length < 3;

  async function save() {
    setSaving(true);
    setError('');
    try {
      await settingsResource.saveAnnouncement({
        enabled: form.enabled,
        text: form.text.trim(),
        level: form.level,
        linkLabel: form.linkLabel.trim() || undefined,
        linkUrl: form.linkLabel.trim() ? form.linkUrl.trim() : undefined,
        until: fromLocalInput(form.until) ?? undefined,
      });
      setToast(form.enabled ? 'Aviso publicado.' : 'Aviso salvo (desativado).');
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="Aviso no app"
      subtitle="Faixa exibida no topo do app dos clientes."
      actions={form && <Toggle checked={form.enabled} onChange={(v) => set({ enabled: v })} label="Ativar aviso" />}
    >
      <AsyncView state={state.loading || state.error ? state : { ...state, data: state.data ?? {} }} isEmpty={() => false}>
        {() => !form ? null : (
          <div className="space-y-3">
            <Field label="Mensagem">
              <textarea className={`${inputClass} min-h-20`} maxLength={280} value={form.text} onChange={(e) => set({ text: e.target.value })} placeholder="Ex.: Manutenção programada no domingo, das 2h às 4h." />
            </Field>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Tipo">
                <select className={inputClass} value={form.level} onChange={(e) => set({ level: e.target.value })}>
                  {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </Field>
              <Field label="Exibir até (opcional)">
                <input className={inputClass} type="datetime-local" value={form.until} onChange={(e) => set({ until: e.target.value })} />
              </Field>
              <Field label="Texto do link (opcional)"><input className={inputClass} value={form.linkLabel} onChange={(e) => set({ linkLabel: e.target.value })} placeholder="Saiba mais" /></Field>
              <Field label="Endereço do link"><input className={inputClass} value={form.linkUrl} onChange={(e) => set({ linkUrl: e.target.value })} placeholder="https://" disabled={!form.linkLabel.trim()} /></Field>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-400 mb-1.5">Pré-visualização</p>
              <div className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm ${level.cls} ${form.enabled ? '' : 'opacity-50'}`}>
                <level.icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 min-w-0 break-words">{form.text || 'O texto do aviso aparece aqui.'}</span>
                {form.linkLabel && <span className="underline font-medium whitespace-nowrap">{form.linkLabel}</span>}
              </div>
              {!form.enabled && <p className="text-[11px] text-gray-500 mt-1">Desativado: não aparece para os clientes.</p>}
            </div>

            {!linkOk && <InlineMessage tone="warning">O link precisa começar com http://, https:// ou /.</InlineMessage>}
            {needsText && <InlineMessage tone="warning">Escreva a mensagem para ativar o aviso.</InlineMessage>}
            {error && <InlineMessage>{error}</InlineMessage>}
            <div className="flex justify-end">
              <Button variant="primary" icon={Megaphone} onClick={save} loading={saving} disabled={!linkOk || needsText}>
                {form.enabled ? 'Publicar aviso' : 'Salvar aviso'}
              </Button>
            </div>
            <Toast message={toast} onDone={() => setToast('')} />
          </div>
        )}
      </AsyncView>
    </Card>
  );
}

export default function AiSettings() {
  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      <PageHeader title="IA e Avisos" subtitle="Orçamentos e modelos de IA, e o aviso exibido no app dos clientes." />
      <AiCard />
      <AnnouncementCard />
    </div>
  );
}
