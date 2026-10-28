import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, X } from 'lucide-react';
import { auditResource } from '../../lib/api/resources/audit';
import { toPage } from '../../lib/api/query';
import { useAsync, useDebounced } from '../../lib/useAsync';
import { dateTime } from '../../lib/format';
import { AsyncView, Button, Card, EmptyState, Field, PageHeader, Pagination, TableWrap, inputClass, tdClass, thClass } from '../../components/ui';

const PAGE_SIZE = 30;

function details(value) {
  if (!value || typeof value !== 'object') return '';
  const text = Object.entries(value)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' · ');
  return text.length > 200 ? `${text.slice(0, 200)}…` : text;
}

export default function Audit() {
  const [filters, setFilters] = useState({ actor: '', action: '', targetUserId: '' });
  const [page, setPage] = useState(1);
  const debounced = useDebounced(filters);
  useEffect(() => { setPage(1); }, [debounced]);

  const params = {
    actor: debounced.actor.trim(), action: debounced.action.trim(), targetUserId: debounced.targetUserId.trim(), page, pageSize: PAGE_SIZE,
  };
  const state = useAsync(() => auditResource.list(params), JSON.stringify(params));
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));
  const dirty = Object.values(filters).some(Boolean);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <PageHeader title="Auditoria" subtitle="Registro de todas as ações administrativas que alteram dados." />
      <Card padded={false}>
        <div className="p-3 sm:p-4 border-b border-gray-800">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Administrador (e-mail)"><input className={inputClass} value={filters.actor} onChange={(e) => set({ actor: e.target.value })} /></Field>
            <Field label="Ação"><input className={inputClass} value={filters.action} onChange={(e) => set({ action: e.target.value })} placeholder="ex.: user.plan" /></Field>
            <Field label="ID do usuário afetado"><input className={inputClass} value={filters.targetUserId} onChange={(e) => set({ targetUserId: e.target.value })} /></Field>
          </div>
          {dirty && <Button size="sm" variant="ghost" icon={X} className="mt-2" onClick={() => setFilters({ actor: '', action: '', targetUserId: '' })}>Limpar filtros</Button>}
        </div>
        <div className="px-3 sm:px-4 pb-4">
          <AsyncView
            state={state}
            isEmpty={(d) => toPage(d, PAGE_SIZE).items.length === 0}
            empty={<EmptyState icon={ShieldCheck} title="Nenhum registro" description="Ações administrativas aparecem aqui assim que acontecem." />}
          >
            {(data) => {
              const p = toPage(data, PAGE_SIZE);
              return (
                <>
                  <TableWrap>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-800">
                          <th className={thClass}>Quando</th>
                          <th className={thClass}>Administrador</th>
                          <th className={thClass}>Ação</th>
                          <th className={thClass}>Alvo</th>
                          <th className={`${thClass} hidden lg:table-cell`}>Detalhes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {p.items.map((a, i) => (
                          <tr key={a.id ?? i}>
                            <td className={`${tdClass} whitespace-nowrap`}>{dateTime(a.createdAt)}</td>
                            <td className={`${tdClass} break-all`}>{a.adminEmail ?? '—'}</td>
                            <td className={tdClass}><span className="font-mono text-xs text-emerald-300">{a.action}</span></td>
                            <td className={tdClass}>
                              {a.targetUserId
                                ? <Link className="text-emerald-400 hover:underline break-all" to={`/users/${a.targetUserId}`}>{a.targetLabel ?? a.targetUserId}</Link>
                                : (a.targetLabel ?? '—')}
                            </td>
                            <td className={`${tdClass} hidden lg:table-cell text-xs text-gray-500 max-w-md`}>{details(a.details)}</td>
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
    </div>
  );
}
