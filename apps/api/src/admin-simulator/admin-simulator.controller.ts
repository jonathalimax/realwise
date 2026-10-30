import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ChatService } from '../chat/chat.service';
import { OpsAssistantService } from './ops-assistant.service';
import { SimulatorService } from './simulator.service';

type Answer = { questionId: string; value: string; label: string };
type AccountForm = Parameters<ChatService['submitAccountForm']>[2];

/** Admin-only playground: talk to the real Elio as a throwaway user, or ask an analyst about the business. */
@Controller('admin/simulator')
@UseGuards(AdminGuard)
export class AdminSimulatorController {
  constructor(
    private readonly sim: SimulatorService,
    private readonly chat: ChatService,
    private readonly ops: OpsAssistantService,
  ) {}

  @Get('messages')
  async messages(@CurrentUser() admin: JwtPayload) {
    return this.chat.history(await this.sim.sandbox(admin.sub), 100);
  }

  /** Wipes the sandbox. With `interview`, it also opens the chat like a brand-new user (scripted welcome + chips). */
  @Post('reset')
  @HttpCode(200)
  async reset(@CurrentUser() admin: JwtPayload, @Body() body: { interview?: boolean }) {
    const scope = await this.sim.reset(admin.sub);
    if (body?.interview) await this.chat.startOnboarding(scope);
    return this.chat.history(scope, 100);
  }

  @Post('send')
  @HttpCode(200)
  async send(@CurrentUser() admin: JwtPayload, @Body() body: { message?: string }) {
    const message = String(body?.message ?? '').trim();
    if (!message || message.length > 4000) throw new BadRequestException('Mensagem inválida.');
    return this.chat.send(await this.sim.sandbox(admin.sub), message, []);
  }

  @Post('messages/:id/answers')
  @HttpCode(200)
  async answers(@CurrentUser() admin: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() body: { answers?: Answer[] }) {
    if (!Array.isArray(body?.answers) || body.answers.length === 0) throw new BadRequestException('Sem respostas.');
    return this.chat.answerQuestions(await this.sim.sandbox(admin.sub), id, body.answers);
  }

  @Post('messages/:id/account-form')
  @HttpCode(200)
  async accountForm(@CurrentUser() admin: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() body: AccountForm) {
    return this.chat.submitAccountForm(await this.sim.sandbox(admin.sub), id, body);
  }

  /** Business analyst: stateless, the page sends the conversation so far. */
  @Post('ops')
  @HttpCode(200)
  async askOps(@CurrentUser() admin: JwtPayload, @Body() body: { messages?: { role: string; content: string }[] }) {
    const history = (Array.isArray(body?.messages) ? body.messages : [])
      .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    if (history.length === 0 || history[history.length - 1].role !== 'user') throw new BadRequestException('Envie uma pergunta.');
    return this.ops.ask(history, await this.sim.sandbox(admin.sub));
  }
}
