// src/pages/admin/UserList.jsx
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import EmailModal from './EmailModal';

const STATES = ['pending', 'not_paid', 'paid', 'onboarding', 'active', 'cancelled', 'refunded'];

export default function UserList({ db, functions }) {
  const [leads, setLeads] = useState([]);
  const [search, setSearch] = useState('');
  const [emailTarget, setEmailTarget] = useState(null);
  const [updatingState, setUpdatingState] = useState({});

  useEffect(() => {
    const unsubLeads = onSnapshot(
      query(collection(db, 'leads'), orderBy('paidAt', 'desc')),
      snap => setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => { unsubLeads(); };
  }, [db]);

  async function handleStateChange(email, newState) {
    setUpdatingState(prev => ({ ...prev, [email]: true }));
    try {
      const updateLeadState = httpsCallable(functions, 'updateLeadState');
      await updateLeadState({ email, state: newState });
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setUpdatingState(prev => ({ ...prev, [email]: false }));
    }
  }

  const filtered = leads.filter(l =>
    !search ||
    l.email?.toLowerCase().includes(search.toLowerCase()) ||
    l.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-bold text-white">User Management</h2>

      <input
        type="text"
        placeholder="Search by name or email..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full max-w-sm bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
      />

      {/* Leads */}
      <section>
        <h3 className="text-sm font-semibold text-gray-400 mb-3">Leads ({filtered.length})</h3>
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
              <tr>
                {['Name', 'Email', 'WhatsApp', 'State', 'Actions'].map(h => (
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
                    <select
                      value={lead.state || ''}
                      onChange={e => handleStateChange(lead.email, e.target.value)}
                      disabled={updatingState[lead.email]}
                      className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                    >
                      <option value="">unknown</option>
                      {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setEmailTarget(lead)}
                      className="px-3 py-1 bg-blue-800 hover:bg-blue-700 text-white text-xs rounded-lg"
                    >
                      Email
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {emailTarget && (
        <EmailModal
          user={emailTarget}
          functions={functions}
          onClose={() => setEmailTarget(null)}
        />
      )}
    </div>
  );
}
