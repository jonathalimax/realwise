/**
 * Injection token for the account deletion service built by Area A (`AccountDeletionService.deleteUser(userId)`
 * in `src/account/`). AdminUsers codes against this interface so it compiles without a hard dependency.
 *
 * Wiring (done when Area A lands): in `AccountModule` add
 *   providers: [AccountDeletionService, { provide: ACCOUNT_DELETION, useExisting: AccountDeletionService }]
 *   exports:   [ACCOUNT_DELETION]
 * and import `AccountModule` in `AdminUsersModule`. Until then DELETE /admin/users/:id answers 503.
 */
export const ACCOUNT_DELETION = 'ACCOUNT_DELETION';

export interface AccountDeletion {
  deleteUser(userId: string): Promise<unknown>;
}
