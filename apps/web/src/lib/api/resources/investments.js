import { apiClient } from '../client';

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeInvestment(data) {
  return {
    ...data,
    initialAmount: toNumber(data?.initialAmount),
    currentAmount: data?.currentAmount === null ? null : toNumber(data?.currentAmount),
    expectedReturn: toNumber(data?.expectedReturn),
    quantity: data?.quantity === null ? null : toNumber(data?.quantity),
    avgPrice: data?.avgPrice === null ? null : toNumber(data?.avgPrice),
    currentPrice: data?.currentPrice === null ? null : toNumber(data?.currentPrice),
    totalWithdrawn: toNumber(data?.totalWithdrawn),
  };
}

export function createInvestmentsResource({ client = apiClient } = {}) {
  return {
    async list() {
      const rows = await client.get('/investments');
      return rows.map(normalizeInvestment);
    },
    async get(id) {
      const row = await client.get(`/investments/${id}`);
      return normalizeInvestment(row);
    },
    async create(data) {
      const row = await client.post('/investments', data);
      return normalizeInvestment(row);
    },
    async update(id, patch) {
      const row = await client.patch(`/investments/${id}`, patch);
      return normalizeInvestment(row);
    },
    remove(id) {
      return client.delete(`/investments/${id}`);
    },
  };
}

export const investmentsResource = createInvestmentsResource();
