// Sends a failed bank-statement import to the SHARED Firebase project's
// submitImportIssue callable. Reuses the same 'shared' app instance that
// SharedLogin already initialized.

import { httpsCallable } from 'firebase/functions';
import { initSharedFirebase } from '../lib/sharedFirebase';

const MAX_BYTES = 2 * 1024 * 1024;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = String(result).split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Submit a failed import for admin review.
 *
 * @param {object} params
 * @param {File} params.file
 * @param {string} params.bankType
 * @param {string} params.parserUsed
 * @param {string[]} params.detectedHeaders
 * @param {string} [params.errorMessage]
 * @param {string} [params.userNote]
 * @param {string} params.userName
 * @param {string} params.userEmail
 * @param {string} params.clientId
 * @returns {Promise<{ ok: true, issueId: string }>}
 */
export async function submitImportIssue({
  file, bankType, parserUsed, detectedHeaders,
  errorMessage, userNote, userName, userEmail, clientId,
}) {
  if (!file) throw new Error('Missing file');
  if (file.size > MAX_BYTES) throw new Error('Arquivo maior que 2MB');
  if (!bankType || !clientId) throw new Error('Missing bankType or clientId');

  const fileBase64 = await fileToBase64(file);
  const { functions } = await initSharedFirebase();
  const call = httpsCallable(functions, 'submitImportIssue');
  const res = await call({
    fileName: file.name,
    fileMime: file.type || 'application/octet-stream',
    fileBase64,
    bankType,
    parserUsed: parserUsed || 'unknown',
    detectedHeaders: detectedHeaders || [],
    errorMessage: errorMessage || null,
    userNote: userNote || null,
    userName: userName || '',
    userEmail: userEmail || '',
    clientId,
  });
  return res.data;
}
