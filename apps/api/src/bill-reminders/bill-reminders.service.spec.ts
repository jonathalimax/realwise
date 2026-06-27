import { Test } from '@nestjs/testing';
import { BillRemindersService } from './bill-reminders.service';
import { DRIZZLE } from '../db/drizzle.module';
import { NotificationsService } from '../notifications/notifications.service';

const today = new Date().toISOString().slice(0, 10);

const mockBills = [
  { id: 'bill-1', userId: 'user-1', clientId: 'c1', name: 'Rent', amount: '1500.00', dueDate: today, status: 'pending' },
];

const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue(mockBills),
};

const mockNotifications = { sendBillReminderEmail: jest.fn().mockResolvedValue(undefined) };

describe('BillRemindersService', () => {
  let service: BillRemindersService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BillRemindersService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();
    service = module.get(BillRemindersService);
    jest.clearAllMocks();
    mockNotifications.sendBillReminderEmail.mockResolvedValue(undefined);
  });

  it('groupBillsForUser categorises overdue bill correctly', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);
    const overdueBill = { id: 'b1', name: 'Rent', amount: '1500', dueDate: pastDate.toISOString().slice(0, 10), status: 'pending', userId: 'user-1', clientId: 'c1' };
    const groups = service.groupBillsForUser([overdueBill]);
    expect(groups.overdue).toHaveLength(1);
    expect(groups.overdue[0].daysOverdue).toBeGreaterThan(0);
  });

  it('groupBillsForUser categorises dueToday bill correctly', () => {
    const bill = { id: 'b2', name: 'Netflix', amount: '39.90', dueDate: today, status: 'pending', userId: 'user-1', clientId: 'c1' };
    const groups = service.groupBillsForUser([bill]);
    expect(groups.dueToday).toHaveLength(1);
  });

  it('groupBillsForUser categorises dueSoon bill correctly', () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 2);
    const bill = { id: 'b3', name: 'Gym', amount: '100', dueDate: soon.toISOString().slice(0, 10), status: 'pending', userId: 'user-1', clientId: 'c1' };
    const groups = service.groupBillsForUser([bill]);
    expect(groups.dueSoon).toHaveLength(1);
  });
});
