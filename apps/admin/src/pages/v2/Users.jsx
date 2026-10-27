import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, Search, UserX } from 'lucide-react';
import { usersResource } from '../../lib/api/resources/users';
import { toPage } from '../../lib/api/query';
import { useAsync, useDebounced } from '../../lib/useAsync';
import { date, num, relativeTime, usd } from '../../lib/format';
import { AsyncView, Badge, Card, EmptyState, PageHeader, Pagination, TableWrap, inputClass, tdClass, thClass } from '../../components/ui';
import { ACCESS_STATES, AccessBadge } from '../../components/userBits';

const PAGE_SIZE = 25;
const SORTS = [
  { value: 'createdAt', label: 'Cadastro' },
  { value: 'lastActiveAt', label: 'Última atividade' },
  { value: 'aiCost', label: 'Custo de IA' },
];

export default function Users() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [state, setState] = useState('');
  const [sort, setSort] = useState('createdAt');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const q = useDebounced(search);

  useEffect(() => { setPage(1); }, [q, state, sort, order]);

  const params = { search: q.trim(), state, sort, order, page, pageSize: PAGE_SIZE };
  const result = useAsync(() => usersResource.list(params), JSON.stringify(params));

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <PageHeader title="Usuários" subtitle="Busque, filtre e gerencie planos, créditos de IA e dados de cada conta." />

      <Card padded={false}>
        <div className="p-3 sm:p-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] border-b border-gray-800">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className={`${inputClass} pl-9`}
              placeholder="Buscar por e-mail ou nome"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className={inputClass} value={state} onChange={(e) => setState(e.target.value)} aria-label="Filtrar por situação">
            <option value="">Todas as situações</option>
            {ACCESS_STATES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select className={inputClass} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Ordenar por">
            {SORTS.map((s) => <option key={s.value} value={s.value}>Ordenar: {s.label}</option>)}
          </select>
          <button
            type="button"
            onClick={() => setOrder(order === 'desc' ? 'asc' : 'desc')}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800"
          >
            {order === 'desc' ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
            {order === 'desc' ? 'Decrescente' : 'Crescente'}
          </button>
        </div>

        <div className="px-3 sm:px-4 pb-4">
          <AsyncView
            state={result}
            isEmpty={(d) => toPage(d).items.length === 0}
            empty={<EmptyState icon={UserX} title="Nenhum usuário encontrado" description="Ajuste a busca ou os filtros." />}
          >
            {(data) => {
              const p = toPage(data, PAGE_SIZE);
              return (
                <>
                  <TableWrap>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-800">
                          <th className={thClass}>Usuário</th>
                          <th className={thClass}>Situação</th>
                          <th className={`${thClass} hidden md:table-cell`}>Cadastro</th>
                          <th className={`${thClass} hidden md:table-cell`}>Última atividade</th>
                          <th className={`${thClass} text-right hidden sm:table-cell`}>IA no mês</th>
                          <th className={`${thClass} text-right hidden lg:table-cell`}>Transações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {p.items.map((u) => (
                          <tr key={u.id} className="hover:bg-gray-800/40 cursor-pointer" onClick={() => navigate(`/users/${u.id}`)}>
                            <td className={tdClass}>
                              <Link to={`/users/${u.id}`} className="block min-w-0" onClick={(e) => e.stopPropagation()}>
                                <span className="block text-white font-medium truncate max-w-[220px] sm:max-w-xs">{u.name || u.email}</span>
                                {u.name && <span className="block text-xs text-gray-500 truncate max-w-[220px] sm:max-w-xs">{u.email}</span>}
                              </Link>
                              {(u.marketingEmailsOptOut || u.reminderEmailsOptOut) && (
                                <Badge className="mt-1">sem e-mails</Badge>
                              )}
                            </td>
                            <td className={tdClass}><AccessBadge access={u.access} /></td>
                            <td className={`${tdClass} hidden md:table-cell`}>{date(u.createdAt)}</td>
                            <td className={`${tdClass} hidden md:table-cell`}>{u.lastActiveAt ? relativeTime(u.lastActiveAt) : '—'}</td>
                            <td className={`${tdClass} text-right hidden sm:table-cell`}>{usd(u.aiCostMonthUsd)}</td>
                            <td className={`${tdClass} text-right hidden lg:table-cell`}>{num(u.transactionCount)}</td>
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
