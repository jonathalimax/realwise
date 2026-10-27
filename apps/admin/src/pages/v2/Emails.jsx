import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, PlayCircle, Save, Send } from 'lucide-react';
import { settingsResource } from '../../lib/api/resources/settings';
import { friendlyError } from '../../lib/api/errors';
import { toPage } from '../../lib/api/query';
import { useAsync, useDebounced } from '../../lib/useAsync';
import { dateTime } from '../../lib/format';
import {
  AsyncView, Badge, Button, Card, ConfirmDialog, EmptyState, Field, InlineMessage, PageHeader, Pagination, TableWrap, Toast, Toggle,
  inputClass, tdClass, thClass,
} from '../../components/ui';

const KINDS = [
  { key: 'trial_import', label: 'Teste: importe seu extrato', desc: 'Convida quem está em teste e ainda não importou nada.' },
  { key: 'trial_ending', label: 'Teste terminando', desc: 'Avisa que o período de teste está acabando.' },
  { key: 'trial_expired', label: 'Teste expirado', desc: 'Convida a assinar após o fim do teste.' },
  { key: 'monthly_import', label: 'Importação mensal', desc: 'Lembra assinantes de importar o extrato do mês.' },
  { key: 'bill_suggestion', label: 'Sugestão de lembrete', desc: 'O Elio percebe um pagamento mensal e pergunta se quer criar um lembrete (no máx. 1 a cada 14 dias).' },
];
const SENT_KINDS = [...KINDS, { key: 'bill_reminder', label: 'Lembrete de contas' }];
const kindLabel = (k) => SENT_KINDS.find((x) => x.key === k)?.label ?? k ?? '—';

const DEFAULTS = {
  engagement: { enabled: true, hourBrt: 10, kinds: Object.fromEntries(KINDS.map((k) => [k.key, { enabled: true }])) },
  billReminders: { enabled: true, hourBrt: 8 },
};

function normalize(data) {
  return {
    engagement: {
      ...DEFAULTS.engagement,
      ...(data?.engagement ?? {}),
      kinds: { ...DEFAULTS.engagement.kinds, ...(data?.engagement?.kinds ?? {}) },
    },
    billReminders: { ...DEFAULTS.billReminders, ...(data?.billReminders ?? {}) },
  };
}

function HourSelect({ value, onChange }) {
  return (
    <select className={`${inputClass} !w-auto`} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label="Horário (BRT)">
      {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
    </select>
  );
}

function SettingsTab() {
  const state = useAsync(() => settingsResource.getEmails(), 'emails');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [runJob, setRunJob] = useState(null);
  const [testKind, setTestKind] = useState('trial_import');
  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState(null);

  useEffect(() => { if (state.data) setForm(normalize(state.data)); }, [state.data]);

  async function save() {
    setSaving(true);
    setError('');
    try {
      const saved = await settingsResource.saveEmails(form);
      if (saved && typeof saved === 'object') setForm(normalize(saved));
      setToast('Configurações de e-mail salvas.');
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    setTestMsg(null);
    try {
      await settingsResource.sendEmailTest({ kind: testKind, to: testTo.trim() });
      setTestMsg({ tone: 'success', text: `Teste enviado para ${testTo.trim()}.` });
    } catch (e) {
      setTestMsg({ tone: 'error', text: friendlyError(e) });
    } finally {
      setTesting(false);
    }
  }

  const eng = form?.engagement;
  const setEng = (patch) => setForm((f) => ({ ...f, engagement: { ...f.engagement, ...patch } }));
  const setBills = (patch) => setForm((f) => ({ ...f, billReminders: { ...f.billReminders, ...patch } }));
  const setKind = (key, enabled) => setEng({ kinds: { ...eng.kinds, [key]: { ...eng.kinds[key], enabled } } });

  return (
    <AsyncView state={state} isEmpty={() => false}>
      {() => !form ? null : (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">Horários em Brasília (BRT). Os envios são verificados de hora em hora; mudanças valem a partir da próxima verificação.</p>

          <Card
            title="Lembretes de engajamento"
            subtitle="Teste, importação e conversão"
            actions={(
              <>
                <Button size="sm" icon={PlayCircle} onClick={() => setRunJob('engagement')}>Executar agora</Button>
                <Toggle checked={eng.enabled} onChange={(v) => setEng({ enabled: v })} label="Ativar lembretes de engajamento" />
              </>
            )}
          >
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-gray-800">
              <span className="text-sm text-gray-300">Horário de envio (BRT)</span>
              <HourSelect value={eng.hourBrt} onChange={(v) => setEng({ hourBrt: v })} />
            </div>
            <ul className="divide-y divide-gray-800">
              {KINDS.map((k) => (
                <li key={k.key} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-100">{k.label}</p>
                    <p className="text-xs text-gray-500">{k.desc}</p>
                  </div>
                  <Toggle checked={Boolean(eng.kinds[k.key]?.enabled)} onChange={(v) => setKind(k.key, v)} label={k.label} disabled={!eng.enabled} />
                </li>
              ))}
            </ul>
          </Card>

          <Card
            title="Lembretes de contas a pagar"
            subtitle="Aviso de vencimento enviado aos usuários"
            actions={(
              <>
                <Button size="sm" icon={PlayCircle} onClick={() => setRunJob('bills')}>Executar agora</Button>
                <Toggle checked={form.billReminders.enabled} onChange={(v) => setBills({ enabled: v })} label="Ativar lembretes de contas" />
              </>
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-300">Horário de envio (BRT)</span>
              <HourSelect value={form.billReminders.hourBrt} onChange={(v) => setBills({ hourBrt: v })} />
            </div>
          </Card>

          {error && <InlineMessage>{error}</InlineMessage>}
          <div className="flex justify-end">
            <Button variant="primary" icon={Save} onClick={save} loading={saving}>Salvar configurações</Button>
          </div>

          <Card title="Enviar e-mail de teste" subtitle="Envia um exemplo do modelo escolhido para o endereço informado.">
            <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
              <Field label="Modelo">
                <select className={inputClass} value={testKind} onChange={(e) => setTestKind(e.target.value)}>
                  {SENT_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
                </select>
              </Field>
              <Field label="Enviar para">
                <input className={inputClass} type="email" placeholder="voce@email.com" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
              </Field>
              <Button icon={Send} onClick={sendTest} loading={testing} disabled={!/^\S+@\S+\.\S+$/.test(testTo.trim())}>Enviar teste</Button>
            </div>
            {testMsg && <div className="mt-3"><InlineMessage tone={testMsg.tone}>{testMsg.text}</InlineMessage></div>}
          </Card>

          <ConfirmDialog
            open={Boolean(runJob)}
            title="Executar agora"
            tone="primary"
            confirmLabel="Executar"
            description={runJob === 'bills'
              ? 'Roda o job de lembretes de contas imediatamente, respeitando as regras de cada usuário. Isso pode enviar e-mails reais.'
              : 'Roda o job de engajamento imediatamente, respeitando as regras de cada modelo. Isso pode enviar e-mails reais.'}
            onClose={() => setRunJob(null)}
            onConfirm={async () => {
              await settingsResource.runEmailJob(runJob);
              setToast('Job executado.');
            }}
          />
          <Toast message={toast} onDone={() => setToast('')} />
        </div>
      )}
    </AsyncView>
  );
}

function SentTab() {
  const [kind, setKind] = useState('');
  const [email, setEmail] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounced(email);
  useEffect(() => { setPage(1); }, [kind, debounced]);
  const params = { kind, email: debounced.trim(), page, pageSize: 25 };
  const state = useAsync(() => settingsResource.sentEmails(params), JSON.stringify(params));

  return (
    <Card padded={false}>
      <div className="p-3 sm:p-4 grid gap-2 sm:grid-cols-2 border-b border-gray-800">
        <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Tipo de e-mail">
          <option value="">Todos os tipos</option>
          {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
        </select>
        <input className={inputClass} placeholder="Filtrar por e-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="px-3 sm:px-4 pb-4">
        <AsyncView
          state={state}
          isEmpty={(d) => toPage(d).items.length === 0}
          empty={<EmptyState icon={Mail} title="Nenhum e-mail enviado" description="Os lembretes enviados aparecem aqui." />}
        >
          {(data) => {
            const p = toPage(data, 25);
            return (
              <>
                <TableWrap>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className={thClass}>Enviado em</th>
                        <th className={thClass}>Destinatário</th>
                        <th className={thClass}>Tipo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {p.items.map((r, i) => (
                        <tr key={r.id ?? i}>
                          <td className={`${tdClass} whitespace-nowrap`}>{dateTime(r.sentAt ?? r.createdAt)}</td>
                          <td className={tdClass}>
                            {r.userId
                              ? <Link className="text-emerald-400 hover:underline break-all" to={`/users/${r.userId}`}>{r.email ?? r.userEmail ?? r.userId}</Link>
                              : (r.email ?? r.userEmail ?? '—')}
                          </td>
                          <td className={tdClass}><Badge>{kindLabel(r.kind)}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
                <Pagination page={p.page} pageSize={p.pageSize} total={p.total} onChange={setPage} />
              </>
            );
          }}
        </AsyncView>
      </div>
    </Card>
  );
}

export default function Emails() {
  const [tab, setTab] = useState('settings');
  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <PageHeader title="E-mails" subtitle="Lembretes automáticos: quando enviar, o que enviar e o que já foi enviado." />
      <div className="inline-flex rounded-lg border border-gray-800 bg-gray-900 p-0.5 mb-4" role="tablist">
        {[['settings', 'Configurações'], ['sent', 'Enviados']].map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${tab === value ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'settings' ? <SettingsTab /> : <SentTab />}
    </div>
  );
}
