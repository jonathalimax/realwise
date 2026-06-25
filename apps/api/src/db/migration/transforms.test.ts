import { describe, it, expect } from 'vitest';
import {
  transformUser,
  transformAccount,
  transformBillReminder,
  transformReminderLog,
  transformLead,
} from './transforms';

const CLIENT = 'jonathalimax';
const USER_UUID = '00000000-0000-0000-0000-000000000001';

describe('transformUser', () => {
  it('maps Firestore user to users row', () => {
    const result = transformUser('firebase-uid-abc', {
      email: 'test@example.com',
      name: 'Test User',
    }, CLIENT);
    expect(result).toEqual({
      clientId: CLIENT,
      email: 'test@example.com',
      name: 'Test User',
      firebaseUid: 'firebase-uid-abc',
      role: 'user',
    });
  });

  it('handles missing name', () => {
    const result = transformUser('uid', { email: 'x@x.com' }, CLIENT);
    expect(result.name).toBeNull();
  });
});

describe('transformAccount', () => {
  it('maps Firestore userBanks doc to accounts row', () => {
    const result = transformAccount('doc-id-1', {
      cardName: 'Nubank',
      bankId: 'nubank',
      hasCredit: true,
      color: '#820AD1',
      balance: 1500.5,
    }, CLIENT, USER_UUID);
    expect(result).toEqual({
      clientId: CLIENT,
      userId: USER_UUID,
      firebaseDocId: 'doc-id-1',
      name: 'Nubank',
      type: 'credit',
      color: '#820AD1',
      icon: 'nubank',
      balance: '1500.5',
    });
  });
});

describe('transformBillReminder', () => {
  it('maps bill_reminders doc with sent: false', () => {
    const result = transformBillReminder('doc-1', {
      billId: 'bill-uuid',
      remindAt: { toDate: () => new Date('2026-07-01T09:00:00Z') },
      sent: false,
    }, CLIENT, USER_UUID);
    expect(result.sent).toBe(false);
    expect(result.remindAt).toBeInstanceOf(Date);
  });
});

describe('transformReminderLog', () => {
  it('maps reminder_logs doc to bill_reminders row with sent: true', () => {
    const result = transformReminderLog('log-1', {
      billId: 'bill-uuid',
      sentAt: { toDate: () => new Date('2026-06-01T09:00:00Z') },
      sentVia: 'email',
    }, CLIENT, USER_UUID);
    expect(result.sent).toBe(true);
    expect(result.sentVia).toBe('email');
  });
});

describe('transformLead', () => {
  it('maps leads doc to leads row (no clientId)', () => {
    const result = transformLead('lead-1', {
      email: 'lead@example.com',
      name: 'Potential User',
      plan: 'pro',
      status: 'new',
    });
    expect(result).toEqual({
      firebaseDocId: 'lead-1',
      email: 'lead@example.com',
      name: 'Potential User',
      plan: 'pro',
      status: 'new',
      metadata: null,
    });
  });
});
