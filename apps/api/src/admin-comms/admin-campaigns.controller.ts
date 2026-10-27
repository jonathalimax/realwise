import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { AdminActorService } from './admin-actor.service';
import { CampaignsService } from './campaigns.service';
import { marketingUnsubscribeUrl } from './marketing-token';
import { pageParams } from './pagination';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Controller('admin/campaigns')
@UseGuards(AdminGuard)
export class AdminCampaignsController {
  constructor(
    private readonly campaigns: CampaignsService,
    private readonly notifications: NotificationsService,
    private readonly actor: AdminActorService,
  ) {}

  @Get()
  list(@Query('status') status?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.campaigns.list(status || undefined, pageParams(page, pageSize));
  }

  @Post()
  async create(@CurrentUser() admin: JwtPayload, @Body() body: Record<string, unknown>) {
    const row = await this.campaigns.create(body ?? {}, await this.actor.email(admin));
    await this.actor.record(admin, { action: 'campaign.create', targetLabel: row.name, details: { campaignId: row.id } });
    return row;
  }

  @Post('audience')
  @HttpCode(200)
  audience(@Body() body: { segment?: unknown }) {
    return this.campaigns.audiencePreview(body?.segment);
  }

  /** Renders the brand-template HTML for the admin's live preview (nothing is stored or sent). */
  @Post('preview')
  @HttpCode(200)
  preview(@Body() body: { subject?: string; body?: string; ctaLabel?: string | null; ctaUrl?: string | null }) {
    const html = this.notifications.renderCampaignEmail(
      { subject: String(body?.subject ?? ''), body: String(body?.body ?? ''), ctaLabel: body?.ctaLabel, ctaUrl: body?.ctaUrl },
      marketingUnsubscribeUrl('00000000-0000-0000-0000-000000000000'),
    );
    return { html };
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.campaigns.get(id);
  }

  @Patch(':id')
  async update(@CurrentUser() admin: JwtPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    const row = await this.campaigns.update(id, body ?? {});
    await this.actor.record(admin, { action: 'campaign.update', targetLabel: row.name, details: { campaignId: id, fields: Object.keys(body ?? {}) } });
    return row;
  }

  @Delete(':id')
  async remove(@CurrentUser() admin: JwtPayload, @Param('id') id: string) {
    const row = await this.campaigns.remove(id);
    await this.actor.record(admin, { action: 'campaign.delete', targetLabel: row.name, details: { campaignId: id } });
    return { ok: true };
  }

  @Post(':id/test')
  @HttpCode(200)
  async test(@CurrentUser() admin: JwtPayload, @Param('id') id: string, @Body() body: { to?: string }) {
    if (!body?.to || !EMAIL_RE.test(body.to)) throw new BadRequestException('Informe um e-mail válido em "to".');
    await this.campaigns.sendTest(id, body.to);
    await this.actor.record(admin, { action: 'campaign.test_send', details: { campaignId: id, to: body.to } });
    return { ok: true };
  }

  @Post(':id/send')
  @HttpCode(200)
  async send(@CurrentUser() admin: JwtPayload, @Param('id') id: string, @Body() body: { scheduledAt?: string | null }) {
    const row = await this.campaigns.send(id, body?.scheduledAt);
    await this.actor.record(admin, {
      action: row.status === 'scheduled' ? 'campaign.schedule' : 'campaign.send',
      targetLabel: row.name,
      details: { campaignId: id, recipientCount: row.recipientCount, scheduledAt: row.scheduledAt },
    });
    return row;
  }

  @Get(':id/sends')
  sends(@Param('id') id: string, @Query('status') status?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.campaigns.sends(id, status || undefined, pageParams(page, pageSize));
  }
}
