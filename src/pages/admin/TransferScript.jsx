// src/pages/admin/TransferScript.jsx
import { useState } from 'react';

const CLIENTS = [
  { id: 'jonathalimax',         projectId: 'moneywise-jonathalimax' },
  { id: 'carloscalzadillar',    projectId: 'moneywise-carloscalzadillar' },
  { id: 'palomabandeiramatos5', projectId: 'moneywise-palomabandeiramatos5' },
];

export default function TransferScript() {
  const [selectedClient, setSelectedClient] = useState(CLIENTS[0]);
  const [clientEmail, setClientEmail] = useState('');
  const [billingAccount, setBillingAccount] = useState('');
  const [removeSelf, setRemoveSelf] = useState(false);
  const [copied, setCopied] = useState(false);

  const parts = [
    './scripts/transfer-client.sh',
    `--project ${selectedClient.projectId}`,
    clientEmail ? `--client-email ${clientEmail}` : '--client-email YOUR_CLIENT_EMAIL',
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

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-white">Firebase / GCloud Transfer</h2>
        <p className="text-sm text-gray-400 mt-1">
          Grants the client <code className="text-emerald-400">roles/owner</code> on their Firebase project and optionally links a billing account.
          Run this script from your terminal after configuring the fields below.
        </p>
      </div>

      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1">Client</label>
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

      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1">Client Email (Google account)</label>
        <input
          type="email"
          value={clientEmail}
          onChange={e => setClientEmail(e.target.value)}
          placeholder="client@gmail.com"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
        />
      </div>

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

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={removeSelf}
          onChange={e => setRemoveSelf(e.target.checked)}
          className="w-4 h-4 rounded accent-emerald-500"
        />
        <span className="text-sm text-gray-300">Remove myself as owner after transfer</span>
      </label>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-gray-400 uppercase tracking-wide">Generated Command</label>
          <button
            onClick={handleCopy}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs rounded-lg"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <pre className="bg-gray-950 border border-gray-800 rounded-xl p-4 text-xs text-emerald-300 font-mono whitespace-pre overflow-x-auto">
          {command}
        </pre>
      </div>

      <div className="bg-amber-900/30 border border-amber-800 rounded-xl p-4 text-xs text-amber-300 space-y-1">
        <p className="font-semibold">Before running:</p>
        <p>• Make sure you're authenticated: <code>gcloud auth login</code></p>
        <p>• Verify you're an owner: <code>gcloud projects get-iam-policy {selectedClient.projectId}</code></p>
        <p>• The client must have a Google account for IAM transfer.</p>
        <p>• Billing link requires <code>billing.resourceAssociations.create</code> permission on the billing account.</p>
      </div>
    </div>
  );
}
