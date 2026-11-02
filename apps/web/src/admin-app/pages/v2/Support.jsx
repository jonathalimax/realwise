import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCheck, LifeBuoy, Plus, RotateCcw, Search, Send } from 'lucide-react';
import { usersResource } from '../../lib/api/resources/users';
import { supportResource } from '../../lib/api/resources/support';
import { friendlyError } from '../../lib/api/errors';
import { toPage } from '../../lib/api/query';
import { useAsync, useDebounced } from '../../lib/useAsync';
import { dateTime, relativeTime } from '../../lib/format';
import {
  AsyncView, Badge, Button, Card, ConfirmDialog, EmptyState, Field, InlineMessage, Modal, PageHeader, Pagination, Toast, inputClass,
} from '../../components/ui';

const STATUSES = [
  { value: '', label: 'Todas' },
  { value: 'open', label: 'Abertas' },
  { value: 'answered', label: 'Respondidas' },
  { value: 'closed', label: 'Fechadas' },
];
const TONE = { open: 'amber', answered: 'green', closed: 'gray' };
const LABEL = { open: 'Aberta', answered: 'Respondida', closed: 'Fechada' };
const CHANNELS = [
  { value: 'email', label: 'E-mail' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'phone', label: 'Telefone' },
  { value: 'other', label: 'Outro' },
];
const SOURCE_LABEL = {
  app: 'Dentro do app', login: 'Visitante (login)', email: 'Chegou por e-mail', whatsapp: 'Chegou por WhatsApp', phone: 'Chegou por telefone', other: 'Registrado por um admin',
};

/** Logs a conversation that happened outside the app (e-mail, WhatsApp, phone), attached to the person's account. */
function NewTicketModal({ open, onClose, prefill, onCreated }) {
  // Mounted only while open, so every opening starts from a clean form (no reset effect needed).
  return open ? <NewTicketForm onClose={onClose} prefill={prefill} onCreated={onCreated} /> : null;
}

function NewTicketForm({ onClose, prefill, onCreated }) {
  const [channel, setChannel] = useState('whatsapp');
  const [who, setWho] = useState(prefill?.email || '');
  const [picked, setPicked] = useState(prefill?.email ? { id: prefill.userId || null, email: prefill.email, name: prefill.name || '' } : null); // { id, email, name }
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [found, setFound] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const term = useDebounced(who);
  const searching = !picked && term.trim().length >= 2;

  useEffect(() => {
    if (!searching) return undefined;
    let alive = true;
    usersResource.list({ search: term.trim(), pageSize: 6 }).then((d) => { if (alive) setFound(toPage(d).items); }).catch(() => {});
    return () => { alive = false; };
  }, [term, searching]);
  const suggestions = searching ? found : [];

  const typedEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(who.trim());
  const canSave = message.trim().length >= 2 && (picked || typedEmail);

  async function save() {
    setSaving(true);
    setError('');
    try {
      const row = await supportResource.create({
        ...(picked?.id ? { userId: picked.id } : { email: picked?.email || who.trim() }),
        subject: subject.trim() || undefined,
        message: message.trim(),
        channel,
      });
      onCreated(row);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Novo chamado"
      wide
      footer={(
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save} loading={saving} disabled={!canSave}>Criar chamado</Button>
        </>
      )}
    >
      <p className="text-xs text-gray-400">Registre uma conversa que aconteceu fora do app. Ela entra na fila e fica ligada ao usuário.</p>
      <Field label="Canal">
        <div className="flex flex-wrap gap-1.5">
          {CHANNELS.map((c) => (
            <button key={c.value} type="button" onClick={() => setChannel(c.value)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${channel === c.value ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {c.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Pessoa" hint="Busque por nome ou e-mail. Se ela ainda não tem conta, digite o e-mail completo.">
        {picked ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2">
            <span className="min-w-0 break-all text-sm text-white">{picked.name ? `${picked.name} · ` : ''}{picked.email}{picked.id ? '' : ' (sem conta)'}</span>
            <button type="button" className="text-xs text-emerald-400 hover:underline" onClick={() => { setPicked(null); setWho(''); }}>Trocar</button>
          </div>
        ) : (
          <>
            <input className={inputClass} value={who} onChange={(e) => setWho(e.target.value)} placeholder="nome@email.com" autoComplete="off" />
            {suggestions.length > 0 && (
              <ul className="mt-1 divide-y divide-gray-800 overflow-hidden rounded-lg border border-gray-700 bg-gray-900">
                {suggestions.map((u) => (
                  <li key={u.id}>
                    <button type="button" className="w-full px-3 py-2 text-left hover:bg-gray-800" onClick={() => setPicked({ id: u.id, email: u.email, name: u.name || '' })}>
                      <span className="block text-sm text-white">{u.name || u.email}</span>
                      {u.name && <span className="block text-xs text-gray-500">{u.email}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Field>
      <Field label="Assunto (opcional)"><input className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} /></Field>
      <Field label="O que a pessoa disse">
        <textarea className={`${inputClass} min-h-28`} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Cole ou resuma a mensagem recebida…" />
      </Field>
      {error && <InlineMessage>{error}</InlineMessage>}
    </Modal>
  );
}

function Thread({ id, onChanged }) {
  const state = useAsync(() => supportResource.get(id), id);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);

  useEffect(() => { setReply(''); setError(''); }, [id]);

  async function send() {
    setSending(true);
    setError('');
    try {
      await supportResource.reply(id, reply.trim());
      setReply('');
      setToast('Resposta enviada por e-mail.');
      state.reload(true);
      onChanged();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSending(false);
    }
  }

  async function setStatus(status) {
    await supportResource.setStatus(id, status);
    setToast(status === 'closed' ? 'Conversa fechada.' : 'Conversa reaberta.');
    state.reload(true);
    onChanged();
  }

  return (
    <AsyncView state={state} isEmpty={(d) => !d}>
      {(m) => {
        const extraReplies = Array.isArray(m.replies) ? m.replies : [];
        return (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-white break-words">{m.subject || 'Sem assunto'}</h2>
                <p className="text-sm text-gray-400 break-all">
                  {m.name ? `${m.name} · ` : ''}{m.email}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <Badge tone={TONE[m.status] ?? 'gray'}>{LABEL[m.status] ?? m.status}</Badge>
                  <Badge>{SOURCE_LABEL[m.source] ?? 'Dentro do app'}</Badge>
                  {m.userId && <Link className="text-xs text-emerald-400 hover:underline" to={`/users/${m.userId}`}>Ver usuário</Link>}
                </div>
              </div>
              {m.status === 'closed' ? (
                <Button size="sm" icon={RotateCcw} onClick={() => setStatus('open')}>Reabrir</Button>
              ) : (
                <Button size="sm" icon={CheckCheck} onClick={() => setConfirmClose(true)}>Fechar conversa</Button>
              )}
            </div>

            <div className="space-y-3">
              <div className="max-w-[92%] rounded-2xl rounded-tl-sm bg-gray-800 px-4 py-3">
                <p className="text-sm text-gray-100 whitespace-pre-wrap break-words">{m.message}</p>
                <p className="text-[11px] text-gray-500 mt-1.5">{dateTime(m.createdAt)}</p>
              </div>
              {m.adminReply && (
                <div className="max-w-[92%] ml-auto rounded-2xl rounded-tr-sm bg-emerald-900/50 border border-emerald-900 px-4 py-3">
                  <p className="text-sm text-gray-100 whitespace-pre-wrap break-words">{m.adminReply}</p>
                  <p className="text-[11px] text-emerald-300/70 mt-1.5">Resposta enviada · {dateTime(m.repliedAt)}</p>
                </div>
              )}
              {extraReplies.map((r, i) => (
                <div key={r.id ?? i} className="max-w-[92%] ml-auto rounded-2xl rounded-tr-sm bg-emerald-900/50 border border-emerald-900 px-4 py-3">
                  <p className="text-sm text-gray-100 whitespace-pre-wrap break-words">{r.message}</p>
                  <p className="text-[11px] text-emerald-300/70 mt-1.5">{dateTime(r.createdAt)}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2 border-t border-gray-800 pt-4">
              <label className="block text-xs font-medium text-gray-400" htmlFor="support-reply">
                Responder por e-mail para {m.email}
              </label>
              <textarea
                id="support-reply"
                className={`${inputClass} min-h-28`}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Escreva a resposta…"
              />
              {error && <InlineMessage>{error}</InlineMessage>}
              <div className="flex justify-end">
                <Button variant="primary" icon={Send} onClick={send} loading={sending} disabled={reply.trim().length < 2}>Enviar resposta</Button>
              </div>
            </div>

            <ConfirmDialog
              open={confirmClose}
              title="Fechar conversa"
              tone="primary"
              confirmLabel="Fechar"
              description="A conversa sai da fila de abertas. Você pode reabri-la depois."
              onClose={() => setConfirmClose(false)}
              onConfirm={() => setStatus('closed')}
            />
            <Toast message={toast} onDone={() => setToast('')} />
          </div>
        );
      }}
    </AsyncView>
  );
}

export default function Support() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('open');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounced(search);
  useEffect(() => { setPage(1); }, [status, q]);

  const params = { status, q: q.trim(), page, pageSize: 20 };
  const list = useAsync(() => supportResource.list(params), JSON.stringify(params));

  // "Novo chamado" opens from here or from a user page (?new=1&userId=…&email=…&name=…).
  const [searchParams, setSearchParams] = useSearchParams();
  const [creating, setCreating] = useState(searchParams.get('new') === '1');
  const prefill = useMemo(() => ({
    userId: searchParams.get('userId') || '', email: searchParams.get('email') || '', name: searchParams.get('name') || '',
  }), [searchParams]);
  const closeCreate = () => {
    setCreating(false);
    if (searchParams.has('new')) setSearchParams({}, { replace: true });
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Suporte"
        subtitle="Mensagens do formulário de contato e conversas registradas por você (e-mail, WhatsApp, telefone)."
        actions={<Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>Novo chamado</Button>}
      />
      <NewTicketModal
        open={creating}
        onClose={closeCreate}
        prefill={prefill}
        onCreated={(row) => { closeCreate(); list.reload(true); navigate(`/support/${row.id}`); }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-4 items-start">
        <div className={id ? 'hidden lg:block' : ''}>
          <Card padded={false}>
            <div className="p-3 space-y-2 border-b border-gray-800">
              <div className="flex gap-1 overflow-x-auto">
                {STATUSES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setStatus(s.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors ${status === s.value ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input className={`${inputClass} pl-9`} placeholder="Buscar mensagem, e-mail ou nome" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="px-1 pb-3">
              <AsyncView
                state={list}
                isEmpty={(d) => toPage(d).items.length === 0}
                empty={<EmptyState icon={LifeBuoy} title="Nenhuma mensagem" description={status === 'open' ? 'Tudo respondido por aqui.' : 'Nada encontrado com esses filtros.'} />}
              >
                {(data) => {
                  const p = toPage(data, 20);
                  return (
                    <>
                      <ul className="divide-y divide-gray-800">
                        {p.items.map((m) => (
                          <li key={m.id}>
                            <button
                              type="button"
                              onClick={() => navigate(`/support/${m.id}`)}
                              className={`w-full text-left px-3 py-3 transition-colors ${m.id === id ? 'bg-emerald-950/40' : 'hover:bg-gray-800/50'}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium text-white truncate">{m.name || m.email}</p>
                                <span className="text-[11px] text-gray-500 flex-shrink-0">{relativeTime(m.createdAt)}</span>
                              </div>
                              {m.subject && <p className="text-xs text-gray-300 truncate">{m.subject}</p>}
                              <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{m.message}</p>
                              <div className="mt-1.5"><Badge tone={TONE[m.status] ?? 'gray'}>{LABEL[m.status] ?? m.status}</Badge></div>
                            </button>
                          </li>
                        ))}
                      </ul>
                      <div className="px-3"><Pagination page={p.page} pageSize={p.pageSize} total={p.total} onChange={setPage} /></div>
                    </>
                  );
                }}
              </AsyncView>
            </div>
          </Card>
        </div>

        <div className={id ? '' : 'hidden lg:block'}>
          <Card>
            {id ? (
              <>
                <Link to="/support" className="lg:hidden inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-3">
                  <ArrowLeft className="w-4 h-4" /> Caixa de entrada
                </Link>
                <Thread id={id} onChanged={() => list.reload(true)} />
              </>
            ) : (
              <EmptyState icon={LifeBuoy} title="Selecione uma conversa" description="Escolha uma mensagem à esquerda para ler e responder." />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
