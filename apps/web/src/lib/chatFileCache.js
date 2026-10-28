// Keeps the files a user sent in the chat on THIS device only (IndexedDB), so tapping an attachment in a sent message
// can reopen it. The server deletes uploads once Elio has processed them, and never stores them long term.
// Entries expire after the same 3 days the chat history is kept. Falls back to memory when IndexedDB is unavailable.
const DB_NAME = 'rw-chat-files';
const STORE = 'files';
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

const memory = new Map();
const keyOf = (messageId, name) => `${messageId}|${name}`;

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('no indexedDB'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, run) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const result = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(result?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Remember the files that were just sent with `messageId`. Never throws. */
export async function rememberFiles(messageId, files) {
  const savedAt = Date.now();
  for (const file of files) {
    memory.set(keyOf(messageId, file.name), { blob: file, type: file.type, savedAt });
  }
  try {
    await Promise.all(files.map((file) => withStore('readwrite', (store) => store.put({ blob: file, type: file.type, savedAt }, keyOf(messageId, file.name)))));
  } catch {
    /* kept in memory for this visit only */
  }
}

/** The file sent with `messageId` named `name`, as a File, or null when this device no longer has it. */
export async function recallFile(messageId, name) {
  let entry = memory.get(keyOf(messageId, name));
  if (!entry) {
    try {
      entry = await withStore('readonly', (store) => store.get(keyOf(messageId, name)));
    } catch {
      entry = null;
    }
  }
  if (!entry?.blob || Date.now() - entry.savedAt > MAX_AGE_MS) return null;
  return entry.blob instanceof File ? entry.blob : new File([entry.blob], name, { type: entry.type || entry.blob.type });
}

/** Drops expired entries. Never throws. */
export async function purgeOldFiles() {
  const cutoff = Date.now() - MAX_AGE_MS;
  for (const [key, entry] of memory) if (entry.savedAt < cutoff) memory.delete(key);
  try {
    await withStore('readwrite', (store) => {
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) return;
        if (cursor.value?.savedAt < cutoff) cursor.delete();
        cursor.continue();
      };
      return cursorReq;
    });
  } catch {
    /* nothing to purge */
  }
}
