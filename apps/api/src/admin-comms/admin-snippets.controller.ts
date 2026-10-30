import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ChatSnippetsService } from '../chat/chat-snippets.service';
import { AdminActorService } from './admin-actor.service';

const KEY_RE = /^[a-z_]{1,40}$/;

/** Edit the fixed texts Elio shows (welcome, how it works, ...). Keys are fixed by the code, so there is no create or delete. */
@Controller('admin/chat-snippets')
@UseGuards(AdminGuard)
export class AdminSnippetsController {
  constructor(
    private readonly snippets: ChatSnippetsService,
    private readonly actor: AdminActorService,
  ) {}

  @Get()
  list() {
    return this.snippets.list();
  }

  @Put(':key')
  async update(@CurrentUser() admin: JwtPayload, @Param('key') key: string, @Body() body: Record<string, unknown>) {
    if (!KEY_RE.test(key)) throw new BadRequestException('Chave inválida');
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const text = typeof body?.body === 'string' ? body.body.trim() : '';
    if (!title || title.length > 120) throw new BadRequestException('O título é obrigatório (até 120 caracteres).');
    if (!text || text.length > 4000) throw new BadRequestException('O texto é obrigatório (até 4000 caracteres).');
    const rawChips = Array.isArray(body?.quickReplies) ? body.quickReplies : [];
    const chips = rawChips.map((c) => (typeof c === 'string' ? c.trim() : '')).filter(Boolean);
    if (chips.length > 6) throw new BadRequestException('No máximo 6 respostas rápidas (o "Pular" é automático).');
    if (chips.some((c) => c.length > 40)) throw new BadRequestException('Cada resposta rápida tem no máximo 40 caracteres.');
    const trigger = typeof body?.triggerLabel === 'string' && body.triggerLabel.trim() ? body.triggerLabel.trim() : null;
    if (trigger && trigger.length > 80) throw new BadRequestException('O gatilho tem no máximo 80 caracteres.');
    if (trigger) {
      const clash = (await this.snippets.list()).find((s) => s.key !== key && s.triggerLabel?.trim().toLowerCase() === trigger.toLowerCase());
      if (clash) throw new BadRequestException(`Esse gatilho já abre o texto "${clash.title}".`);
    }
    const ok = await this.snippets.update(key, { title, body: text, quickReplies: chips, triggerLabel: trigger });
    if (!ok) throw new NotFoundException('Texto não encontrado');
    await this.actor.record(admin, { action: 'chat_snippet.update', details: { key } });
    return (await this.snippets.list()).find((s) => s.key === key);
  }
}
