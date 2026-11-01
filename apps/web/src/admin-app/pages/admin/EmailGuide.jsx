import { useEffect, useMemo, useState } from 'react';
import { settingsResource } from '../../lib/api/resources/settings';
import { friendlyError } from '../../lib/api/errors';

/** Every e-mail the product sends, rendered by the API with sample data through the real templates. */
export default function EmailGuide({ query }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let alive = true;
    settingsResource.getEmailPreviews()
      .then((data) => alive && setItems(data))
      .catch((e) => alive && setError(friendlyError(e)));
    return () => { alive = false; };
  }, []);

  const groups = useMemo(() => {
    const q = (query || '').toLowerCase();
    const shown = (items || []).filter((m) => !q || `${m.label} ${m.when} ${m.subject}`.toLowerCase().includes(q));
    const byGroup = new Map();
    shown.forEach((m) => byGroup.set(m.group, [...(byGroup.get(m.group) || []), m]));
    return [...byGroup.entries()];
  }, [items, query]);

  if (error) return <p className="text-red-400 text-sm">{error}</p>;
  if (!items) return <p className="text-gray-400 text-sm">Carregando e-mails…</p>;

  return (
    <div className="space-y-6">
      <p className="text-gray-400 text-sm">
        Todos os e-mails que o Realwise envia, quando saem e como chegam. Os exemplos usam dados fictícios nos modelos reais: nada é enviado.
      </p>
      {groups.map(([group, mails]) => (
        <div key={group}>
          <div className="text-xs font-bold tracking-wider mb-3 text-emerald-400">{group.toUpperCase()}</div>
          <div className="space-y-2">
            {mails.map((m) => (
              <div key={m.id} className="border border-gray-700 rounded-lg overflow-hidden bg-gray-900">
                <button onClick={() => setOpenId(openId === m.id ? null : m.id)} className="w-full flex items-start justify-between gap-3 p-4 hover:bg-gray-800 text-left">
                  <span>
                    <span className="font-medium text-gray-100">{m.label}</span>
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${m.audience === 'team' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                      {m.audience === 'team' ? 'Equipe' : 'Cliente'}
                    </span>
                    <span className="block text-sm text-gray-400 mt-1">{m.when}</span>
                  </span>
                  <span className={`text-emerald-400 flex-shrink-0 transition-transform ${openId === m.id ? 'rotate-180' : ''}`}>▼</span>
                </button>
                {openId === m.id && (
                  <div className="border-t border-gray-700 bg-gray-800/50 p-4">
                    <p className="text-xs text-gray-400 mb-2">Assunto: <span className="text-gray-200">{m.subject}</span></p>
                    <iframe title={m.label} srcDoc={m.html} sandbox="" className="w-full h-[640px] rounded-lg bg-white" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      {!groups.length && <p className="text-center text-gray-400 py-8">Nenhum e-mail encontrado.</p>}
    </div>
  );
}
