// src/pages/admin/LeadsDashboard.jsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import EmailModal from './EmailModal';
import ActionsDropdown from './ActionsDropdown';
import { adminResource } from '../../lib/api/resources/admin';

const STATES = ['pending', 'not_paid', 'paid', 'active', 'cancelled', 'refunded'];

function useLandingStats() {
  return [];
}
const FILTERS = ['all', ...STATES];

function brl(centavos) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function LeadsDashboard() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [emailTarget, setEmailTarget] = useState(null);
  const [updatingState, setUpdatingState] = useState({});
  const [recoveryToast, setRecoveryToast] = useState(null);
  const [loadingActions, setLoadingActions] = useState({});

  useEffect(() => {
    let active = true;
    Promise.all([adminResource.listLeads(), adminResource.listPurchases()])
      .then(([leadRows, purchaseRows]) => {
        if (!active) return;
        setLeads(leadRows.map((lead) => ({
          ...lead,
          state: lead.status || (lead.paid ? 'paid' : 'pending'),
        })));
        setPurchases(purchaseRows);
      })
      .catch((error) => {
        console.error('Error loading admin leads:', error);
        if (!active) return;
        setLeads([]);
        setPurchases([]);
      });
    return () => {
      active = false;
    };
  }, []);

  // Build revenue map from purchases collection (post-launch)
  const revenueByEmail = purchases.reduce((acc, p) => {
    acc[p.email] = (acc[p.email] || 0) + Number(p.amount || p.amountTotal || 0);
    return acc;
  }, {});

  // Fall back to amountTotal on the lead doc for users who paid before purchases collection existed
  function revenueForLead(lead) {
    return revenueByEmail[lead.email] ?? Number(lead.amountTotal || 0);
  }

  const totalRevenue = leads.reduce((sum, l) => sum + revenueForLead(l), 0);
  const paidLeads = leads.filter(l => ['paid', 'active'].includes(l.state)).length;
  const conversionRate = leads.length ? ((paidLeads / leads.length) * 100).toFixed(1) : '0.0';

  const landingStats = useLandingStats();
  const totalPartial = landingStats.reduce((s, d) => s + d.partial_leads, 0);
  const totalCheckoutStarted = landingStats.reduce((s, d) => s + d.checkout_started, 0);
  const sourceTotals = landingStats.reduce((acc, d) => {
    Object.entries(d.sources).forEach(([k, v]) => { acc[k] = (acc[k] || 0) + v; });
    return acc;
  }, {});

  const handleStateChange = useCallback(async (email, newState) => {
    setUpdatingState(prev => ({ ...prev, [email]: true }));
    try {
      const lead = leads.find((item) => item.email === email);
      if (lead?.id) {
        const updated = await adminResource.updateLead(lead.id, { status: newState });
        setLeads((prev) => prev.map((item) => (
          item.id === lead.id ? { ...item, ...updated, state: updated.status || newState } : item
        )));
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setUpdatingState(prev => ({ ...prev, [email]: false }));
    }
  }, [leads, navigate]);

  function startOnboarding(email) {
    const runId = `${Date.now()}-${email.split('@')[0]}`;
    navigate(`/onboarding/${runId}`, { state: { email } });
  }

  const handleAction = useCallback(async (actionId, lead) => {
    const { email, name } = lead;
    const setLoading = (on) => setLoadingActions(prev => {
      const current = new Set(prev[email]);
      on ? current.add(actionId) : current.delete(actionId);
      return { ...prev, [email]: current };
    });

    if (actionId === 'onboard') {
      startOnboarding(email);
      return;
    }

    setLoading(true);
    try {
      if (actionId === 'welcome') {
        await adminResource.sendAdminEmail({ to: email, template: 'welcome', fields: { name: name || '' } });
        setRecoveryToast(`Boas-vindas enviado para ${email}`);
      } else if (actionId === 'access') {
        await adminResource.sendAdminEmail({ to: email, template: 'access_granted', fields: { name: name || '', loginUrl: '' } });
        setRecoveryToast(`Email de acesso enviado para ${email}`);
      } else if (actionId === 'migration') {
        await adminResource.sendAdminEmail({ to: email, template: 'accept_migration', fields: { name: name || '', migrationUrl: '' } });
        setRecoveryToast(`Email de migração enviado para ${email}`);
      } else if (actionId === 'coupon') {
        await adminResource.sendAbandonedCheckoutEmail({ email, stage: 2, name: name || '' });
        setRecoveryToast(`Cupom enviado para ${email}`);
      } else if (actionId === 'lastchance') {
        await adminResource.sendAbandonedCheckoutEmail({ email, stage: 3, name: name || '' });
        setRecoveryToast(`Última oferta enviada para ${email}`);
      } else if (actionId === 'state') {
        // inline state change is handled by the existing select — nothing to do
        return;
      }
      setTimeout(() => setRecoveryToast(null), 3000);
    } catch (err) {
      alert(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = leads
    .filter(l => filter === 'all' || l.state === filter)
    .filter(l => !search ||
      l.email?.toLowerCase().includes(search.toLowerCase()) ||
      l.name?.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-bold text-white">Leads</h2>

      {/* Landing Funnel */}
      <div className="p-4 rounded-xl border border-gray-800 bg-gray-900">
        <h3 className="text-xs text-gray-500 uppercase tracking-wide mb-3">Funil de conversão — últimos 7 dias</h3>
        <div className="flex items-center gap-6 mb-3 flex-wrap">
          <div className="text-center">
            <div className="text-2xl font-bold text-violet-400">{totalPartial}</div>
            <div className="text-xs text-gray-500">Leads parciais</div>
          </div>
          <div className="text-gray-700 text-xl">→</div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">{totalCheckoutStarted}</div>
            <div className="text-xs text-gray-500">Checkout iniciado</div>
            {totalPartial > 0 && <div className="text-xs text-gray-600">{((totalCheckoutStarted / totalPartial) * 100).toFixed(0)}%</div>}
          </div>
          <div className="text-gray-700 text-xl">→</div>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-400">{paidLeads}</div>
            <div className="text-xs text-gray-500">Pagos (total)</div>
            {totalCheckoutStarted > 0 && <div className="text-xs text-gray-600">{((paidLeads / totalCheckoutStarted) * 100).toFixed(0)}%</div>}
          </div>
        </div>
        {Object.keys(sourceTotals).length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {Object.entries(sourceTotals).sort((a, b) => b[1] - a[1]).map(([source, count]) => (
              <span key={source} className="px-2 py-1 text-xs rounded-full bg-gray-800 text-gray-400">
                {source}: {count}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Leads', value: leads.length },
          { label: 'Paid', value: paidLeads },
          { label: 'Conversion', value: `${conversionRate}%` },
          { label: 'Revenue', value: brl(totalRevenue) },
        ].map(kpi => (
          <div key={kpi.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{kpi.label}</p>
            <p className="text-2xl font-bold text-white mt-1">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full sm:max-w-xs bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
        />
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                filter === f ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-800" style={{ overflowX: 'clip' }}>
        <table className="w-full text-sm">
          <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
            <tr>
              {['Name', 'Email', 'WhatsApp', 'State', 'Paid At', 'Revenue', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map(lead => (
              <tr key={lead.id} className="border-t border-gray-800 hover:bg-gray-900/50">
                <td className="px-4 py-3 text-white">{lead.name || '—'}</td>
                <td className="px-4 py-3 text-gray-300">{lead.email}</td>
                <td className="px-4 py-3 text-gray-400">{lead.whatsapp || '—'}</td>
                <td className="px-4 py-3">
                  <select
                    value={lead.state || ''}
                    onChange={e => handleStateChange(lead.email, e.target.value)}
                    disabled={updatingState[lead.email]}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                  >
                    <option value="">visitante</option>
                    {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {lead.paidAt?.toDate?.()?.toLocaleDateString('pt-BR') || '—'}
                </td>
                <td className="px-4 py-3 text-emerald-400 font-mono text-xs">
                  {revenueForLead(lead) ? brl(revenueForLead(lead)) : '—'}
                </td>
                <td className="px-4 py-3">
                  <ActionsDropdown
                    lead={lead}
                    onAction={handleAction}
                    loading={loadingActions[lead.email] || new Set()}
                  />
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-600">No leads found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {emailTarget && (
        <EmailModal user={emailTarget} onClose={() => setEmailTarget(null)} />
      )}
      {recoveryToast && (
        <div className="fixed bottom-6 right-6 bg-emerald-700 text-white text-sm px-4 py-3 rounded-xl shadow-lg z-50">
          ✓ {recoveryToast}
        </div>
      )}
    </div>
  );
}
