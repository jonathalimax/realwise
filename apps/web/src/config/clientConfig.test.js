import { describe, it, expect, vi, afterEach } from 'vitest';
import { extractClientId, fetchClientConfig, resolveRuntimeConfigId, buildDevConfig } from './clientConfig';

describe('extractClientId', () => {
  it('extracts subdomain from a tenant hostname', () => {
    expect(extractClientId('jonathalimax.realwise.com.br')).toBe('jonathalimax');
  });

  it('extracts subdomain from a tenant hostname with port', () => {
    expect(extractClientId('jonathalimax.localhost:5173')).toBe('jonathalimax');
  });

  it('returns null for apex domain', () => {
    expect(extractClientId('realwise.com.br')).toBeNull();
  });

  it('returns null for www subdomain', () => {
    expect(extractClientId('www.realwise.com.br')).toBeNull();
  });

  it('returns null for app subdomain', () => {
    expect(extractClientId('app.realwise.com.br')).toBeNull();
  });

  it('returns null for bare localhost', () => {
    expect(extractClientId('localhost')).toBeNull();
  });

  it('returns null for bare localhost with port', () => {
    expect(extractClientId('localhost:5173')).toBeNull();
  });

  it('extracts tenant from *.localhost for local dev', () => {
    expect(extractClientId('jonathalimax.localhost:5173')).toBe('jonathalimax');
  });
});

describe('fetchClientConfig', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed JSON when response is ok', async () => {
    const mockConfig = { clientName: 'Test', features: {} };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve(mockConfig),
    }));
    const result = await fetchClientConfig('testclient');
    expect(result).toEqual(mockConfig);
    expect(fetch).toHaveBeenCalledWith('/clients/testclient.json');
  });

  it('throws with client ID and status when response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }));
    await expect(fetchClientConfig('unknown')).rejects.toThrow('Config not found for client: unknown (404)');
  });
});

describe('buildDevConfig', () => {
  it('returns an object with shared client config shape', () => {
    const config = buildDevConfig();
    expect(config).toHaveProperty('clientName');
    expect(config).toHaveProperty('features');
    const featureKeys = ['investments', 'b3Sync', 'whatsapp', 'goals', 'salaryBreakdown'];
    featureKeys.forEach(key => expect(config.features).toHaveProperty(key));
  });
});

describe('resolveRuntimeConfigId', () => {
  it('uses the dev client env when running locally', () => {
    expect(resolveRuntimeConfigId({ isDev: true, clientEnv: 'sandbox' })).toBe('sandbox');
  });

  it('falls back to app in dev when no override is provided', () => {
    expect(resolveRuntimeConfigId({ isDev: true, clientEnv: '' })).toBe('app');
  });

  it('always uses the shared app config in production', () => {
    expect(resolveRuntimeConfigId({ isDev: false, clientEnv: 'jonathalimax' })).toBe('app');
  });
});
