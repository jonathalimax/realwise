// src/pages/admin/OnboardingRun.jsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import {
  doc, onSnapshot, collection,
  query, orderBy
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

const LEVEL_STYLE = {
  info:    { line: 'text-gray-300', msg: 'text-gray-200' },
  success: { line: 'text-emerald-400', msg: 'text-emerald-300' },
  error:   { line: 'text-red-400', msg: 'text-red-300' },
  warn:    { line: 'text-yellow-400', msg: 'text-yellow-300' },
};

const STATUS_BADGE = {
  queued:  'bg-gray-700 text-gray-300',
  running: 'bg-blue-800 text-blue-200 animate-pulse',
  success: 'bg-emerald-800 text-emerald-200',
  failed:  'bg-red-900 text-red-300',
};

export default function OnboardingRun({ db, functions }) {
  const { runId } = useParams();
  const location = useLocation();
  const email = location.state?.email || new URLSearchParams(location.search).get('email') || '';

  const [runStatus, setRunStatus] = useState('queued');
  const [logs, setLogs] = useState([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const terminalRef = useRef(null);

  // Run doc is created by the Cloud Function — client only reads

  useEffect(() => {
    if (!runId) return;
    return onSnapshot(doc(db, 'onboardingRuns', runId), snap => {
      if (snap.exists()) setRunStatus(snap.data().status || 'queued');
    });
  }, [db, runId]);

  useEffect(() => {
    if (!runId) return;
    return onSnapshot(
      query(collection(db, 'onboardingRuns', runId, 'logs'), orderBy('ts', 'asc')),
      snap => setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, [db, runId]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  async function handleStart() {
    if (!email) { setError('No email provided for this run.'); return; }
    setStarting(true);
    setError('');
    try {
      await httpsCallable(functions, 'onboardUser')({ email, runId });
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  }

  async function handleCopyLogs() {
    const text = logs.map(l =>
      `[${l.ts?.toDate?.()?.toLocaleTimeString('pt-BR') ?? '—'}] [step ${l.step}] ${l.message}`
    ).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — silently ignore
    }
  }

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-bold text-white">Onboarding Run</h2>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[runStatus] || STATUS_BADGE.queued}`}>
          {runStatus}
        </span>
      </div>

      <div className="text-sm text-gray-400">
        <span className="text-gray-500">Email:</span> <span className="text-white">{email || '—'}</span>
        <span className="mx-3 text-gray-700">|</span>
        <span className="text-gray-500">Run ID:</span> <span className="font-mono text-gray-300 text-xs">{runId}</span>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={handleStart}
          disabled={starting || runStatus === 'running' || runStatus === 'success'}
          className="px-4 py-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg"
        >
          {starting ? 'Starting...' : runStatus === 'running' ? 'Running...' : runStatus === 'success' ? 'Completed' : 'Start Onboarding'}
        </button>
        {logs.length > 0 && (
          <button
            onClick={handleCopyLogs}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg"
          >
            {copied ? '✓ Copied' : 'Copy logs'}
          </button>
        )}
      </div>

      {/* Terminal */}
      <div
        ref={terminalRef}
        className="bg-gray-950 border border-gray-800 rounded-xl p-4 h-96 overflow-y-auto font-mono text-xs space-y-0.5"
      >
        {logs.length === 0 && (
          <p className="text-gray-600">Waiting for logs...</p>
        )}
        {logs.map(log => {
          const style = LEVEL_STYLE[log.level] || LEVEL_STYLE.info;
          return (
            <div key={log.id} className={`flex gap-3 ${style.line}`}>
              <span className="text-gray-500 shrink-0 select-none">
                {log.ts?.toDate?.()?.toLocaleTimeString('pt-BR') ?? '—'}
              </span>
              <span className="text-gray-500 shrink-0 select-none">[{log.step}]</span>
              <span className={style.msg}>{log.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
