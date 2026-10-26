import { ApiError, apiClient, resolveApiBaseUrl } from '../client';
import { notifyTransactionsChanged } from './transactions';
import { notifyBillsChanged } from './bills';

/**
 * POSTs with `Accept: text/event-stream` and feeds each Server-Sent Event to `onEvent`.
 * Resolves with the final result carried by the `done` event; rejects on an `error` event or HTTP failure.
 */
async function postStream(path, body, onEvent) {
  const base = resolveApiBaseUrl();
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'text/event-stream',
      ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body instanceof FormData ? body : JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    let data = null;
    try {
      data = await response.json();
    } catch {
      /* not JSON */
    }
    throw new ApiError(data?.message || `Request failed with status ${response.status}`, { status: response.status, data });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result = null;

  const handle = (raw) => {
    const line = raw.split('\n').find((l) => l.startsWith('data:'));
    if (!line) return; // keep-alive comment
    let event;
    try {
      event = JSON.parse(line.slice(5).trim());
    } catch {
      return;
    }
    if (event.type === 'error') throw new ApiError(event.message || 'The assistant failed.', { status: 503 });
    if (event.type === 'done') result = event.result;
    onEvent?.(event);
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      handle(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 2);
    }
  }
  if (!result) throw new ApiError('The connection closed before John finished. Please try again.', { status: 503 });
  return result;
}

export function createChatResource({ client = apiClient } = {}) {
  return {
    messages() {
      return client.get('/chat/messages');
    },
    /** Sends text and/or files; resolves to { userMessage, assistantMessage }. */
    async send({ message = '', files = [] }) {
      const form = new FormData();
      if (message) form.append('message', message);
      files.forEach((file) => form.append('files', file));
      const result = await client.post('/chat/messages', form);
      // The assistant may have saved transactions or bills: refresh any screen showing them.
      notifyTransactionsChanged();
      notifyBillsChanged();
      return result;
    },
    /** Answers a question sheet; John continues and replies. */
    async answer(messageId, answers) {
      const result = await client.post(`/chat/messages/${messageId}/answers`, { answers });
      notifyTransactionsChanged();
      notifyBillsChanged();
      return result;
    },
    /** Confirms categories for rows that were already saved. No model call. */
    async applyReview(messageId, decisions) {
      const result = await client.post(`/chat/messages/${messageId}/review`, { decisions });
      notifyTransactionsChanged();
      return result;
    },
    /** { needsSetup, accountCount, categoryCount }: a user with no bank account starts in the chat. */
    onboardingStatus() {
      return client.get('/chat/onboarding');
    },
    /** Seeds the default categories and posts John's welcome + account form (idempotent). */
    onboardingStart() {
      return client.post('/chat/onboarding/start');
    },
    /** Saves the account form; John then continues the conversation (streamed). */
    async accountFormStream(messageId, form, onEvent) {
      const result = await postStream(`/chat/messages/${messageId}/account-form`, form, onEvent);
      notifyBillsChanged();
      return result;
    },
    /** Like send(), but streams John's reply: `onEvent` gets user / delta / reset / status events. */
    async sendStream({ message = '', files = [], onEvent }) {
      const form = new FormData();
      if (message) form.append('message', message);
      files.forEach((file) => form.append('files', file));
      const result = await postStream('/chat/messages', form, onEvent);
      notifyTransactionsChanged();
      notifyBillsChanged();
      return result;
    },
    /** Streaming variant of answer(). */
    async answerStream(messageId, answers, onEvent) {
      const result = await postStream(`/chat/messages/${messageId}/answers`, { answers }, onEvent);
      notifyTransactionsChanged();
      notifyBillsChanged();
      return result;
    },
    async undoImport(importId) {
      const result = await client.post(`/chat/imports/${importId}/undo`);
      notifyTransactionsChanged();
      return result;
    },
    insights(month) {
      return client.get(`/chat/insights?month=${encodeURIComponent(month)}`);
    },
  };
}

export const chatResource = createChatResource();
