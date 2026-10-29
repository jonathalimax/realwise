import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, CalendarClock, Clock, Crown, Play, Save, Trash2 } from 'lucide-react';
import { usersResource } from '../../lib/api/resources/users';
import { friendlyError } from '../../lib/api/errors';
import { useAsync } from '../../lib/useAsync';
import { dateTime, date, num, usd, ms } from '../../lib/format';
import {
  AsyncView, Badge, Button, Card, ConfirmDialog, EmptyState, Field, InlineMessage, TableWrap, Toast,
  Toggle, inputClass, tdClass, thClass,
} from '../../components/ui';
import { AccessBadge } from '../../components/userBits';

const SUPPORT_TONE = { open: 'amber', answered: 'green', closed: 'gray' };
const SUPPORT_LABEL = { open: 'Aberta', answered: 'Respondida', closed: 'Fechada' };

function pick(obj, ...keys) {
  for (const k of keys) if (obj?.[k] !== undefined && obj?.[k] !== null) return obj[k];
  return undefined;
}

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <dt className="text-gray-400 flex-shrink-0">{label}</dt>
      <dd className="text-gray-100 text-right min-w-0 break-words">{children ?? '—'}</dd>
    </div>
  );
}

function TrialDialog({ open, mode, onClose, onSubmit }) {
  const [days, setDays] = useState('7');
  useEffect(() => { if (open) setDays('7'); }, [open]);
  const n = Number(days);
  const valid = Number.isInteger(n) && n > 0 && n <= 3650;
  const title = mode === 'start_trial' ? 'Iniciar período de teste' : 'Estender período de teste';
  return (
    <ConfirmDialog
      open={open}
      title={title}
      confirmLabel={mode === 'start_trial' ? 'Iniciar teste' : 'Estender'}
      tone="primary"
      onClose={onClose}
      onConfirm={() => onSubmit({ action: mode, days: n })}
      description={mode === 'start_trial'
        ? 'Reinicia o teste a partir de hoje pelo número de dias informado.'
        : 'Soma os dias ao fim do teste atual (ou a partir de hoje, se já terminou).'}
    >
      <Field label="Dias">
        <input className={inputClass} type="number" min="1" max="3650" value={days} onChange={(e) => setDays(e.target.value)} />
      </Field>
      {!valid && <InlineMessage tone="warning">Informe um número inteiro de dias entre 1 e 3650.</InlineMessage>}
    </ConfirmDialog>
  );
}

function GrantUntilDialog({ open, onClose, onSubmit }) {
  const [until, setUntil] = useState('');
  const todayIso = new Date().toISOString().slice(0, 10);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(until) && until > todayIso;
  return (
    <ConfirmDialog
      open={open}
      title="Conceder acesso até uma data"
      confirmLabel="Conceder"
      tone="primary"
      onClose={onClose}
      onConfirm={() => valid && onSubmit({ action: 'grant_until', until })}
      description="Acesso completo e gratuito até o fim do dia escolhido (horário de Brasília). Depois disso, o usuário precisa assinar."
    >
      <Field label="Acesso até">
        <input className={inputClass} type="date" min={todayIso} value={until} onChange={(e) => setUntil(e.target.value)} />
      </Field>
      {!valid && <InlineMessage tone="warning">Escolha uma data futura.</InlineMessage>}
    </ConfirmDialog>
  );
}

function ProfileForm({ user, onSaved, notify }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm({
      name: user.name ?? '',
      email: user.email ?? '',
      adminNote: user.adminNote ?? '',
      reminderEmailsOptOut: Boolean(user.reminderEmailsOptOut),
      marketingEmailsOptOut: Boolean(user.marketingEmailsOptOut),
      budget: user.llmBudgetOverrideUsd === null || user.llmBudgetOverrideUsd === undefined ? '' : String(user.llmBudgetOverrideUsd),
    });
  }, [user]);

  if (!form) return null;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const budgetNum = form.budget.trim() === '' ? null : Number(form.budget.replace(',', '.'));
  const budgetInvalid = budgetNum !== null && (!Number.isFinite(budgetNum) || budgetNum < 0);

  async function save() {
    setSaving(true);
    setError('');
    try {
      await usersResource.update(user.id, {
        name: form.name.trim(),
        email: form.email.trim(),
        adminNote: form.adminNote,
        reminderEmailsOptOut: form.reminderEmailsOptOut,
        marketingEmailsOptOut: form.marketingEmailsOptOut,
        llmBudgetOverrideUsd: budgetNum,
      });
      notify('Alterações salvas.');
      onSaved();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Dados e preferências">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Nome"><input className={inputClass} value={form.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="E-mail"><input className={inputClass} type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} /></Field>
        <Field
          label="Limite mensal de IA (US$)"
          hint="Vazio usa o padrão do plano. Vale para teste e assinatura."
          className="sm:col-span-2"
        >
          <input className={inputClass} inputMode="decimal" placeholder="Padrão" value={form.budget} onChange={(e) => set({ budget: e.target.value })} />
        </Field>
        <Field label="Nota interna" className="sm:col-span-2">
          <textarea className={`${inputClass} min-h-24`} value={form.adminNote} onChange={(e) => set({ adminNote: e.target.value })} placeholder="Visível apenas para administradores" />
        </Field>
      </div>
      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-gray-200">Não receber lembretes por e-mail</p>
            <p className="text-xs text-gray-500">Lembretes de contas a pagar e de engajamento.</p>
          </div>
          <Toggle checked={form.reminderEmailsOptOut} onChange={(v) => set({ reminderEmailsOptOut: v })} label="Desativar lembretes" />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-gray-200">Não receber e-mails de marketing</p>
            <p className="text-xs text-gray-500">Fica fora de qualquer campanha.</p>
          </div>
          <Toggle checked={form.marketingEmailsOptOut} onChange={(v) => set({ marketingEmailsOptOut: v })} label="Desativar marketing" />
        </div>
      </div>
      {budgetInvalid && <div className="mt-3"><InlineMessage tone="warning">O limite precisa ser um número maior ou igual a zero.</InlineMessage></div>}
      {error && <div className="mt-3"><InlineMessage>{error}</InlineMessage></div>}
      <div className="mt-4 flex justify-end">
        <Button variant="primary" icon={Save} onClick={save} loading={saving} disabled={budgetInvalid}>Salvar alterações</Button>
      </div>
    </Card>
  );
}

function Detail({ user: u, reload, notify }) {
  const navigate = useNavigate();
  const [dialog, setDialog] = useState(null);
  const counts = u.counts ?? u;
  const sub = u.subscription ?? u;
  const llm = pick(u, 'recentLlmCalls', 'llmCalls', 'lastLlmCalls') ?? [];
  const support = pick(u, 'supportMessages', 'support') ?? [];
  const audit = pick(u, 'auditEntries', 'audit', 'auditLog') ?? [];
  const isOwner = u.access?.state === 'owner' || u.role === 'admin';
  const state = u.access?.state;

  async function runPlan(body, okMessage) {
    await usersResource.plan(u.id, body);
    notify(okMessage);
    reload(true);
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-white truncate">{u.name || u.email}</h2>
              <AccessBadge access={u.access} />
            </div>
            <p className="text-sm text-gray-400 truncate">{u.email}</p>
            <p className="text-xs text-gray-500 mt-1">
              Cadastro em {date(u.createdAt)} · Última atividade {u.lastActiveAt ? dateTime(u.lastActiveAt) : 'sem registro'} · IA no mês {usd(u.aiCostMonthUsd)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={Clock} onClick={() => setDialog('extend_trial')} disabled={isOwner}>Estender teste</Button>
            <Button size="sm" icon={Play} onClick={() => setDialog('start_trial')} disabled={isOwner}>Iniciar teste</Button>
            <Button size="sm" icon={CalendarClock} onClick={() => setDialog('grant_until')} disabled={isOwner || state === 'lifetime'}>Acesso até data</Button>
            <Button size="sm" icon={Crown} onClick={() => setDialog('grant_lifetime')} disabled={isOwner || state === 'lifetime'}>Vitalício</Button>
            <Button size="sm" variant="dangerOutline" icon={Ban} onClick={() => setDialog('revoke')} disabled={isOwner || state === 'blocked'}>Revogar acesso</Button>
          </div>
        </div>
        {isOwner && <p className="text-xs text-gray-500 mt-3">Contas de proprietário/admin não podem ter o plano alterado nem ser excluídas.</p>}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4 min-w-0">
          <ProfileForm user={u} onSaved={() => reload(true)} notify={notify} />

          <Card title="Últimas chamadas de IA" padded={false}>
            {llm.length === 0 ? (
              <EmptyState title="Nenhuma chamada de IA" />
            ) : (
              <div className="px-3 sm:px-4 pb-3">
                <TableWrap>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className={thClass}>Quando</th>
                        <th className={thClass}>Finalidade</th>
                        <th className={thClass}>Modelo</th>
                        <th className={`${thClass} text-right`}>Custo</th>
                        <th className={`${thClass} text-right`}>Latência</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {llm.map((c, i) => (
                        <tr key={c.id ?? i}>
                          <td className={`${tdClass} whitespace-nowrap`}>{dateTime(c.createdAt)}</td>
                          <td className={tdClass}>{c.purpose ?? '—'}</td>
                          <td className={`${tdClass} whitespace-nowrap`}>{c.model ?? '—'}{c.error && <Badge tone="red" className="ml-2">erro</Badge>}</td>
                          <td className={`${tdClass} text-right`}>{usd(c.costUsd)}</td>
                          <td className={`${tdClass} text-right`}>{ms(c.latencyMs)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              </div>
            )}
          </Card>

          <Card title="Mensagens de suporte" padded={false}>
            {support.length === 0 ? (
              <EmptyState title="Sem mensagens de suporte" />
            ) : (
              <ul className="divide-y divide-gray-800">
                {support.map((m) => (
                  <li key={m.id}>
                    <Link to={`/support/${m.id}`} className="block px-4 py-3 hover:bg-gray-800/40">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-white truncate">{m.subject || 'Sem assunto'}</p>
                        <Badge tone={SUPPORT_TONE[m.status] ?? 'gray'}>{SUPPORT_LABEL[m.status] ?? m.status}</Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{m.message}</p>
                      <p className="text-[11px] text-gray-600 mt-1">{dateTime(m.createdAt)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Histórico administrativo" padded={false}>
            {audit.length === 0 ? (
              <EmptyState title="Sem ações registradas" />
            ) : (
              <ul className="divide-y divide-gray-800">
                {audit.map((a, i) => (
                  <li key={a.id ?? i} className="px-4 py-2.5 text-sm">
                    <p className="text-gray-200">{a.action}</p>
                    <p className="text-xs text-gray-500">{a.adminEmail ?? 'admin'} · {dateTime(a.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Uso">
            <dl className="divide-y divide-gray-800">
              <Row label="Contas">{num(pick(counts, 'accounts', 'accountCount'))}</Row>
              <Row label="Transações">{num(pick(counts, 'transactions', 'transactionCount'))}</Row>
              <Row label="Importações">{num(pick(counts, 'imports', 'importCount'))}</Row>
              <Row label="Mensagens no chat">{num(pick(counts, 'chatMessages', 'chatMessageCount'))}</Row>
            </dl>
          </Card>

          <Card title="Assinatura">
            <dl className="divide-y divide-gray-800">
              <Row label="Situação">{u.access?.state ?? '—'}</Row>
              <Row label="Status Stripe">{pick(sub, 'status', 'premiumStatus', 'stripeStatus')}</Row>
              <Row label="Plano">{u.access?.plan ?? pick(sub, 'plan')}</Row>
              <Row label="Fim do período">{(() => { const v = pick(sub, 'currentPeriodEnd', 'periodEnd', 'premiumAccessEndsAt'); return v ? dateTime(v) : null; })()}</Row>
              <Row label="Cliente Stripe"><span className="font-mono text-xs">{pick(sub, 'stripeCustomerId', 'customerId')}</span></Row>
              <Row label="Assinatura Stripe"><span className="font-mono text-xs">{pick(sub, 'stripeSubscriptionId', 'subscriptionId')}</span></Row>
            </dl>
          </Card>

          <Card title="Zona de risco">
            <p className="text-xs text-gray-400 mb-3">Excluir apaga a conta e todos os dados do usuário, e cancela a assinatura. Não há como desfazer.</p>
            <Button variant="danger" icon={Trash2} className="w-full" onClick={() => setDialog('delete')} disabled={isOwner}>Excluir usuário</Button>
          </Card>
        </div>
      </div>

      <TrialDialog
        open={dialog === 'extend_trial' || dialog === 'start_trial'}
        mode={dialog === 'start_trial' ? 'start_trial' : 'extend_trial'}
        onClose={() => setDialog(null)}
        onSubmit={(body) => runPlan(body, body.action === 'start_trial' ? 'Teste iniciado.' : 'Teste estendido.')}
      />
      {/* Mounted only while open so the date field starts empty every time. */}
      {dialog === 'grant_until' && (
        <GrantUntilDialog
          open
          onClose={() => setDialog(null)}
          onSubmit={(body) => runPlan(body, 'Acesso concedido até a data escolhida.')}
        />
      )}
      <ConfirmDialog
        open={dialog === 'grant_lifetime'}
        title="Conceder acesso vitalício"
        confirmLabel="Conceder"
        tone="primary"
        description={`${u.email} passará a ter acesso completo sem assinatura e sem data de término.`}
        onClose={() => setDialog(null)}
        onConfirm={() => runPlan({ action: 'grant_lifetime' }, 'Acesso vitalício concedido.')}
      />
      <ConfirmDialog
        open={dialog === 'revoke'}
        title="Revogar acesso"
        confirmLabel="Revogar acesso"
        description={`${u.email} perderá o acesso imediatamente. Se houver assinatura ativa no Stripe, ela precisa ser cancelada antes.`}
        onClose={() => setDialog(null)}
        onConfirm={() => runPlan({ action: 'revoke' }, 'Acesso revogado.')}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        title="Excluir usuário"
        confirmLabel="Excluir definitivamente"
        confirmText={u.email}
        description="Todos os dados desta conta serão apagados de forma permanente. Esta ação não pode ser desfeita."
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          await usersResource.remove(u.id);
          navigate('/users', { replace: true });
        }}
      />
    </div>
  );
}

export default function UserDetail() {
  const { id } = useParams();
  const state = useAsync(() => usersResource.get(id), id);
  const [toast, setToast] = useState('');

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <Link to="/users" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-4">
        <ArrowLeft className="w-4 h-4" /> Usuários
      </Link>
      <AsyncView state={state} isEmpty={(d) => !d}>
        {(user) => <Detail user={user} reload={state.reload} notify={setToast} />}
      </AsyncView>
      <Toast message={toast} onDone={() => setToast('')} />
    </div>
  );
}
