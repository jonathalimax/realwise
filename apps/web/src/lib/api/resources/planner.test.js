import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPlannerResource } from './planner';

describe('createPlannerResource', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads planner state from /planner', async () => {
    const client = {
      get: vi.fn().mockResolvedValue({ state: { plannerVersions: [] } }),
      patch: vi.fn(),
    };

    const resource = createPlannerResource({ client });
    const result = await resource.get();

    expect(client.get).toHaveBeenCalledWith('/planner');
    expect(result).toEqual({ state: { plannerVersions: [] } });
  });

  it('updates planner state through /planner', async () => {
    const client = {
      get: vi.fn(),
      patch: vi.fn().mockResolvedValue({ ok: true }),
    };

    const resource = createPlannerResource({ client });
    const payload = { state: { plannerVersions: [{ from: '2026-06' }] } };
    const result = await resource.update(payload);

    expect(client.patch).toHaveBeenCalledWith('/planner', payload);
    expect(result).toEqual({ ok: true });
  });
});
