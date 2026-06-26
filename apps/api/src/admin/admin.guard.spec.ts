import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';

const makeCtx = (role: string) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ user: { sub: 'uid', clientId: 'c1', role } }),
    }),
  }) as unknown as ExecutionContext;

describe('AdminGuard', () => {
  const guard = new AdminGuard();

  it('allows admin users', () => {
    expect(guard.canActivate(makeCtx('admin'))).toBe(true);
  });

  it('throws ForbiddenException for non-admin users', () => {
    expect(() => guard.canActivate(makeCtx('user'))).toThrow(ForbiddenException);
  });
});
