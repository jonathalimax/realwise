import { Test } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { MailerService } from '@nestjs-modules/mailer';

const mockMailer = { sendMail: jest.fn().mockResolvedValue({ messageId: 'abc' }) };

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: MailerService, useValue: mockMailer },
      ],
    }).compile();
    service = module.get(NotificationsService);
    jest.clearAllMocks();
    mockMailer.sendMail.mockResolvedValue({ messageId: 'abc' });
  });

  it('sendBillReminderEmail calls sendMail once', async () => {
    await service.sendBillReminderEmail('user@example.com', {
      overdue: [{ id: 'b-1', name: 'Rent', amount: '1500.00', dueDate: '2026-06-01', daysOverdue: 5 }],
      dueToday: [],
      dueSoon: [],
    });
    expect(mockMailer.sendMail).toHaveBeenCalledTimes(1);
    const args = mockMailer.sendMail.mock.calls[0][0];
    expect(args.to).toBe('user@example.com');
    expect(args.subject).toMatch(/conta/i);
  });

  it('does not send email when all groups empty', async () => {
    await service.sendBillReminderEmail('user@example.com', { overdue: [], dueToday: [], dueSoon: [] });
    expect(mockMailer.sendMail).not.toHaveBeenCalled();
  });
});
