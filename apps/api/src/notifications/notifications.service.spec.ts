import { Test } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';

const mockSend = jest.fn().mockResolvedValue({ data: { id: 'abc' }, error: null });

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    process.env.RESEND_API_KEY = 'test-key';
    jest.clearAllMocks();
    mockSend.mockResolvedValue({ data: { id: 'abc' }, error: null });

    const module = await Test.createTestingModule({
      providers: [NotificationsService],
    }).compile();
    service = module.get(NotificationsService);
  });

  it('sendBillReminderEmail calls sendMail once', async () => {
    await service.sendBillReminderEmail('user@example.com', {
      overdue: [{ id: 'b-1', name: 'Rent', amount: '1500.00', dueDate: '2026-06-01', daysOverdue: 5 }],
      dueToday: [],
      dueSoon: [],
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
    const args = mockSend.mock.calls[0][0];
    expect(args.to).toBe('user@example.com');
    expect(args.subject).toMatch(/conta/i);
  });

  it('does not send email when all groups empty', async () => {
    await service.sendBillReminderEmail('user@example.com', { overdue: [], dueToday: [], dueSoon: [] });
    expect(mockSend).not.toHaveBeenCalled();
  });
});
