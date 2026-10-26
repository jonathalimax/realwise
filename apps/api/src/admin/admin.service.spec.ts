import { Test } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { DRIZZLE } from '../db/drizzle.module';
import { NotificationsService } from '../notifications/notifications.service';

const mockLead = { id: 'lead-1', email: 'test@example.com', name: 'Test', plan: 'basic', status: 'new', metadata: null, createdAt: new Date(), updatedAt: new Date(), firebaseDocId: null };

const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockResolvedValue([mockLead]),
  orderBy: jest.fn().mockResolvedValue([mockLead]),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([mockLead]),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
};

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: NotificationsService, useValue: { sendAdminEmail: jest.fn(), sendAbandonedCheckoutEmail: jest.fn() } },
      ],
    }).compile();
    service = module.get(AdminService);
    jest.clearAllMocks();
    mockDb.select.mockReturnThis(); mockDb.from.mockReturnThis();
    mockDb.where.mockResolvedValue([mockLead]); mockDb.orderBy.mockResolvedValue([mockLead]);
    mockDb.insert.mockReturnThis(); mockDb.values.mockReturnThis(); mockDb.returning.mockResolvedValue([mockLead]);
    mockDb.update.mockReturnThis(); mockDb.set.mockReturnThis(); mockDb.delete.mockReturnThis();
  });

  it('listLeads returns leads ordered by createdAt', async () => {
    const result = await service.listLeads();
    expect(result).toEqual([mockLead]);
  });

});
