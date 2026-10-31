import { useState } from 'react';
import { HeartHandshake, Save, UserMinus } from 'lucide-react';
import { retentionResource } from '../../lib/api/resources/retention';
import { friendlyError } from '../../lib/api/errors';
import { useAsync } from '../../lib/useAsync';
import { brl, dateTime, num } from '../../lib/format';
import { AsyncView, Badge, Button, Card, EmptyState, Field, PageHeader, Stat, TableWrap, Toast, Toggle, inputClass, tdClass, thClass } from '../../components/ui';

const REASON = {
  too_expensive: 'Caro demais', missing_features: 'Faltam recursos', switched_service: 'Foi para outro serviço', unused: 'Não usa o suficiente',
  customer_service: 'Atendimento', too_complex: 'Difícil de usar', low_quality: 'Qualidade', other: 'Outro motivo',
};
const OFFER = { discount: 'Desconto', free_month: '1 mês grátis' };
const OUTCOME = { accepted: ['green', 'Ficou'], declined: ['red', 'Cancelou (viu oferta)'], cancelled: ['red', 'Cancelou'], pending: ['gray', 'Em andamento'] };
const EMAIL_LABEL = {
  payment_failed: 'Pagamento falhou', payment_failed_followup: 'Aviso: acesso será pausado',
  winback_7: 'Volta: 7 dias', winback_30: 'Volta: 30 dias (com código)', winback_60: 'Volta: 60 dias (com código)',
};

function SettingsCard() {
  const state = useAsync(() => retentionResource.settings(), 'ret-settings');
  return <AsyncView state={state}>{(data) => <SettingsForm initial={data} />}</AsyncView>;
}

function SettingsForm({ initial }) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState({ message: '', tone: 'success' });
  const num_ = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setBusy(true);
    try {
      const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === 'boolean' ? v : Number(v)]));
      setForm(await retentionResource.saveSettings(body));
      setToast({ message: 'Configuração salva.', tone: 'success' });
    } catch (e) {
      setToast({ message: friendlyError(e), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Ofertas para quem quer cancelar" subtitle="Aparecem no fluxo de cancelamento do app, uma vez por cliente. Quem quiser cancelar sempre consegue.">
      <div className="space-y-4">
        <div className="flex items-center gap-3"><Toggle checked={form.enabled} onChange={(v) => setForm((f) => ({ ...f, enabled: v }))} label="Mostrar oferta" /><span className="text-sm text-gray-300">Mostrar uma oferta antes de cancelar</span></div>
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <Field label="Desconto (%)" hint="Para “caro demais” e “vou usar outro”."><input className={inputClass} type="number" min="5" max="90" value={form.discountPercent} onChange={num_('discountPercent')} /></Field>
          <Field label="Por quantos meses"><input className={inputClass} type="number" min="1" max="12" value={form.discountMonths} onChange={num_('discountMonths')} /></Field>
        </div>
        <div className="flex items-center gap-3"><Toggle checked={form.freeMonthEnabled} onChange={(v) => setForm((f) => ({ ...f, freeMonthEnabled: v }))} label="Mês grátis" /><span className="text-sm text-gray-300">Oferecer 1 mês grátis para quem “não usa o suficiente”</span></div>
        <div>
          <p className="text-sm font-medium text-gray-200 mb-2">Código de volta (e-mails de 30 e 60 dias depois de sair)</p>
          <div className="grid grid-cols-3 gap-3 sm:max-w-lg">
            <Field label="Desconto (%)"><input className={inputClass} type="number" min="5" max="90" value={form.winbackPercent} onChange={num_('winbackPercent')} /></Field>
            <Field label="Meses"><input className={inputClass} type="number" min="1" max="12" value={form.winbackMonths} onChange={num_('winbackMonths')} /></Field>
            <Field label="Validade (dias)"><input className={inputClass} type="number" min="3" max="60" value={form.winbackValidDays} onChange={num_('winbackValidDays')} /></Field>
          </div>
        </div>
        <Button variant="primary" icon={Save} loading={busy} onClick={save}>Salvar</Button>
      </div>
      <Toast message={toast.message} tone={toast.tone} onDone={() => setToast({ message: '', tone: 'success' })} />
    </Card>
  );
}

export default function Churn() {
  const [days, setDays] = useState(90);
  const summary = useAsync(() => retentionResource.summary(days), String(days));
  return (
    <div className="space-y-4">
      <PageHeader title="Cancelamentos" subtitle="Por que as pessoas saem, o que oferecemos e quantas ficaram."
        actions={<select className={`${inputClass} w-auto`} value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={30}>30 dias</option><option value={90}>90 dias</option><option value={365}>12 meses</option></select>} />
      <AsyncView state={summary}>
        {(d) => {
          const decided = d.totals.accepted + d.totals.cancelled;
          return (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Stat label="Iniciaram o cancelamento" value={num(d.totals.started)} icon={UserMinus} />
                <Stat label="Ficaram com a oferta" value={num(d.totals.accepted)} icon={HeartHandshake} tone="text-emerald-400" hint={decided ? `${Math.round((d.totals.accepted / decided) * 100)}% das decisões` : undefined} />
                <Stat label="Cancelaram" value={num(d.totals.cancelled)} tone={d.totals.cancelled ? 'text-red-400' : 'text-white'} />
                <Stat label="Mensalidade mantida" value={brl(d.totals.keptListCents)} hint="Preço de tabela de quem ficou" />
              </div>

              <Card title="Motivos" padded={false}>
                {d.byReason.length === 0 ? <EmptyState title="Ainda sem cancelamentos no período" description="Os motivos aparecem aqui assim que alguém passar pelo fluxo de cancelamento." /> : (
                  <TableWrap><table className="min-w-full"><thead><tr><th className={thClass}>Motivo</th><th className={thClass}>Total</th><th className={thClass}>Com oferta</th><th className={thClass}>Ficaram</th><th className={thClass}>Cancelaram</th></tr></thead>
                    <tbody className="divide-y divide-gray-800">{d.byReason.map((r) => (
                      <tr key={r.reason}><td className={tdClass}>{REASON[r.reason] ?? r.reason}</td><td className={tdClass}>{r.total}</td><td className={tdClass}>{r.offered}</td><td className={tdClass}>{r.accepted}</td><td className={tdClass}>{r.cancelled}</td></tr>
                    ))}</tbody></table></TableWrap>
                )}
              </Card>

              <Card title="E-mails de recuperação enviados" subtitle={`Últimos ${d.days} dias`}>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {Object.keys(EMAIL_LABEL).map((k) => (
                    <div key={k} className="rounded-xl border border-gray-800 p-3"><p className="text-xs text-gray-500">{EMAIL_LABEL[k]}</p><p className="text-xl font-bold text-white mt-1">{num(d.emails[k] ?? 0)}</p></div>
                  ))}
                </div>
              </Card>

              <Card title="Respostas recentes" padded={false}>
                {d.recent.length === 0 ? <EmptyState title="Nada por aqui ainda" /> : (
                  <TableWrap><table className="min-w-full"><thead><tr><th className={thClass}>Quando</th><th className={thClass}>Cliente</th><th className={thClass}>Motivo</th><th className={thClass}>Oferta</th><th className={thClass}>Resultado</th></tr></thead>
                    <tbody className="divide-y divide-gray-800">{d.recent.map((r) => (
                      <tr key={r.id}>
                        <td className={tdClass}>{dateTime(r.createdAt)}</td>
                        <td className={tdClass}>{r.email ?? '—'}{r.planLabel && <div className="text-xs text-gray-500">{r.planLabel}{r.amountCents ? ` · ${brl(r.amountCents)}` : ''}</div>}</td>
                        <td className={tdClass}>{REASON[r.reason] ?? r.reason}{r.comment && <div className="text-xs text-gray-400 mt-0.5 max-w-xs break-words">“{r.comment}”</div>}</td>
                        <td className={tdClass}>{r.offerKind ? OFFER[r.offerKind] : '—'}</td>
                        <td className={tdClass}><Badge tone={(OUTCOME[r.outcome] ?? OUTCOME.pending)[0]}>{(OUTCOME[r.outcome] ?? OUTCOME.pending)[1]}</Badge></td>
                      </tr>
                    ))}</tbody></table></TableWrap>
                )}
              </Card>
            </>
          );
        }}
      </AsyncView>
      <SettingsCard />
    </div>
  );
}
