// src/pages/admin/OnboardingRun.jsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import {
  doc, setDoc, onSnapshot, collection,
  query, orderBy, serverTimestamp
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

const LEVEL_CLASS = {
  info: 'text-gray-400',
  success: 'text-emerald-400',
  error: 'text-red-400',
};

const STATUS_BADGE = {
  queued: 'bg-gray-700 text-gray-300',
  running: 'bg-blue-800 text-blue-200 animate-pulse',
  success: 'bg-emerald-800 text-emerald-200',
  failed: 'bg-red-900 text-red-300',
};

export default function OnboardingRun({ db, functions }) {
  const { runId } = useParams();
  const location = useLocation();
  const email = location.state?.email || new URLSearchParams(location.search).get('email') || '';

  const [runStatus, setRunStatus] = useState('queued');
  const [logs, setLogs] = useState([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const terminalRef = useRef(null);

  // Create run doc on mount
  useEffect(() => {
    if (!runId || !email) return;
    const runRef = doc(db, 'onboardingRuns', runId);
    setDoc(runRef, { email, status: 'queued', createdAt: serverTimestamp() }, { merge: true });
  }, [db, runId, email]);

  // Subscribe to run status
  useEffect(() => {
    if (!runId) return;
    const unsub = onSnapshot(doc(db, 'onboardingRuns', runId), snap => {
      if (snap.exists()) setRunStatus(snap.data().status || 'queued');
    });
    return unsub;
  }, [db, runId]);

  // Subscribe to logs
  useEffect(() => {
    if (!runId) return;
    const logsQuery = query(
      collection(db, 'onboardingRuns', runId, 'logs'),
      orderBy('ts', 'asc')
    );
    const unsub = onSnapshot(logsQuery, snap => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [db, runId]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  async function handleStart() {
    if (!email) {
      setError('No email provided for this run.');
      return;
    }
    setStarting(true);
    setError('');
    try {
      const onboardUser = httpsCallable(functions, 'onboardUser');
      await onboardUser({ email, runId });
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
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

      <button
        onClick={handleStart}
        disabled={starting || runStatus === 'running' || runStatus === 'success'}
        className="px-4 py-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg"
      >
        {starting ? 'Starting...' : runStatus === 'running' ? 'Running...' : runStatus === 'success' ? 'Completed' : 'Start Onboarding'}
      </button>

      {/* Terminal */}
      <div
        ref={terminalRef}
        className="bg-black border border-gray-800 rounded-xl p-4 h-96 overflow-y-auto font-mono text-xs space-y-1"
      >
        {logs.length === 0 && (
          <p className="text-gray-700">Waiting for logs...</p>
        )}
        {logs.map(log => (
          <div key={log.id} className={`flex gap-3 ${LEVEL_CLASS[log.level] || LEVEL_CLASS.info}`}>
            <span className="text-gray-700 shrink-0">
              {log.ts?.toDate?.()?.toLocaleTimeString('pt-BR') ?? '—'}
            </span>
            <span className="text-gray-600 shrink-0">[step {log.step}]</span>
            <span>{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
