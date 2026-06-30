import { describe, expect, it } from 'vitest';
import { serializeBillPayload } from './serializeBillPayload';

describe('serializeBillPayload', () => {
  it('serializes amount as a string for the bills API', () => {
    const result = serializeBillPayload({
      formData: {
        name: 'Allure',
        description: 'Aluguel',
        dueDate: '2026-10-07',
        category: 'Contas',
        amount: 5976.31,
        recurrence: 'monthly',
        recurrenceEndDate: '',
        notificationEnabled: true,
        notificationDaysBefore: '2',
      },
      postponeCount: 0,
    });

    expect(result).toMatchObject({
      name: 'Allure',
      description: 'Aluguel',
      category: 'Contas',
      amount: '5976.31',
      recurrence: 'monthly',
      recurrenceEndDate: null,
      notificationEnabled: true,
      notificationDaysBefore: 2,
      postponeCount: 0,
    });
    expect(result.dueDate).toBe(new Date('2026-10-07').toISOString());
  });
});
