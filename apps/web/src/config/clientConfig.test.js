import { describe, it, expect, vi, afterEach } from 'vitest';
import { extractClientId, fetchClientConfig, buildDevConfig } from './clientConfig';

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
    const mockConfig = { clientName: 'Test', firebase: {}, features: {} };
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
  it('returns an object with firebase keys and features shape', () => {
    const config = buildDevConfig();
    expect(config).toHaveProperty('clientName');
    expect(config).toHaveProperty('firebase');
    expect(config).toHaveProperty('features');
    const firebaseKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
    firebaseKeys.forEach(key => expect(config.firebase).toHaveProperty(key));
    const featureKeys = ['investments', 'b3Sync', 'whatsapp', 'goals', 'salaryBreakdown'];
    featureKeys.forEach(key => expect(config.features).toHaveProperty(key));
  });
});
