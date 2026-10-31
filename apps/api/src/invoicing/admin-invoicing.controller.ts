import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AdminActorService } from '../admin-comms/admin-actor.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { InvoicingSettingsInput, InvoicingSettingsService } from './invoicing-settings.service';
import { InvoicingService } from './invoicing.service';
import { fiscalInvoices } from '../db/schema';

type Row = typeof fiscalInvoices.$inferSelect;

/** The admin's view of a row: everything useful, nothing the screen does not need. */
const view = (r: Row) => ({
  id: r.id,
  userId: r.userId,
  stripeInvoiceId: r.stripeInvoiceId,
  stripeInvoiceNumber: r.stripeInvoiceNumber,
  stripeUrl: `https://dashboard.stripe.com/invoices/${r.stripeInvoiceId}`,
  hostedInvoiceUrl: r.hostedInvoiceUrl,
  customerName: r.customerName,
  customerEmail: r.customerEmail,
  customerDoc: r.customerDoc,
  customerAddress: r.customerAddress,
  amountCents: r.amountCents,
  planLabel: r.planLabel,
  paidAt: r.paidAt,
  status: r.status,
  skipReason: r.skipReason,
  environment: r.environment,
  nfseNumber: r.nfseNumber,
  verificationCode: r.verificationCode,
  nfseUrl: r.nfseUrl,
  pdfUrl: r.pdfUrl,
  xmlPath: r.xmlPath,
  issuedAt: r.issuedAt,
  errorMessage: r.errorMessage,
  attempts: r.attempts,
  refundedCents: r.refundedCents,
  refundedAt: r.refundedAt,
  canceledAt: r.canceledAt,
  cancelReason: r.cancelReason,
});

@Controller('admin/invoicing')
@UseGuards(AdminGuard)
export class AdminInvoicingController {
  constructor(
    private readonly invoicing: InvoicingService,
    private readonly settings: InvoicingSettingsService,
    private readonly actor: AdminActorService,
  ) {}

  @Get('settings')
  getSettings() {
    return this.settings.view();
  }

  @Put('settings')
  async saveSettings(@CurrentUser() admin: JwtPayload, @Body() body: InvoicingSettingsInput) {
    const email = await this.actor.email(admin);
    const view = await this.settings.save(body ?? {}, email);
    // The token itself is never logged, only that it changed.
    await this.actor.record(admin, {
      action: 'invoicing.settings',
      details: { enabled: view.enabled, autoIssue: view.autoIssue, environment: view.environment, tokenChanged: Boolean(body?.token?.trim() || body?.clearToken) },
    });
    return view;
  }

  @Post('settings/check')
  async check() {
    const provider = await this.settings.provider();
    if (!provider) return { ok: false, message: 'Informe o token do emissor.' };
    return provider.ping();
  }

  @Post('settings/test-emission')
  async testEmission(@CurrentUser() admin: JwtPayload) {
    const res = await this.invoicing.sendTest();
    await this.actor.record(admin, { action: 'invoicing.test_emission', details: { ref: res.ref, state: res.result.state } });
    return res;
  }

  @Get('stats')
  stats() {
    return this.invoicing.stats();
  }

  @Get()
  async list(@Query('status') status = 'all', @Query('q') q = '', @Query('page') page = '1') {
    const limit = 25;
    const offset = (Math.max(1, Number(page) || 1) - 1) * limit;
    const { rows, total } = await this.invoicing.list({ status, q: q.trim(), limit, offset });
    return { rows: rows.map(view), total, pageSize: limit };
  }

  @Post('backfill')
  async backfill(@CurrentUser() admin: JwtPayload) {
    const res = await this.invoicing.backfillFromStripe();
    await this.actor.record(admin, { action: 'invoicing.backfill', details: res });
    return res;
  }

  @Post('queue-all')
  async queueAll(@CurrentUser() admin: JwtPayload) {
    const queued = await this.invoicing.queueAllReview();
    await this.actor.record(admin, { action: 'invoicing.queue_all', details: { queued } });
    return { queued };
  }

  @Patch(':id/customer')
  async customer(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() admin: JwtPayload, @Body() body: Record<string, unknown>) {
    const addr = body?.address as Record<string, unknown> | null | undefined;
    const row = await this.invoicing.updateCustomer(id, {
      name: body?.name === undefined ? undefined : String(body.name),
      email: body?.email === undefined ? undefined : String(body.email),
      doc: body?.doc === undefined ? undefined : String(body.doc),
      address: addr === undefined ? undefined : addr === null ? null : {
        cep: String(addr.cep ?? ''), street: String(addr.street ?? ''), number: String(addr.number ?? ''), complement: String(addr.complement ?? ''),
        neighborhood: String(addr.neighborhood ?? ''), cityIbge: String(addr.cityIbge ?? ''), uf: String(addr.uf ?? ''),
      },
    });
    await this.actor.record(admin, { action: 'invoicing.customer', targetUserId: row.userId, targetLabel: row.stripeInvoiceNumber ?? row.id });
    return view(row);
  }

  @Post(':id/issue')
  async issue(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() admin: JwtPayload) {
    const row = await this.invoicing.issue(id);
    await this.actor.record(admin, { action: 'invoicing.issue', targetUserId: row.userId, targetLabel: row.stripeInvoiceNumber ?? row.id, details: { status: row.status, environment: row.environment } });
    return view(row);
  }

  @Post(':id/refresh')
  async refresh(@Param('id', ParseUUIDPipe) id: string) {
    return view(await this.invoicing.refresh(id));
  }

  @Post(':id/skip')
  async skip(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() admin: JwtPayload, @Body() body: { reason?: string }) {
    const row = await this.invoicing.skip(id, String(body?.reason ?? ''));
    await this.actor.record(admin, { action: 'invoicing.skip', targetUserId: row.userId, targetLabel: row.stripeInvoiceNumber ?? row.id });
    return view(row);
  }

  @Post(':id/cancel')
  async cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() admin: JwtPayload, @Body() body: { reason?: string }) {
    if (!body?.reason) throw new BadRequestException('Informe a justificativa do cancelamento.');
    const row = await this.invoicing.cancel(id, body.reason);
    await this.actor.record(admin, { action: 'invoicing.cancel', targetUserId: row.userId, targetLabel: row.nfseNumber ?? row.id, details: { reason: body.reason } });
    return view(row);
  }
}
