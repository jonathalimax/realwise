import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { adminResource } from '../../lib/api/resources/admin';

const STATUS_BADGE = {
  open: 'bg-amber-900 text-amber-300',
  resolved: 'bg-emerald-900 text-emerald-300',
  duplicate: 'bg-gray-800 text-gray-400',
};

export default function ImportIssueDetail() {
  const { id } = useParams();
  const [issue, setIssue] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [downloadErr, setDownloadErr] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    adminResource.getImportIssue(id)
      .then((row) => {
        if (!active) return;
        setIssue(row);
      })
      .catch((error) => {
        console.error('Error loading import issue:', error);
        if (!active) return;
        setIssue({ notFound: true });
      });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!issue?.fileBase64) {
      setDownloadUrl(null);
      return;
    }
    try {
      const mime = issue.fileMime || 'application/octet-stream';
      setDownloadUrl(`data:${mime};base64,${issue.fileBase64}`);
      setDownloadErr(null);
    } catch (err) {
      setDownloadErr(err?.message || 'Falha ao gerar URL');
      setDownloadUrl(null);
    }
  }, [issue?.fileBase64, issue?.fileMime]);

  async function setStatus(status) {
    setBusy(true);
    try {
      const updated = await adminResource.updateImportIssue(id, { status });
      setIssue(updated);
    } finally {
      setBusy(false);
    }
  }

  async function addNote() {
    const text = note.trim();
    if (!text) return;
    setBusy(true);
    try {
      const updated = await adminResource.updateImportIssue(id, { note: text });
      setIssue(updated);
      setNote('');
    } finally {
      setBusy(false);
    }
  }

  if (!issue) {
    return <div className="p-6 text-gray-400">Carregando...</div>;
  }

  if (issue.notFound) {
    return (
      <div className="p-6">
        <Link to="/admin/import-issues" className="text-emerald-400 text-sm">← Voltar</Link>
        <p className="mt-4 text-gray-400">Issue não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl text-gray-200">
      <Link to="/admin/import-issues" className="text-emerald-400 text-sm hover:underline">
        ← Voltar
      </Link>
      <div className="flex items-center gap-3 mt-2 mb-6">
        <h1 className="text-xl font-semibold text-white">Issue {id.slice(0, 8)}</h1>
        <span className={`px-2 py-0.5 rounded text-xs ${STATUS_BADGE[issue.status] || 'bg-gray-800 text-gray-400'}`}>
          {issue.status}
        </span>
      </div>

      <dl className="grid grid-cols-[160px_1fr] gap-y-2 text-sm mb-6">
        <dt className="text-gray-400">Quando</dt>
        <dd>{issue.createdAt ? new Date(issue.createdAt).toLocaleString('pt-BR') : '—'}</dd>

        <dt className="text-gray-400">Cliente</dt>
        <dd className="font-mono text-xs">{issue.clientId}</dd>

        <dt className="text-gray-400">Usuário</dt>
        <dd>{issue.userName || '(sem nome)'} &lt;{issue.userEmail || 'unknown'}&gt;</dd>

        <dt className="text-gray-400">Banco escolhido</dt>
        <dd>{issue.bankType}</dd>

        <dt className="text-gray-400">Parser usado</dt>
        <dd className="font-mono text-xs">{issue.parserUsed || '—'}</dd>

        <dt className="text-gray-400">Headers detectados</dt>
        <dd className="font-mono text-xs break-all">
          {(issue.detectedHeaders || []).join(' | ') || '(nenhum)'}
        </dd>

        <dt className="text-gray-400">Erro</dt>
        <dd className="text-rose-300 text-xs whitespace-pre-wrap">{issue.errorMessage || '—'}</dd>

        <dt className="text-gray-400">Nota do usuário</dt>
        <dd className="whitespace-pre-wrap">{issue.userNote || '—'}</dd>

        <dt className="text-gray-400">Arquivo</dt>
        <dd className="font-mono text-xs">{issue.fileName || '—'}</dd>
      </dl>

      <div className="mb-6">
        {downloadUrl ? (
          <a
            href={downloadUrl}
            target="_blank"
            rel="noreferrer"
            download={issue.fileName || 'import-issue-file'}
            className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Baixar arquivo
          </a>
        ) : downloadErr ? (
          <p className="text-rose-400 text-xs">Erro: {downloadErr}</p>
        ) : (
          <p className="text-xs text-gray-500">Gerando link de download...</p>
        )}
      </div>

      <div className="flex gap-2 mb-8 flex-wrap">
        <button
          disabled={busy || issue.status === 'resolved'}
          onClick={() => setStatus('resolved')}
          className="bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
        >
          Marcar resolvido
        </button>
        <button
          disabled={busy || issue.status === 'duplicate'}
          onClick={() => setStatus('duplicate')}
          className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
        >
          Marcar duplicado
        </button>
        <button
          disabled={busy || issue.status === 'open'}
          onClick={() => setStatus('open')}
          className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
        >
          Reabrir
        </button>
      </div>

      <div>
        <h3 className="font-semibold text-white mb-3">Notas internas</h3>
        <ul className="text-sm space-y-2 mb-3">
          {(issue.internalNotes || []).length === 0 && (
            <li className="text-gray-500 text-xs">Nenhuma nota ainda.</li>
          )}
          {(issue.internalNotes || []).map((n, i) => (
            <li key={i} className="border-l-2 border-gray-700 pl-3 py-1">
              <div className="text-xs text-gray-500">
                {n.ts ? new Date(n.ts).toLocaleString('pt-BR') : ''} {n.by ? `· ${n.by}` : ''}
              </div>
              <div className="text-gray-300 whitespace-pre-wrap">{n.text}</div>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addNote(); }}
            placeholder="Adicionar nota..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500"
          />
          <button
            disabled={busy || !note.trim()}
            onClick={addNote}
            className="bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}
