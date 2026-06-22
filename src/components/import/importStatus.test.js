import { describe, it, expect } from 'vitest';
import { statusFromFlags, flagsForStatus } from './importStatus';

describe('importStatus', () => {
  it('maps selected+not ignored to import', () => {
    expect(statusFromFlags({ selected: true, ignored: false })).toBe('import');
  });
  it('maps selected+ignored to importIgnore', () => {
    expect(statusFromFlags({ selected: true, ignored: true })).toBe('importIgnore');
  });
  it('maps not selected to skip regardless of ignored', () => {
    expect(statusFromFlags({ selected: false, ignored: false })).toBe('skip');
    expect(statusFromFlags({ selected: false, ignored: true })).toBe('skip');
  });
  it('flagsForStatus round-trips each status', () => {
    expect(flagsForStatus('import')).toEqual({ selected: true, ignored: false });
    expect(flagsForStatus('importIgnore')).toEqual({ selected: true, ignored: true });
    expect(flagsForStatus('skip')).toEqual({ selected: false, ignored: false });
  });
});
