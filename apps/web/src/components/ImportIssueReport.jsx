import { useState } from 'react';
import { submitImportIssue } from '../services/importIssueService';
import { useClientConfig } from '../contexts/ClientConfigContext';
import { useAccess } from '../contexts/AccessContext';
import { extractClientId } from '../config/clientConfig';

/**
 * Opt-in banner shown when an import returns 0 transactions or errors.
 * Sends the user's file + metadata to the admin for manual review.
 *
 * @param {object} props
 * @param {File} props.file - the file the user tried to import
 * @param {string} props.bankType - the bank dropdown selection (auto/inter/etc.)
 * @param {string} [props.parserUsed] - which parser actually ran (for debugging)
 * @param {string[]} [props.detectedHeaders] - the column headers we saw, if any
 * @param {string} [props.errorMessage] - the parse error, if any
 * @param {(result: { ok: boolean, dismissed?: boolean, issueId?: string, error?: Error }) => void} props.onDone
 */
export default function ImportIssueReport({
  file, bankType, parserUsed, detectedHeaders,
  errorMessage, onDone,
}) {
  const config = useClientConfig();
  const { currentUser } = useAccess();
  const [note, setNote] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // useClientConfig() returns the raw JSON config (no clientId field).
  // Derive clientId from hostname or path as the app itself does.
  const clientId = extractClientId(window.location.hostname)
    || window.location.pathname.split('/').filter(Boolean)[0]
    || 'unknown';

  const userEmail = currentUser?.email || '';
  const userName = currentUser?.displayName || '';

  async function send() {
    setBusy(true);
    setError('');
    try {
      const res = await submitImportIssue({
        file,
        bankType,
        parserUsed,
        detectedHeaders,
        errorMessage,
        userNote: note,
        userName,
        userEmail,
        clientId,
      });
      onDone?.({ ok: true, issueId: res?.issueId });
    } catch (e) {
      setError(e?.message || 'Falha ao enviar');
      onDone?.({ ok: false, error: e });
    } finally {
      setBusy(false);
    }
  }

  if (!file) return null;

  return (
    <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm">
      <h3 className="font-semibold mb-2 text-gray-900 dark:text-amber-100">
        Não conseguimos ler esse arquivo
      </h3>
      <p className="text-gray-700 dark:text-gray-300 mb-3">
        Quer enviar pra gente dar uma olhada? Vamos receber:
      </p>
      <ul className="text-xs text-gray-600 dark:text-gray-400 list-disc pl-5 mb-3 space-y-1">
        <li>
          O arquivo <code className="font-mono">{file.name}</code>{' '}
          ({Math.round(file.size / 1024)} KB)
        </li>
        <li>Seu nome, email e o banco escolhido</li>
        <li>A nota opcional abaixo</li>
      </ul>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Opcional: nos diga qual banco é, ou o que parece errado"
        className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 text-sm mb-3 text-gray-900 dark:text-gray-100"
        rows={3}
      />
      <label className="flex items-start gap-2 mb-3 text-xs text-gray-700 dark:text-gray-300">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5"
        />
        <span>Estou de acordo em enviar esse arquivo para o time da Realwise</span>
      </label>
      {error && (
        <p className="text-rose-600 dark:text-rose-400 text-xs mb-2">{error}</p>
      )}
      <div className="flex gap-2">
        <button
          disabled={!consent || busy}
          onClick={send}
          className="rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 text-sm font-medium transition-colors"
        >
          {busy ? 'Enviando...' : 'Enviar relatório'}
        </button>
        <button
          onClick={() => onDone?.({ ok: false, dismissed: true })}
          disabled={busy}
          className="rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          Agora não
        </button>
      </div>
    </div>
  );
}
