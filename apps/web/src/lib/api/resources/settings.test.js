import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSettingsResource, normalizeSettings } from './settings';

describe('createSettingsResource', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads settings from /user-settings', async () => {
    const client = {
      get: vi.fn().mockResolvedValue({ currency: 'USD' }),
      patch: vi.fn(),
    };

    const resource = createSettingsResource({ client });
    const result = await resource.get();

    expect(client.get).toHaveBeenCalledWith('/user-settings');
    expect(result).toEqual({ currency: 'USD' });
  });

  it('patches settings to /user-settings', async () => {
    const client = {
      get: vi.fn(),
      patch: vi.fn().mockResolvedValue({ currency: 'BRL' }),
    };

    const resource = createSettingsResource({ client });
    const result = await resource.update({ currency: 'BRL' });

    expect(client.patch).toHaveBeenCalledWith('/user-settings', { currency: 'BRL' });
    expect(result).toEqual({ currency: 'BRL' });
  });
});

describe('normalizeSettings', () => {
  it('fills missing fields with defaults', () => {
    expect(normalizeSettings(null)).toEqual(
      expect.objectContaining({
        currency: 'BRL',
        language: 'pt',
        darkMode: false,
        billReminders: true,
        monthlyRollover: true,
        tutorialCompleted: false,
        geminiApiKey: '',
        expenseCategories: expect.any(Array),
        incomeCategories: expect.any(Array),
      }),
    );
  });

  it('preserves explicit monthlyRollover false', () => {
    expect(normalizeSettings({ monthlyRollover: false })).toEqual(
      expect.objectContaining({ monthlyRollover: false }),
    );
  });

  it('preserves explicit values from the API payload', () => {
    expect(normalizeSettings({
      currency: 'USD',
      language: 'en',
      darkMode: true,
      billReminders: false,
      monthlyRollover: false,
      tutorialCompleted: true,
      geminiApiKey: 'abc',
      expenseCategories: ['Housing'],
      incomeCategories: ['Salary'],
    })).toEqual(
      expect.objectContaining({
        currency: 'USD',
        language: 'en',
        darkMode: true,
        billReminders: false,
        monthlyRollover: false,
        tutorialCompleted: true,
        geminiApiKey: 'abc',
        expenseCategories: ['Housing'],
        incomeCategories: ['Salary'],
      }),
    );
  });
});
