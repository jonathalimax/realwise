import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, Megaphone, Save, Send, Trash2, Users } from 'lucide-react';
import { campaignsResource } from '../../lib/api/resources/campaigns';
import { friendlyError } from '../../lib/api/errors';
import { toPage } from '../../lib/api/query';
import { useAsync, useDebounced } from '../../lib/useAsync';
import { dateTime, fromLocalInput, num, toLocalInput } from '../../lib/format';
import {
  AsyncView, Badge, Button, Card, ConfirmDialog, EmptyState, Field, InlineMessage, LoadingBlock, Pagination, TableWrap, Toast,
  inputClass, tdClass, thClass,
} from '../../components/ui';
import { CampaignStatus } from './Campaigns';

const SEGMENT_STATES = [
  { value: 'trial', label: 'Em teste' },
  { value: 'subscribed', label: 'Assinantes' },
  { value: 'lifetime', label: 'Vitalícios' },
  { value: 'blocked', label: 'Bloqueados / expirados' },
];

const BLANK = {
  name: '', subject: '', body: '', ctaLabel: '', ctaUrl: '',
  segment: { audience: 'users', states: [], signedUpAfter: '', signedUpBefore: '', hasImported: '', inactiveDays: '' },
  scheduledAt: '',
};

function segmentToApi(seg) {
  const out = {};
  if (seg.audience && seg.audience !== 'users') out.audience = seg.audience;
  if (seg.states?.length) out.states = seg.states;
  if (seg.signedUpAfter) out.signedUpAfter = seg.signedUpAfter;
  if (seg.signedUpBefore) out.signedUpBefore = seg.signedUpBefore;
  if (seg.hasImported === 'yes') out.hasImported = true;
  if (seg.hasImported === 'no') out.hasImported = false;
  if (String(seg.inactiveDays).trim() !== '' && Number(seg.inactiveDays) > 0) out.inactiveDays = Number(seg.inactiveDays);
  return out;
}

function segmentFromApi(seg = {}) {
  return {
    audience: seg.audience ?? 'users',
    states: Array.isArray(seg.states) ? seg.states : [],
    signedUpAfter: seg.signedUpAfter ? String(seg.signedUpAfter).slice(0, 10) : '',
    signedUpBefore: seg.signedUpBefore ? String(seg.signedUpBefore).slice(0, 10) : '',
    hasImported: seg.hasImported === true ? 'yes' : seg.hasImported === false ? 'no' : '',
    inactiveDays: seg.inactiveDays ? String(seg.inactiveDays) : '',
  };
}

function EmailPreview({ form }) {
  const paragraphs = form.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className="rounded-xl overflow-hidden border border-gray-800 bg-[#f3f4f6] text-gray-800">
      <div className="bg-white border-b border-gray-200 px-4 py-2.5">
        <p className="text-[11px] text-gray-400">Assunto</p>
        <p className="text-sm font-semibold text-gray-900 break-words">{form.subject || 'Sem assunto'}</p>
      </div>
      <div className="p-4">
        <div className="mx-auto max-w-md bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <img src="/logo.png" alt="" className="w-7 h-7 rounded-lg object-contain" />
            <span className="font-bold text-emerald-600">Realwise</span>
          </div>
          <p className="text-sm mb-3">Olá, <span className="font-medium">Nome</span>!</p>
          {paragraphs.length === 0 && <p className="text-sm text-gray-400">O texto do e-mail aparece aqui.</p>}
          {paragraphs.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed mb-3 whitespace-pre-line break-words">{p}</p>
          ))}
          {form.ctaLabel && (
            <div className="my-4">
              <span className="inline-block rounded-lg bg-emerald-600 text-white text-sm font-semibold px-5 py-2.5">{form.ctaLabel}</span>
            </div>
          )}
          <hr className="my-4 border-gray-200" />
          <p className="text-[11px] text-gray-400">Você recebe este e-mail por ter uma conta no Realwise. <span className="underline">Cancelar inscrição</span></p>
        </div>
      </div>
    </div>
  );
}

function Audience({ segment }) {
  const apiSegment = useMemo(() => segmentToApi(segment), [segment]);
  const key = useDebounced(JSON.stringify(apiSegment), 500);
  const state = useAsync(() => campaignsResource.audience(JSON.parse(key)), key);
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950 p-3">
      <div className="flex items-center gap-2 text-sm">
        <Users className="w-4 h-4 text-emerald-400" />
        {state.loading && !state.data ? <span className="text-gray-500">Calculando público…</span>
          : state.error ? <span className="text-gray-400">{friendlyError(state.error)}</span>
          : <span className="text-white font-semibold">{num(state.data?.count)} <span className="font-normal text-gray-400">destinatários{state.data?.leads > 0 ? ` (${num(state.data.users)} usuários · ${num(state.data.leads)} leads)` : ''}</span></span>}
      </div>
      {state.data?.sample?.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {state.data.sample.slice(0, 5).map((s, i) => (
            <li key={i} className="text-xs text-gray-500 truncate">{s.name ? `${s.name} · ` : ''}{s.email}</li>
          ))}
          {state.data.count > 5 && <li className="text-xs text-gray-600">e mais…</li>}
        </ul>
      )}
    </div>
  );
}

function Results({ id }) {
  const [page, setPage] = useState(1);
  const state = useAsync(() => campaignsResource.sends(id, { page, pageSize: 25 }), `${id}-${page}`);
  return (
    <Card title="Resultados do envio" padded={false}>
      <div className="px-3 sm:px-4 pb-4">
        <AsyncView
          state={state}
          isEmpty={(d) => toPage(d).items.length === 0}
          empty={<EmptyState title="Nenhum envio registrado" description="Os envios aparecem aqui conforme a campanha é processada." />}
        >
          {(data) => {
            const p = toPage(data, 25);
            return (
              <>
                <TableWrap>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className={thClass}>Destinatário</th>
                        <th className={thClass}>Status</th>
                        <th className={thClass}>Quando</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {p.items.map((s, i) => (
                        <tr key={s.id ?? i}>
                          <td className={`${tdClass} break-all`}>{s.email}</td>
                          <td className={tdClass}>
                            {s.status === 'failed'
                              ? <span><Badge tone="red">Falhou</Badge>{s.error && <span className="block text-[10px] text-red-300/80 mt-0.5 max-w-[240px] truncate">{s.error}</span>}</span>
                              : <Badge tone="green">Enviado</Badge>}
                          </td>
                          <td className={`${tdClass} whitespace-nowrap`}>{dateTime(s.sentAt)}</td>
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

function Editor({ initial, id }) {
  const navigate = useNavigate();
  const [form, setForm] = useState(initial);
  const [campaignId, setCampaignId] = useState(id);
  const [status, setStatus] = useState(initial.status ?? 'draft');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [scheduleAt, setScheduleAt] = useState(toLocalInput(initial.scheduledAt));

  const readOnly = status !== 'draft';
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setSeg = (patch) => setForm((f) => ({ ...f, segment: { ...f.segment, ...patch } }));
  const valid = form.name.trim() && form.subject.trim() && form.body.trim().length >= 5 && (!form.ctaLabel.trim() || /^https?:\/\//i.test(form.ctaUrl.trim()));

  function payload() {
    return {
      name: form.name.trim(),
      subject: form.subject.trim(),
      body: form.body,
      ctaLabel: form.ctaLabel.trim() || null,
      ctaUrl: form.ctaLabel.trim() ? form.ctaUrl.trim() : null,
      segment: segmentToApi(form.segment),
    };
  }

  async function persist() {
    if (campaignId) {
      await campaignsResource.update(campaignId, payload());
      return campaignId;
    }
    const created = await campaignsResource.create(payload());
    setCampaignId(created.id);
    return created.id;
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const wasNew = !campaignId;
      const cid = await persist();
      setToast('Rascunho salvo.');
      if (wasNew) navigate(`/campaigns/${cid}`, { replace: true });
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
      const cid = await persist();
      await campaignsResource.test(cid, testTo.trim());
      setTestMsg({ tone: 'success', text: `E-mail de teste enviado para ${testTo.trim()}.` });
    } catch (e) {
      setTestMsg({ tone: 'error', text: friendlyError(e) });
    } finally {
      setTesting(false);
    }
  }

  async function dispatch(at) {
    const cid = await persist();
    const result = await campaignsResource.send(cid, at);
    setStatus(result?.status ?? (at ? 'scheduled' : 'sending'));
    navigate('/campaigns', { replace: true });
  }

  const scheduleIso = fromLocalInput(scheduleAt);
  const scheduleValid = scheduleIso && new Date(scheduleIso).getTime() > Date.now();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {campaignId && <CampaignStatus status={status} />}
        {status === 'scheduled' && form.scheduledAt && <span className="text-xs text-gray-400">para {dateTime(form.scheduledAt)}</span>}
        {readOnly && <span className="text-xs text-gray-500">Campanhas fora do rascunho não podem ser editadas.</span>}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <Card title="Conteúdo">
            <fieldset disabled={readOnly} className="space-y-3 disabled:opacity-70">
              <Field label="Nome interno"><input className={inputClass} value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ex.: Reengajar quem não importou" /></Field>
              <Field label="Assunto do e-mail"><input className={inputClass} value={form.subject} onChange={(e) => set({ subject: e.target.value })} /></Field>
              <Field label="Texto" hint="Separe parágrafos com uma linha em branco. O e-mail usa o modelo visual da marca e sempre inclui o link de cancelamento.">
                <textarea className={`${inputClass} min-h-44`} value={form.body} onChange={(e) => set({ body: e.target.value })} />
              </Field>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Texto do botão (opcional)"><input className={inputClass} value={form.ctaLabel} onChange={(e) => set({ ctaLabel: e.target.value })} placeholder="Abrir o Realwise" /></Field>
                <Field label="Link do botão"><input className={inputClass} value={form.ctaUrl} onChange={(e) => set({ ctaUrl: e.target.value })} placeholder="https://" disabled={!form.ctaLabel.trim()} /></Field>
              </div>
              {form.ctaLabel.trim() && !/^https?:\/\//i.test(form.ctaUrl.trim()) && (
                <InlineMessage tone="warning">O link do botão precisa começar com http:// ou https://.</InlineMessage>
              )}
            </fieldset>
          </Card>

          <Card title="Público" subtitle="Quem receber a campanha. Vazio = todos que aceitam marketing.">
            <fieldset disabled={readOnly} className="space-y-4 disabled:opacity-70">
              <Field label="Para quem" hint="Leads são contatos da página inicial que aceitaram receber novidades. Quem já tem conta recebe uma vez só.">
                <select className={inputClass} value={form.segment.audience} onChange={(e) => setSeg({ audience: e.target.value })}>
                  <option value="users">Usuários cadastrados</option>
                  <option value="leads">Só leads (página inicial)</option>
                  <option value="all">Usuários e leads</option>
                </select>
              </Field>
              {form.segment.audience === 'leads' && (
                <InlineMessage tone="info">Os filtros de situação, importações e inatividade valem só para usuários cadastrados. Com “Só leads”, apenas as datas são usadas.</InlineMessage>
              )}
              <div>
                <p className="text-xs font-medium text-gray-400 mb-1.5">Situação do usuário</p>
                <div className="flex flex-wrap gap-2">
                  {SEGMENT_STATES.map((s) => {
                    const on = form.segment.states.includes(s.value);
                    return (
                      <button
                        key={s.value}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setSeg({ states: on ? form.segment.states.filter((x) => x !== s.value) : [...form.segment.states, s.value] })}
                        className={`px-3 py-1.5 rounded-lg border text-xs transition-colors ${on ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-white'}`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Cadastrado depois de"><input className={inputClass} type="date" value={form.segment.signedUpAfter} onChange={(e) => setSeg({ signedUpAfter: e.target.value })} /></Field>
                <Field label="Cadastrado antes de"><input className={inputClass} type="date" value={form.segment.signedUpBefore} onChange={(e) => setSeg({ signedUpBefore: e.target.value })} /></Field>
                <Field label="Já importou extrato?">
                  <select className={inputClass} value={form.segment.hasImported} onChange={(e) => setSeg({ hasImported: e.target.value })}>
                    <option value="">Tanto faz</option>
                    <option value="yes">Sim, já importou</option>
                    <option value="no">Não, nunca importou</option>
                  </select>
                </Field>
                <Field label="Inativo há pelo menos (dias)"><input className={inputClass} type="number" min="1" value={form.segment.inactiveDays} onChange={(e) => setSeg({ inactiveDays: e.target.value })} placeholder="Qualquer" /></Field>
              </div>
            </fieldset>
            <div className="mt-4"><Audience segment={form.segment} /></div>
          </Card>

          {error && <InlineMessage>{error}</InlineMessage>}

          {!readOnly && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                {campaignId && <Button variant="dangerOutline" icon={Trash2} onClick={() => setDialog('delete')}>Excluir rascunho</Button>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button icon={Save} onClick={save} loading={saving} disabled={!form.name.trim() || !form.subject.trim() || !form.body.trim()}>Salvar rascunho</Button>
                <Button icon={CalendarClock} onClick={() => setDialog('schedule')} disabled={!valid}>Agendar</Button>
                <Button variant="primary" icon={Send} onClick={() => setDialog('send')} disabled={!valid}>Enviar agora</Button>
              </div>
            </div>
          )}

          {campaignId && status !== 'draft' && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4"><p className="text-xs text-gray-400">Destinatários</p><p className="text-xl font-bold text-white">{num(initial.recipientCount)}</p></div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4"><p className="text-xs text-gray-400">Enviados</p><p className="text-xl font-bold text-emerald-400">{num(initial.sentCount)}</p></div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4"><p className="text-xs text-gray-400">Falhas</p><p className="text-xl font-bold text-red-400">{num(initial.failedCount)}</p></div>
            </div>
          )}
          {campaignId && status !== 'draft' && <Results id={campaignId} />}
        </div>

        <div className="space-y-4 xl:sticky xl:top-4">
          <Card title="Pré-visualização" subtitle="Atualiza enquanto você escreve">
            <EmailPreview form={form} />
          </Card>
          <Card title="Enviar teste" subtitle="Salva o rascunho e envia um exemplo.">
            <div className="flex gap-2">
              <input className={inputClass} type="email" placeholder="voce@email.com" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
              <Button icon={Send} onClick={sendTest} loading={testing} disabled={!/^\S+@\S+\.\S+$/.test(testTo.trim()) || !form.name.trim() || !form.subject.trim() || !form.body.trim()}>Testar</Button>
            </div>
            {testMsg && <div className="mt-3"><InlineMessage tone={testMsg.tone}>{testMsg.text}</InlineMessage></div>}
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={dialog === 'send'}
        title="Enviar campanha agora"
        confirmLabel="Enviar para todos"
        tone="danger"
        description="O e-mail será enviado de verdade para todo o público selecionado. Depois de iniciado, o envio não pode ser cancelado."
        onClose={() => setDialog(null)}
        onConfirm={() => dispatch(null)}
      >
        <Audience segment={form.segment} />
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === 'schedule'}
        title="Agendar campanha"
        confirmLabel="Agendar envio"
        tone="primary"
        description="A campanha será enviada automaticamente no horário escolhido (verificação de hora em hora)."
        onClose={() => setDialog(null)}
        confirmDisabled={!scheduleValid}
        onConfirm={() => dispatch(scheduleIso)}
      >
        <Field label="Data e hora do envio">
          <input className={inputClass} type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
        </Field>
        {!scheduleValid && <InlineMessage tone="warning">Escolha um horário no futuro.</InlineMessage>}
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === 'delete'}
        title="Excluir rascunho"
        confirmLabel="Excluir"
        description="O rascunho será apagado. Não há como desfazer."
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          await campaignsResource.remove(campaignId);
          navigate('/campaigns', { replace: true });
        }}
      />
      <Toast message={toast} onDone={() => setToast('')} />
    </div>
  );
}

export default function CampaignEditor() {
  const { id } = useParams();
  const state = useAsync(() => (id ? campaignsResource.get(id) : Promise.resolve(null)), id ?? 'new');

  const initial = useMemo(() => {
    const c = state.data;
    if (!c) return BLANK;
    return {
      ...BLANK,
      ...c,
      ctaLabel: c.ctaLabel ?? '',
      ctaUrl: c.ctaUrl ?? '',
      segment: segmentFromApi(c.segment),
    };
  }, [state.data]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <Link to="/campaigns" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-4">
        <ArrowLeft className="w-4 h-4" /> Campanhas
      </Link>
      <div className="mb-5">
        <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2"><Megaphone className="w-5 h-5 text-emerald-400" />{id ? 'Campanha' : 'Nova campanha'}</h1>
      </div>
      {id && state.loading && !state.data ? <LoadingBlock /> : id && state.error ? (
        <AsyncView state={state} isEmpty={() => false}>{() => null}</AsyncView>
      ) : (
        <Editor key={id ?? 'new'} initial={initial} id={id} />
      )}
    </div>
  );
}
