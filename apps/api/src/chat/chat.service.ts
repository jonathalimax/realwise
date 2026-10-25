import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, gte, lt } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { accounts, categories, categorizationRules, chatFiles, chatMessages, imports, transactions } from '../db/schema';
import { LlmService } from '../llm/llm.service';
import type { LlmContentPart, LlmMessage } from '../llm/llm.types';
import { prepareFile, toContentPart, type PreparedFile } from './attachments';
import { buildSystemPrompt } from './chat.prompt';
import { CHAT_TOOLS, ChatToolsService, type SavedSummary } from './chat-tools.service';

const HISTORY_LIMIT = 16;
const MAX_TOOL_ROUNDS = 8;
const FILE_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_FILES_PER_MESSAGE = 6;

type ChatMessageRow = typeof chatMessages.$inferSelect;

export interface ChatScope {
  clientId: string;
  userId: string;
}

@Injectable()
export class ChatService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly llm: LlmService,
    private readonly tools: ChatToolsService,
  ) {}

  async history(scope: ChatScope, limit = 50): Promise<ChatMessageRow[]> {
    const rows = await this.db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.userId, scope.userId), eq(chatMessages.clientId, scope.clientId)))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
    return rows.reverse();
  }

  async send(
    scope: ChatScope,
    text: string,
    uploads: { originalname: string; buffer: Buffer; mimetype?: string }[],
  ): Promise<{ userMessage: ChatMessageRow; assistantMessage: ChatMessageRow }> {
    const trimmed = text.trim();
    if (!trimmed && uploads.length === 0) throw new BadRequestException('Send a message or attach a file.');
    if (uploads.length > MAX_FILES_PER_MESSAGE) throw new BadRequestException(`At most ${MAX_FILES_PER_MESSAGE} files per message.`);

    const prepared: PreparedFile[] = uploads.map(prepareFile);

    // History is read before inserting the new message so it is not duplicated in the prompt.
    const prior = await this.history(scope, HISTORY_LIMIT);

    const [userMessage] = await this.db
      .insert(chatMessages)
      .values({
        ...scope,
        role: 'user',
        content: trimmed || '(arquivos anexados)',
        attachments: prepared.length ? prepared.map((p) => ({ name: p.name, kind: p.kind })) : null,
      })
      .returning();

    if (prepared.length) {
      await this.db.insert(chatFiles).values(prepared.map((p) => ({ ...p, ...scope })));
    }

    // Files still pending from earlier turns (the assistant asked a question before saving them).
    await this.db.delete(chatFiles).where(and(eq(chatFiles.userId, scope.userId), lt(chatFiles.createdAt, new Date(Date.now() - FILE_TTL_MS))));
    const pendingFiles = await this.db
      .select()
      .from(chatFiles)
      .where(and(eq(chatFiles.userId, scope.userId), eq(chatFiles.clientId, scope.clientId), gte(chatFiles.createdAt, new Date(Date.now() - FILE_TTL_MS))))
      .orderBy(asc(chatFiles.createdAt));

    const system = await this.systemPrompt(scope);
    const messages: LlmMessage[] = [{ role: 'system', content: system }];
    for (const m of prior) {
      messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content } as LlmMessage);
    }
    const parts: LlmContentPart[] = [{ type: 'text', text: userMessage.content }];
    if (pendingFiles.length) {
      parts.push({
        type: 'text',
        text: `Attached documents not yet saved: ${pendingFiles.map((f) => f.name).join(', ')}`,
      });
      pendingFiles.forEach((f) => parts.push(toContentPart(f as PreparedFile)));
    }
    messages.push({ role: 'user', content: parts });

    const saved: SavedSummary[] = [];
    let reply = '';

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const result = await this.llm.generate(
        { purpose: 'chat', messages, tools: CHAT_TOOLS, maxTokens: 16000 },
        scope,
      );

      if (result.toolCalls.length === 0) {
        reply = result.text;
        break;
      }

      messages.push({ role: 'assistant', content: result.text || null, tool_calls: result.toolCalls });
      for (const call of result.toolCalls) {
        const outcome = await this.tools.execute(call.function.name, call.function.arguments, scope);
        if (outcome.saved) saved.push(outcome.saved);
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(outcome.result) });
      }
    }

    if (!reply) reply = saved.length ? 'Pronto! Salvei as transações.' : 'Não consegui concluir agora. Pode tentar de novo?';

    const [assistantMessage] = await this.db
      .insert(chatMessages)
      .values({ ...scope, role: 'assistant', content: reply, saved: saved.length ? saved : null })
      .returning();

    return { userMessage, assistantMessage };
  }

  /** Reverts everything a single AI import saved. */
  async undoImport(scope: ChatScope, importId: string): Promise<{ removed: number }> {
    const [imp] = await this.db
      .select()
      .from(imports)
      .where(and(eq(imports.id, importId), eq(imports.userId, scope.userId), eq(imports.clientId, scope.clientId)));
    if (!imp) throw new NotFoundException('Import not found');
    const removed = await this.db
      .delete(transactions)
      .where(and(eq(transactions.importId, importId), eq(transactions.userId, scope.userId)))
      .returning({ id: transactions.id });
    await this.db.delete(imports).where(eq(imports.id, importId));
    return { removed: removed.length };
  }

  private async systemPrompt(scope: ChatScope): Promise<string> {
    const [accs, cats, rules] = await Promise.all([
      this.db.select().from(accounts).where(and(eq(accounts.userId, scope.userId), eq(accounts.clientId, scope.clientId))),
      this.db.select().from(categories).where(and(eq(categories.userId, scope.userId), eq(categories.clientId, scope.clientId))),
      this.db
        .select()
        .from(categorizationRules)
        .where(and(eq(categorizationRules.userId, scope.userId), eq(categorizationRules.clientId, scope.clientId), eq(categorizationRules.isActive, true)))
        .orderBy(desc(categorizationRules.usedCount), desc(categorizationRules.updatedAt))
        .limit(150),
    ]);
    return buildSystemPrompt({
      today: new Date().toISOString().slice(0, 10),
      accounts: accs.map((a) => ({ id: a.id, name: a.name, type: a.type, cardName: a.cardName })),
      categories: cats.map((c) => ({ id: c.id, name: c.name, type: c.type })),
      rules: rules.map((r) => ({ keyword: r.keyword, categoryName: r.category, usedCount: r.usedCount })),
    });
  }
}
