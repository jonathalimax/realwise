import { apiClient } from '../client';

function normalizeCategoryBudgets(value) {
  if (!value || typeof value !== 'object') return {};

  return Object.fromEntries(
    Object.entries(value).map(([category, amount]) => [category, Number(amount || 0)])
  );
}

export function normalizeBudget(data) {
  return {
    ...data,
    totalBudget: Number(data?.totalBudget || 0),
    categoryBudgets: normalizeCategoryBudgets(data?.categoryBudgets),
  };
}

export function createBudgetsResource({ client = apiClient } = {}) {
  return {
    async list() {
      const rows = await client.get('/budgets');
      return rows
        .filter((row) => row?.month)
        .map(normalizeBudget);
    },
    create(data) {
      return client.post('/budgets', data).then(normalizeBudget);
    },
    update(id, patch) {
      return client.patch(`/budgets/${id}`, patch).then(normalizeBudget);
    },
    remove(id) {
      return client.delete(`/budgets/${id}`);
    },
  };
}

export const budgetsResource = createBudgetsResource();
