import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminResource } from '../../lib/api/resources/admin';

const STATUS_BADGE = {
  open: 'bg-amber-900 text-amber-300',
  resolved: 'bg-emerald-900 text-emerald-300',
  duplicate: 'bg-gray-800 text-gray-400',
};

export default function ImportIssues() {
  const [issues, setIssues] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;
    adminResource.listImportIssues()
      .then((rows) => {
        if (!active) return;
        setIssues(rows);
      })
      .catch((error) => {
        console.error('Error loading import issues:', error);
        if (!active) return;
        setIssues([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = issues.filter((i) => {
    if (statusFilter !== 'all' && i.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        i.userEmail?.toLowerCase().includes(q) ||
        i.clientId?.toLowerCase().includes(q) ||
        i.bankType?.toLowerCase().includes(q) ||
        i.fileName?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h1 className="text-xl font-semibold text-white">Import issues</h1>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-gray-800 text-white text-sm px-3 py-1.5 rounded-lg placeholder-gray-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-gray-800 text-white text-sm px-3 py-1.5 rounded-lg"
          >
            <option value="all">Todos</option>
            <option value="open">Abertos</option>
            <option value="resolved">Resolvidos</option>
            <option value="duplicate">Duplicados</option>
          </select>
        </div>
      </div>
      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm text-gray-300">
          <thead className="bg-gray-900 text-xs uppercase text-gray-400">
            <tr>
              <th className="text-left px-3 py-2">Quando</th>
              <th className="text-left px-3 py-2">Cliente</th>
              <th className="text-left px-3 py-2">Usuário</th>
              <th className="text-left px-3 py-2">Banco</th>
              <th className="text-left px-3 py-2">Parser</th>
              <th className="text-left px-3 py-2">Arquivo</th>
              <th className="text-left px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-gray-500 py-6">
                  Nenhum issue encontrado.
                </td>
              </tr>
            )}
            {filtered.map((i) => (
              <tr key={i.id} className="border-t border-gray-800 hover:bg-gray-900/50">
                <td className="px-3 py-2 text-xs text-gray-400">
                  {i.createdAt ? new Date(i.createdAt).toLocaleString('pt-BR') : '—'}
                </td>
                <td className="px-3 py-2">{i.clientId}</td>
                <td className="px-3 py-2">
                  <Link
                    to={`/admin/import-issues/${i.id}`}
                    className="text-emerald-400 hover:underline"
                  >
                    {i.userEmail}
                  </Link>
                </td>
                <td className="px-3 py-2">{i.bankType}</td>
                <td className="px-3 py-2 text-xs text-gray-400">{i.parserUsed}</td>
                <td className="px-3 py-2 text-xs text-gray-400 truncate max-w-[200px]">{i.fileName}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${STATUS_BADGE[i.status] || 'bg-gray-800 text-gray-400'}`}>
                    {i.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
