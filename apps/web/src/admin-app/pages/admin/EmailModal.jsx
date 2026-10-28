// src/pages/admin/EmailModal.jsx
import { useState } from 'react';
import { adminResource } from '../../lib/api/resources/admin';

const TEMPLATES = [
  { id: 'welcome', label: 'Bem-vindo', fields: ['name'] },
  { id: 'access_granted', label: 'Luz Verde (Acesso Liberado)', fields: ['name', 'loginUrl'] },
  { id: 'accept_migration', label: 'Aceite da Migração', fields: ['name', 'migrationUrl'] },
];

export default function EmailModal({ user, onClose }) {
  const [template, setTemplate] = useState(TEMPLATES[0].id);
  const [fields, setFields] = useState({ name: user?.name || '', loginUrl: '', migrationUrl: '' });
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState('');

  const selectedTemplate = TEMPLATES.find(t => t.id === template);

  async function handleSend() {
    setStatus('sending');
    setErrorMsg('');
    try {
      await adminResource.sendAdminEmail({ to: user.email, template, fields });
      setStatus('sent');
    } catch (err) {
      setErrorMsg(err.message);
      setStatus('error');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white">Send Email — {user.email}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">&times;</button>
        </div>

        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide">Template</label>
          <select
            value={template}
            onChange={e => setTemplate(e.target.value)}
            className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
          >
            {TEMPLATES.map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>

        {selectedTemplate.fields.map(field => (
          <div key={field}>
            <label className="text-xs text-gray-400 uppercase tracking-wide">{field}</label>
            <input
              type="text"
              value={fields[field] || ''}
              onChange={e => setFields(prev => ({ ...prev, [field]: e.target.value }))}
              className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"
            />
          </div>
        ))}

        {status === 'error' && <p className="text-red-400 text-sm">{errorMsg}</p>}
        {status === 'sent' && <p className="text-emerald-400 text-sm">Email enviado com sucesso!</p>}

        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancelar</button>
          <button
            onClick={handleSend}
            disabled={status === 'sending' || status === 'sent'}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg"
          >
            {status === 'sending' ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}
