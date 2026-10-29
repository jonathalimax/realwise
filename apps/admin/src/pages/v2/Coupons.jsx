import { useState } from 'react';
import { Plus } from 'lucide-react';
import { couponsResource } from '../../lib/api/resources/landing';
import { useAsync } from '../../lib/useAsync';
import { brl, date, num } from '../../lib/format';
import { AsyncView, Badge, Button, Card, EmptyState, Field, InlineMessage, Modal, PageHeader, TableWrap, Toast, inputClass, tdClass, thClass } from '../../components/ui';

const DURATION = { once: 'Primeira cobrança', forever: 'Para sempre', repeating: 'Por alguns meses' };
const EMPTY = { code: '', kind: 'percent', value: '', duration: 'once', durationInMonths: '3', maxRedemptions: '', expiresAt: '' };

const discountLabel = (c) =>
  c.percentOff ? `${c.percentOff}%` : c.amountOff ? brl(c.amountOff) : '—';

function CreateModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await couponsResource.create({
        code: form.code.trim(),
        percentOff: form.kind === 'percent' ? Number(form.value) : undefined,
        amountOffReais: form.kind === 'amount' ? Number(form.value) : undefined,
        duration: form.duration,
        durationInMonths: form.duration === 'repeating' ? Number(form.durationInMonths) : undefined,
        maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : undefined,
        expiresAt: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59`).toISOString() : undefined,
      });
      setForm(EMPTY);
      onCreated();
    } catch (e) {
      setError(e?.message || 'Não foi possível criar o código.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo código promocional"
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" loading={busy} disabled={!form.code || !form.value} onClick={submit}>Criar no Stripe</Button></>}
    >
      <div className="space-y-3">
        <InlineMessage>{error}</InlineMessage>
        <Field label="Código" hint="3 a 30 letras ou números. É o que o cliente digita no pagamento.">
          <input className={inputClass} value={form.code} onChange={set('code')} placeholder="BEMVINDO20" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo de desconto">
            <select className={inputClass} value={form.kind} onChange={set('kind')}>
              <option value="percent">Porcentagem (%)</option>
              <option value="amount">Valor fixo (R$)</option>
            </select>
          </Field>
          <Field label={form.kind === 'percent' ? 'Desconto (%)' : 'Desconto (R$)'}>
            <input className={inputClass} type="number" min="1" value={form.value} onChange={set('value')} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vale para">
            <select className={inputClass} value={form.duration} onChange={set('duration')}>
              {Object.entries(DURATION).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
            </select>
          </Field>
          {form.duration === 'repeating' && (
            <Field label="Quantos meses">
              <input className={inputClass} type="number" min="1" max="36" value={form.durationInMonths} onChange={set('durationInMonths')} />
            </Field>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Limite de usos" hint="Vazio = ilimitado">
            <input className={inputClass} type="number" min="1" value={form.maxRedemptions} onChange={set('maxRedemptions')} />
          </Field>
          <Field label="Válido até" hint="Vazio = sem validade">
            <input className={inputClass} type="date" value={form.expiresAt} onChange={set('expiresAt')} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

export default function Coupons() {
  const state = useAsync(() => couponsResource.list(), 'coupons');
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const toggle = async (c) => {
    setError('');
    try {
      await couponsResource.setActive(c.id, !c.active);
      state.reload(true);
    } catch (e) {
      setError(e?.message || 'Não foi possível alterar.');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Códigos promocionais"
        subtitle="Gerenciados no Stripe: o cliente digita o código na tela de pagamento"
        actions={<Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>Novo código</Button>}
      />
      <InlineMessage>{error}</InlineMessage>
      <Card padded={false}>
        <AsyncView
          state={state}
          isEmpty={(d) => !d?.length}
          empty={<EmptyState title="Nenhum código ainda" description="Crie um código e compartilhe com seus clientes ou use nas campanhas." />}
        >
          {(rows) => (
            <TableWrap>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className={thClass}>Código</th>
                    <th className={thClass}>Desconto</th>
                    <th className={thClass}>Vale para</th>
                    <th className={`${thClass} text-right`}>Usos</th>
                    <th className={thClass}>Validade</th>
                    <th className={thClass}>Status</th>
                    <th className={thClass} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {rows.map((c) => (
                    <tr key={c.id}>
                      <td className={`${tdClass} font-mono text-white`}>{c.code}</td>
                      <td className={tdClass}>{discountLabel(c)}</td>
                      <td className={tdClass}>{DURATION[c.duration]}{c.duration === 'repeating' ? ` (${c.durationInMonths} meses)` : ''}</td>
                      <td className={`${tdClass} text-right`}>{num(c.timesRedeemed)}{c.maxRedemptions ? ` / ${num(c.maxRedemptions)}` : ''}</td>
                      <td className={tdClass}>{c.expiresAt ? date(c.expiresAt) : '—'}</td>
                      <td className={tdClass}><Badge tone={c.active ? 'green' : 'gray'}>{c.active ? 'ativo' : 'inativo'}</Badge></td>
                      <td className={`${tdClass} text-right`}><Button size="sm" onClick={() => toggle(c)}>{c.active ? 'Desativar' : 'Ativar'}</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </AsyncView>
      </Card>
      <CreateModal open={creating} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); setToast('Código criado no Stripe.'); state.reload(true); }} />
      {toast && <Toast message={toast} onDone={() => setToast('')} />}
    </div>
  );
}
