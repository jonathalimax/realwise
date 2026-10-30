import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bug, Globe, Server, Timer, TriangleAlert, Users } from 'lucide-react';
import { errorsResource } from '../../lib/api/resources/errors';
import { useAsync } from '../../lib/useAsync';
import { num, relativeTime } from '../../lib/format';
import { SOURCE_LABEL, SOURCE_TONE, whatOf } from '../../lib/errorView';
import { AsyncView, Badge, Button, Card, EmptyState, PageHeader, Stat, TableWrap, inputClass, tdClass, thClass } from '../../components/ui';

const STATES = [
  { key: 'open', label: 'Abertos' },
  { key: 'resolved', label: 'Resolvidos' },
  { key: 'ignored', label: 'Ignorados' },
  { key: 'all', label: 'Todos' },
];
const SOURCES = [
  { key: '', label: 'Todas as origens' },
  { key: 'api', label: 'API (servidor)' },
  { key: 'web', label: 'App (navegador)' },
  { key: 'job', label: 'Tarefas em segundo plano' },
];
const DAYS = [1, 7, 30, 90];

export function SourceBadge({ source }) {
  return <Badge tone={SOURCE_TONE[source] ?? 'gray'}>{SOURCE_LABEL[source] ?? source}</Badge>;
}

export function StateBadge({ state, regressed }) {
  if (regressed) return <Badge tone="red">Voltou a acontecer</Badge>;
  if (state === 'resolved') return <Badge tone="green">Resolvido</Badge>;
  if (state === 'ignored') return <Badge tone="gray">Ignorado</Badge>;
  return <Badge tone="amber">Aberto</Badge>;
}

export default function Errors() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('open');
  const [source, setSource] = useState('');
  const [days, setDays] = useState(7);
  const [q, setQ] = useState('');
  const summary = useAsync(() => errorsResource.summary(), 'summary');
  const list = useAsync(() => errorsResource.list({ status, source, days, q }), `${status}|${source}|${days}|${q}`);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      <PageHeader title="Erros" subtitle="Tudo que deu errado: no servidor, no app e nas tarefas em segundo plano. Guardado por 90 dias, sem o conteúdo das requisições." />

      <AsyncView state={summary}>
        {(s) => (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Stat label="Problemas abertos" value={num(s.openGroups)} hint="tipos de erro, últimos 30 dias" icon={Bug} tone={s.openGroups ? 'text-amber-300' : 'text-emerald-400'} />
            <Stat label="Ocorrências em 24 h" value={num(s.last24h)} hint={`${num(s.last7d)} em 7 dias`} icon={Timer} />
            <Stat label="Usuários afetados" value={num(s.users24h)} hint="nas últimas 24 h" icon={Users} tone="text-sky-300" />
            <Stat label="Servidor (5xx)" value={num(s.api24h)} hint="24 h" icon={Server} tone={s.api24h ? 'text-red-400' : 'text-white'} />
            <Stat label="App e tarefas" value={num((s.web24h ?? 0) + (s.job24h ?? 0))} hint={`${num(s.web24h)} app · ${num(s.job24h)} tarefas`} icon={Globe} />
          </div>
        )}
      </AsyncView>

      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
          {STATES.map((s) => (
            <Button key={s.key} size="sm" variant={status === s.key ? 'primary' : 'secondary'} onClick={() => setStatus(s.key)}>{s.label}</Button>
          ))}
          <select className={`${inputClass} max-w-[14rem]`} value={source} onChange={(e) => setSource(e.target.value)}>
            {SOURCES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <select className={`${inputClass} max-w-[9rem]`} value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {DAYS.map((d) => <option key={d} value={d}>{d === 1 ? 'Últimas 24 h' : `Últimos ${d} dias`}</option>)}
          </select>
          <input className={`${inputClass} max-w-xs ml-auto`} placeholder="Buscar e-mail, mensagem ou rota" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <AsyncView
          state={list}
          isEmpty={(rows) => rows.length === 0}
          empty={<EmptyState icon={TriangleAlert} title="Nenhum erro aqui" description="Nada com esses filtros no período. Isso é uma boa notícia." />}
        >
          {(rows) => (
            <TableWrap>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className={thClass}>Situação</th>
                    <th className={thClass}>Origem</th>
                    <th className={thClass}>Erro</th>
                    <th className={thClass}>Onde</th>
                    <th className={`${thClass} text-right`}>Vezes</th>
                    <th className={`${thClass} text-right`}>Usuários</th>
                    <th className={thClass}>Última vez</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {rows.map((e) => (
                    <tr key={e.fingerprint} className="cursor-pointer hover:bg-gray-900/60" onClick={() => navigate(`/errors/${e.fingerprint}`)}>
                      <td className={tdClass}><StateBadge state={e.state} regressed={e.regressed} /></td>
                      <td className={tdClass}>
                        <SourceBadge source={e.source} />
                        {e.status_code ? <span className={`ml-1.5 text-xs ${e.status_code >= 500 ? 'text-red-400' : 'text-amber-300'}`}>{e.status_code}</span> : null}
                      </td>
                      <td className={`${tdClass} max-w-md`}><Link to={`/errors/${e.fingerprint}`} onClick={(ev) => ev.stopPropagation()} className="text-white hover:underline line-clamp-2 break-words">{e.message}</Link></td>
                      <td className={`${tdClass} text-xs text-gray-400 font-mono`}>{whatOf(e)}</td>
                      <td className={`${tdClass} text-right`}>{num(e.count)}</td>
                      <td className={`${tdClass} text-right`}>{num(e.users)}</td>
                      <td className={`${tdClass} whitespace-nowrap`}>{relativeTime(e.last_seen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </AsyncView>
      </Card>
    </div>
  );
}
