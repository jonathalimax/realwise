import { apiClient } from '../client';

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeAccount(data) {
  const bankId = data?.bankId ?? data?.icon ?? 'other';
  const hasCredit = data?.hasCredit ?? data?.type === 'credit';
  const cardName = data?.cardName ?? (!data?.customBankName ? data?.name ?? null : null);

  return {
    ...data,
    bankId,
    cardName,
    customBankName: data?.customBankName ?? null,
    hasCredit,
    closingDay: data?.closingDay ?? null,
    paymentDay: data?.paymentDay ?? null,
    balance: toNumber(data?.balance),
  };
}

export function createAccountsResource({ client = apiClient } = {}) {
  return {
    async list() {
      const rows = await client.get('/accounts');
      return Array.isArray(rows) ? rows.map(normalizeAccount) : [];
    },
    async create(data) {
      const row = await client.post('/accounts', data);
      return normalizeAccount(row);
    },
    async update(id, patch) {
      const row = await client.patch(`/accounts/${id}`, patch);
      return normalizeAccount(row);
    },
    remove(id) {
      return client.delete(`/accounts/${id}`);
    },
  };
}

export const accountsResource = createAccountsResource();
