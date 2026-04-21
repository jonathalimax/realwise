// src/pages/admin/TransferScript.jsx
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { adminDb, adminFunctions } from './AdminApp';

const CLIENTS = [
  { id: 'jonathalimax',         projectId: 'moneywise-jonathalimax' },
  { id: 'carloscalzadillar',    projectId: 'moneywise-carloscalzadillar' },
  { id: 'palomabandeiramatos5', projectId: 'moneywise-palomabandeiramatos5' },
];

export default function TransferScript() {
  const [leads, setLeads] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedClient, setSelectedClient] = useState(CLIENTS[0]);
  const [billingAccount, setBillingAccount] = useState('');
  const [removeSelf, setRemoveSelf] = useState(false);
  const [copied, setCopied] = useState(false);
  const [runStatus, setRunStatus] = useState('idle'); // idle | running | done | error | console
  const [runResult, setRunResult] = useState(null);

  // Load active/paid leads
  useEffect(() => {
    if (!adminDb) return;
    const q = query(collection(adminDb, 'leads'), where('state', 'in', ['active', 'paid', 'onboarding']));
    return onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLeads(docs);
      if (docs.length > 0 && !selectedLead) setSelectedLead(docs[0]);
    });
  }, []);

  const clientEmail = selectedLead?.email ?? '';

  const parts = [
    './scripts/transfer-client.sh',
    `--project ${selectedClient.projectId}`,
    clientEmail ? `--client-email ${clientEmail}` : '--client-email (select a lead above)',
    billingAccount ? `--billing-account ${billingAccount}` : null,
    removeSelf ? '--remove-self' : null,
  ].filter(Boolean);
  const command = parts.join(' \\\n  ');

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  }

  async function handleRun() {
    if (!clientEmail) return;
    setRunStatus('running');
    setRunResult(null);
    try {
      const fn = httpsCallable(adminFunctions, 'transferClient');
      const { data } = await fn({
        clientId: selectedClient.id,
        clientEmail,
        billingAccount: billingAccount || null,
        removeSelf,
      });
      if (data.needsConsole) {
        setRunStatus('console');
        setRunResult(data);
      } else {
        setRunStatus('done');
        setRunResult(data);
      }
    } catch (err) {
      setRunStatus('error');
      setRunResult({ message: err.message });
    }
  }

  const consoleUrl = `https://console.cloud.google.com/iam-admin/iam?project=${selectedClient.projectId}`;

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-white">Firebase / GCloud Transfer</h2>
        <p className="text-sm text-gray-400 mt-1">
          Grants the client <code className="text-emerald-400">roles/owner</code> on their Firebase project and optionally links a billing account.
        </p>
      </div>

      {/* Lead selector — email auto-fills from here */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1">Client (from leads)</label>
        {leads.length === 0 ? (
          <p className="text-gray-600 text-sm">No active/paid leads found.</p>
        ) : (
          <select
            value={selectedLead?.id ?? ''}
            onChange={e => setSelectedLead(leads.find(l => l.id === e.target.value))}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
          >
            {leads.map(l => (
              <option key={l.id} value={l.id}>{l.name ? `${l.name} — ` : ''}{l.email} ({l.state})</option>
            ))}
          </select>
        )}
        {clientEmail && (
          <p className="text-xs text-emerald-400 mt-1">Transfer to: {clientEmail}</p>
        )}
      </div>

      {/* Project selector */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1">Firebase Project</label>
        <select
          value={selectedClient.id}
          onChange={e => setSelectedClient(CLIENTS.find(c => c.id === e.target.value))}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
        >
          {CLIENTS.map(c => (
            <option key={c.id} value={c.id}>{c.id} ({c.projectId})</option>
          ))}
        </select>
      </div>

      {/* Billing account */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1">
          Billing Account ID <span className="normal-case text-gray-600 font-normal">(optional — from <code className="text-gray-400">gcloud billing accounts list</code>)</span>
        </label>
        <input
          type="text"
          value={billingAccount}
          onChange={e => setBillingAccount(e.target.value)}
          placeholder="XXXXXX-XXXXXX-XXXXXX"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 font-mono focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Remove self */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={removeSelf}
          onChange={e => setRemoveSelf(e.target.checked)}
          className="w-4 h-4 rounded accent-emerald-500"
        />
        <span className="text-sm text-gray-300">Remove myself as owner after transfer</span>
      </label>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleRun}
          disabled={!clientEmail || runStatus === 'running'}
          className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg"
        >
          {runStatus === 'running' ? 'Running...' : 'Run Transfer'}
        </button>
        <a
          href={consoleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-blue-800 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg"
        >
          Open in Console ↗
        </a>
      </div>

      {/* Run result */}
      {runStatus === 'done' && (
        <div className="bg-emerald-900/30 border border-emerald-800 rounded-xl p-4 text-sm text-emerald-300 space-y-1">
          <p className="font-semibold">✓ Transfer complete</p>
          <p>{runResult.clientEmail} is now owner of <code>{runResult.projectId}</code></p>
          {runResult.billingError && <p className="text-yellow-400 text-xs mt-1">⚠ {runResult.billingError}</p>}
        </div>
      )}
      {runStatus === 'console' && (
        <div className="bg-amber-900/30 border border-amber-800 rounded-xl p-4 text-sm text-amber-300 space-y-2">
          <p className="font-semibold">⚠ Invitation required (Spark plan)</p>
          <p className="text-xs">{runResult.message}</p>
          <a
            href={runResult.consoleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-3 py-1.5 bg-amber-700 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg"
          >
            Open IAM Console ↗
          </a>
          <ol className="text-xs space-y-0.5 list-decimal list-inside text-amber-200">
            <li>Click <strong>Grant Access</strong></li>
            <li>Add member: <code className="text-white">{clientEmail}</code></li>
            <li>Select role: <strong>Owner</strong></li>
            <li>Save — GCP will send an invitation email</li>
          </ol>
        </div>
      )}
      {runStatus === 'error' && (
        <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 text-sm text-red-300">
          <p className="font-semibold">✗ Transfer failed</p>
          <p className="text-xs mt-1">{runResult?.message}</p>
        </div>
      )}

      {/* Shell command (collapsible alternative) */}
      <details className="group">
        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300 select-none">
          Run via terminal instead
        </summary>
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Shell command</span>
            <button onClick={handleCopy} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs rounded-lg">
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <pre className="bg-gray-950 border border-gray-800 rounded-xl p-4 text-xs text-emerald-300 font-mono whitespace-pre overflow-x-auto">
            {command}
          </pre>
        </div>
      </details>

      {/* Service account setup note */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-xs text-gray-400 space-y-2">
        <p className="font-semibold text-gray-300">One-time setup for "Run Transfer"</p>
        <p>The admin service account must be granted IAM Admin on each client project. Run once per project:</p>
        <pre className="bg-gray-950 rounded-lg p-3 text-emerald-300 font-mono whitespace-pre-wrap overflow-x-auto">
{`gcloud projects add-iam-policy-binding ${selectedClient.projectId} \\
  --member="serviceAccount:moneywise-ad9ec@appspot.gserviceaccount.com" \\
  --role="roles/resourcemanager.projectIamAdmin"`}
        </pre>
      </div>
    </div>
  );
}
