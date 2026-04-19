// src/pages/admin/SalesDashboard.jsx
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

const STATE_COLORS = {
  pending: 'bg-yellow-800 text-yellow-200',
  not_paid: 'bg-gray-700 text-gray-300',
  paid: 'bg-blue-800 text-blue-200',
  onboarding: 'bg-purple-800 text-purple-200',
  active: 'bg-emerald-800 text-emerald-200',
  cancelled: 'bg-red-900 text-red-300',
  refunded: 'bg-orange-900 text-orange-300',
};

const FILTERS = ['all', 'pending', 'not_paid', 'paid', 'onboarding', 'active', 'cancelled', 'refunded'];

export default function SalesDashboard({ db }) {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const unsubLeads = onSnapshot(
      query(collection(db, 'leads'), orderBy('paidAt', 'desc')),
      snap => setLeads(snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, state: data.state ?? (data.paid ? 'paid' : 'pending') };
      }))
    );
    const unsubPurchases = onSnapshot(
      collection(db, 'purchases'),
      snap => setPurchases(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => { unsubLeads(); unsubPurchases(); };
  }, [db]);

  const totalRevenue = purchases.reduce((acc, p) => acc + (p.amountTotal || 0), 0);
  const paidLeads = leads.filter(l => l.paid).length;
  const conversionRate = leads.length ? ((paidLeads / leads.length) * 100).toFixed(1) : '0.0';

  const filtered = filter === 'all' ? leads : leads.filter(l => l.state === filter);

  function startOnboarding(email) {
    const runId = `${Date.now()}-${email.split('@')[0]}`;
    navigate(`/onboarding/${runId}`, { state: { email } });
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-bold text-white">Sales Dashboard</h2>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Leads', value: leads.length },
          { label: 'Paid', value: paidLeads },
          { label: 'Conversion', value: `${conversionRate}%` },
          { label: 'Revenue', value: `R$ ${totalRevenue.toFixed(2)}` },
        ].map(kpi => (
          <div key={kpi.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{kpi.label}</p>
            <p className="text-2xl font-bold text-white mt-1">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              filter === f
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
            <tr>
              {['Name', 'Email', 'WhatsApp', 'State', 'Paid At', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(lead => (
              <tr key={lead.id} className="border-t border-gray-800 hover:bg-gray-900/50">
                <td className="px-4 py-3 text-white">{lead.name || '—'}</td>
                <td className="px-4 py-3 text-gray-300">{lead.email}</td>
                <td className="px-4 py-3 text-gray-400">{lead.whatsapp || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATE_COLORS[lead.state] || 'bg-gray-700 text-gray-300'}`}>
                    {lead.state || 'unknown'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {lead.paidAt?.toDate?.()?.toLocaleDateString('pt-BR') || '—'}
                </td>
                <td className="px-4 py-3">
                  <button
                    disabled={lead.state !== 'paid'}
                    onClick={() => startOnboarding(lead.email)}
                    className="px-3 py-1 bg-purple-700 hover:bg-purple-600 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs rounded-lg"
                  >
                    Onboard
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-600">No leads found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
