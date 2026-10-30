import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, EyeOff, RotateCcw } from 'lucide-react';
import { errorsResource } from '../../lib/api/resources/errors';
import { friendlyError } from '../../lib/api/errors';
import { useAsync } from '../../lib/useAsync';
import { dateTime, num, relativeTime } from '../../lib/format';
import { AsyncView, Badge, Button, Card, EmptyState, Toast } from '../../components/ui';
import { whatOf } from '../../lib/errorView';
import { SourceBadge, StateBadge } from './Errors';

function Meta({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-100 break-words">{children ?? '—'}</dd>
    </div>
  );
}

function Occurrence({ ev }) {
  const [open, setOpen] = useState(false);
  const ctx = ev.context && Object.keys(ev.context).length > 0 ? ev.context : null;
  return (
    <li className="px-4 py-3 space-y-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="text-gray-200">{dateTime(ev.createdAt)}</span>
        {ev.userEmail
          ? <Link to={`/users/${ev.userId}`} className="text-violet-300 hover:underline">{ev.userEmail}</Link>
          : <span className="text-gray-500">sem usuário</span>}
        {ev.appVersion && <Badge>{ev.appVersion}</Badge>}
      </div>
      {ev.userAgent && <p className="text-xs text-gray-500 break-words">{ev.userAgent}</p>}
      {ctx && <pre className="text-xs text-gray-400 bg-gray-950 rounded-lg p-2 overflow-x-auto">{JSON.stringify(ctx, null, 2)}</pre>}
      {ev.stack && (
        <>
          <button type="button" className="text-xs text-violet-300 hover:underline" onClick={() => setOpen((v) => !v)}>{open ? 'Ocultar stack' : 'Ver stack'}</button>
          {open && <pre className="text-xs text-gray-300 bg-gray-950 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words">{ev.stack}</pre>}
        </>
      )}
    </li>
  );
}

export default function ErrorDetail() {
  const { fingerprint } = useParams();
  const state = useAsync(() => errorsResource.get(fingerprint), fingerprint);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState({ message: '', tone: 'success' });

  async function setStatus(status, message) {
    setBusy(true);
    try {
      await errorsResource.setStatus(fingerprint, status);
      setToast({ message, tone: 'success' });
      state.reload(true);
    } catch (e) {
      setToast({ message: friendlyError(e), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <Link to="/errors" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white"><ArrowLeft className="w-4 h-4" /> Erros</Link>
      <AsyncView state={state}>
        {(g) => (
          <>
            <Card>
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <StateBadge state={g.state} regressed={g.regressed} />
                    <SourceBadge source={g.source} />
                    {g.status_code ? <Badge tone={g.status_code >= 500 ? 'red' : 'amber'}>{g.status_code}</Badge> : null}
                  </div>
                  <h2 className="text-base font-semibold text-white break-words">{g.message}</h2>
                  <p className="text-xs text-gray-400 font-mono break-words">{whatOf(g)}</p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {g.state === 'open'
                    ? <Button size="sm" variant="primary" icon={CheckCircle2} loading={busy} onClick={() => setStatus('resolved', 'Marcado como resolvido. Se acontecer de novo, volta como aberto.')}>Marcar como resolvido</Button>
                    : <Button size="sm" icon={RotateCcw} loading={busy} onClick={() => setStatus('open', 'Reaberto.')}>Reabrir</Button>}
                  {g.state !== 'ignored' && <Button size="sm" icon={EyeOff} loading={busy} onClick={() => setStatus('ignored', 'Ignorado: não aparece mais em Abertos.')}>Ignorar</Button>}
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-gray-800 pt-4">
                <Meta label="Ocorrências">{num(g.count)}</Meta>
                <Meta label="Usuários afetados">{num(g.users)}</Meta>
                <Meta label="Primeira vez">{dateTime(g.first_seen)}</Meta>
                <Meta label="Última vez">{relativeTime(g.last_seen)}</Meta>
              </dl>
            </Card>

            <Card title="Quem foi afetado" subtitle="Usuários logados quando o erro aconteceu" padded={false}>
              {g.affected.length === 0 ? (
                <EmptyState title="Nenhum usuário identificado" description="O erro aconteceu sem sessão (visitante) ou em uma tarefa em segundo plano." />
              ) : (
                <ul className="divide-y divide-gray-800">
                  {g.affected.map((u) => (
                    <li key={u.userId} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <Link to={`/users/${u.userId}`} className="text-violet-300 hover:underline break-all">{u.email ?? u.userId}</Link>
                      <span className="text-gray-400 shrink-0">{num(u.count)}× · {relativeTime(u.lastSeen)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Últimas ocorrências" subtitle={`As ${g.events.length} mais recentes`} padded={false}>
              <ul className="divide-y divide-gray-800">{g.events.map((ev) => <Occurrence key={ev.id} ev={ev} />)}</ul>
            </Card>
          </>
        )}
      </AsyncView>
      <Toast message={toast.message} tone={toast.tone} onDone={() => setToast({ message: '', tone: 'success' })} />
    </div>
  );
}
