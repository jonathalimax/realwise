import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateInvestmentDto } from './create-investment.dto';

describe('CreateInvestmentDto', () => {
  it('accepts numeric investment amounts from withdraw and import flows', () => {
    const dto = plainToInstance(CreateInvestmentDto, {
      name: 'Resgate RDB',
      type: 'fixed_income',
      initialAmount: 126,
      currentAmount: 1350.0734893703066,
      totalWithdrawn: 1200,
    });

    const errors = validateSync(dto);

    expect(errors).toHaveLength(0);
    expect(dto.initialAmount).toBe('126.00');
    expect(dto.currentAmount).toBe('1350.07');
    expect(dto.totalWithdrawn).toBe('1200.00');
  });
});
