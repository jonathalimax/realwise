import { Test } from '@nestjs/testing';
import { BillActionsController } from './bill-actions.controller';
import { BillActionsService } from './bill-actions.service';

const mockService = {
  getSession: jest.fn().mockResolvedValue({ bill: { id: 'bill-1' } }),
  confirmPayment: jest.fn().mockResolvedValue({ id: 'bill-1', status: 'paid' }),
};

describe('BillActionsController', () => {
  let controller: BillActionsController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [BillActionsController],
      providers: [{ provide: BillActionsService, useValue: mockService }],
    }).compile();
    controller = module.get(BillActionsController);
    jest.clearAllMocks();
  });

  it('loads a bill payment session', async () => {
    expect(await controller.getSession('token-1')).toEqual({ bill: { id: 'bill-1' } });
    expect(mockService.getSession).toHaveBeenCalledWith('token-1');
  });

  it('confirms a bill payment', async () => {
    expect(await controller.confirmPayment('token-1', { paidAmount: '1490.00' })).toEqual({ id: 'bill-1', status: 'paid' });
    expect(mockService.confirmPayment).toHaveBeenCalledWith('token-1', { paidAmount: '1490.00' });
  });
});
