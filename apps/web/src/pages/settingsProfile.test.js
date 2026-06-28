import { describe, expect, it } from 'vitest';
import { getSettingsProfile } from './settingsProfile';

describe('getSettingsProfile', () => {
  it('prefers the API name field for the profile header', () => {
    expect(getSettingsProfile({
      name: 'Jane Doe',
      email: 'jane@example.com',
    })).toEqual({
      name: 'Jane Doe',
      email: 'jane@example.com',
      initial: 'J',
      photoUrl: null,
    });
  });

  it('falls back to the email local part when the API payload has no name', () => {
    expect(getSettingsProfile({
      email: 'guest@example.com',
    })).toEqual({
      name: 'guest',
      email: 'guest@example.com',
      initial: 'G',
      photoUrl: null,
    });
  });

  it('returns placeholders when no authenticated user is available', () => {
    expect(getSettingsProfile(null)).toEqual({
      name: '\u2014',
      email: '',
      initial: '?',
      photoUrl: null,
    });
  });
});
