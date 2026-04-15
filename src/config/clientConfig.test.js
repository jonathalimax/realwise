import { describe, it, expect, vi, afterEach } from 'vitest';
import { extractClientId, fetchClientConfig, buildDevConfig } from './clientConfig';

describe('extractClientId', () => {
  it('extracts first segment from a nested path', () => {
    expect(extractClientId('/clienta/dashboard')).toBe('clienta');
  });

  it('extracts first segment from a top-level client path', () => {
    expect(extractClientId('/clienta')).toBe('clienta');
  });

  it('returns app when path is root', () => {
    expect(extractClientId('/')).toBe('app');
  });

  it('returns app when path is empty string', () => {
    expect(extractClientId('')).toBe('app');
  });

  it('returns app when first segment is a known non-client path', () => {
    expect(extractClientId('/__/auth/handler')).toBe('app');
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
