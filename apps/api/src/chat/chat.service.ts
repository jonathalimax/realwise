import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, lt, isNull } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { accounts, categories, categorizationRules, chatFiles, chatMessages, imports, transactions } from '../db/schema';
import { LlmService } from '../llm/llm.service';
import type { LlmContentPart, LlmMessage } from '../llm/llm.types';
import { prepareFile, toContentPart, type PreparedFile } from './attachments';
import { buildSystemPrompt } from './chat.prompt';
import { CHAT_TOOLS, ChatToolsService, type SavedSummary } from './chat-tools.service';
import { TOOL_STATUS, type ChatQuestion, type ChatStreamEvent, type ReviewGroup, type ReviewPayload } from './chat.types';

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
    onEvent?: (event: ChatStreamEvent) => void,
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

    onEvent?.({ type: 'user', message: userMessage });

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
    const reviewByKey = new Map<string, ReviewGroup>();
    let questions: ChatQuestion[] = [];
    let reply = '';

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const result = await this.llm.generate(
        { purpose: 'chat', messages, tools: CHAT_TOOLS, maxTokens: 16000 },
        scope,
        onEvent ? (text) => onEvent({ type: 'delta', text }) : undefined,
      );

      if (result.toolCalls.length === 0) {
        reply = result.text;
        break;
      }

      messages.push({ role: 'assistant', content: result.text || null, tool_calls: result.toolCalls });
      // Text written before tool calls is a preamble; clear it from the live bubble unless it is the question text.
      if (!result.toolCalls.some((c) => c.function.name === 'ask_user')) onEvent?.({ type: 'reset' });
      for (const call of result.toolCalls) {
        onEvent?.({ type: 'status', label: TOOL_STATUS[call.function.name] ?? 'Trabalhando nisso…' });
        const outcome = await this.tools.execute(call.function.name, call.function.arguments, scope);
        if (outcome.saved) saved.push(outcome.saved);
        for (const g of outcome.review ?? []) this.mergeReviewGroup(reviewByKey, g);
        if (outcome.questions) questions = outcome.questions;
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(outcome.result) });
      }
      // A question sheet ends the turn: the user's answers start the next one.
      if (questions.length) {
        reply = result.text || 'Preciso de uma ajudinha para continuar:';
        break;
      }
    }

    if (!reply) reply = saved.length ? 'Pronto! Salvei as transações.' : 'Não consegui concluir agora. Pode tentar de novo?';

    const review = await this.reviewPayload(scope, [...reviewByKey.values()]);

    const [assistantMessage] = await this.db
      .insert(chatMessages)
      .values({
        ...scope,
        role: 'assistant',
        content: reply,
        saved: saved.length ? saved : null,
        questions: questions.length ? questions : null,
        review,
      })
      .returning();

    return { userMessage, assistantMessage };
  }

  private mergeReviewGroup(into: Map<string, ReviewGroup>, g: ReviewGroup) {
    const existing = into.get(g.key);
    if (!existing) {
      into.set(g.key, { ...g });
      return;
    }
    existing.count += g.count;
    existing.total = Number((existing.total + g.total).toFixed(2));
    existing.transactionIds.push(...g.transactionIds);
    for (const s of g.suggestionIds) if (!existing.suggestionIds.includes(s) && existing.suggestionIds.length < 3) existing.suggestionIds.push(s);
  }

  /** Attaches the category list so the sheet is self-contained (includes categories created during this turn). */
  private async reviewPayload(scope: ChatScope, groups: ReviewGroup[]): Promise<ReviewPayload | null> {
    if (groups.length === 0) return null;
    const cats = await this.db
      .select()
      .from(categories)
      .where(and(eq(categories.userId, scope.userId), isNull(categories.deletedAt), eq(categories.clientId, scope.clientId)));
    return { groups, categories: cats.map((c) => ({ id: c.id, name: c.name, type: c.type })), resolved: false };
  }

  private async ownMessage(scope: ChatScope, id: string): Promise<ChatMessageRow> {
    const [msg] = await this.db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.id, id), eq(chatMessages.userId, scope.userId), eq(chatMessages.clientId, scope.clientId)));
    if (!msg) throw new NotFoundException('Message not found');
    return msg;
  }

  /** Turns the user's picks in a question sheet into their next message, so John continues with the documents still attached. */
  async answerQuestions(
    scope: ChatScope,
    messageId: string,
    answers: { questionId: string; value: string; label: string }[],
    onEvent?: (event: ChatStreamEvent) => void,
  ) {
    const msg = await this.ownMessage(scope, messageId);
    const questions = (msg.questions ?? []) as ChatQuestion[];
    if (questions.length === 0 || questions.every((q) => q.answer)) throw new BadRequestException('Nothing to answer.');

    const lines: string[] = [];
    const updated: ChatQuestion[] = [];
    for (const q of questions) {
      const a = answers.find((x) => x.questionId === q.id);
      if (!a || q.answer) {
        updated.push(q);
        continue;
      }
      const isNew = a.value.startsWith('new:');
      const valid = isNew || q.options.some((o) => o.value === a.value);
      if (!valid) throw new BadRequestException('Invalid answer.');
      const label = isNew ? a.value.slice(4).trim().slice(0, 80) : (q.options.find((o) => o.value === a.value)?.label ?? a.label);
      if (!label) throw new BadRequestException('Invalid answer.');
      const where = `${q.title}${q.fileName ? ` (${q.fileName})` : ''}`;

      if (q.kind === 'confirm') {
        // Execute (or drop) the operation the user was shown. The action is read from the stored message,
        // so it is exactly what the preview described.
        if (a.value === 'yes' && q.action) {
          const result = await this.tools.executeConfirmed(q.action, scope);
          lines.push(`${where}: o usuário CONFIRMOU e a ação foi executada. Resultado: ${JSON.stringify(result)}`);
        } else {
          lines.push(`${where}: o usuário CANCELOU. Nada foi alterado.`);
        }
      } else if (isNew) {
        lines.push(`${where}: é uma conta NOVA chamada "${label}" (crie-a e use-a).`);
      } else if (q.kind === 'account') {
        lines.push(`${where}: ${label} (accountId ${a.value}).`);
      } else {
        lines.push(`${where}: ${label}${q.kind === 'payment_method' ? ` (paymentMethod ${a.value})` : ''}.`);
      }
      updated.push({ ...q, answer: { value: a.value, label } });
    }
    if (lines.length === 0) throw new BadRequestException('No answers provided.');

    await this.db.update(chatMessages).set({ questions: updated }).where(eq(chatMessages.id, msg.id));
    const turn = await this.send(scope, lines.join('\n'), [], onEvent);
    return { ...turn, questionsMessage: { ...msg, questions: updated } };
  }

  /**
   * Applies the user's category confirmations to rows that were already saved. No model call:
   * the choice is deterministic, and "remember" feeds the categorization memory.
   */
  async applyReview(
    scope: ChatScope,
    messageId: string,
    decisions: { key: string; categoryId: string; remember: boolean }[],
  ): Promise<{ updated: number; message: ChatMessageRow }> {
    const msg = await this.ownMessage(scope, messageId);
    const review = msg.review as ReviewPayload | null;
    if (!review || review.resolved) throw new BadRequestException('Nothing to review.');

    const owned = await this.db
      .select()
      .from(categories)
      .where(and(eq(categories.userId, scope.userId), isNull(categories.deletedAt), eq(categories.clientId, scope.clientId)));
    const catById = new Map(owned.map((c) => [c.id, c]));

    let updated = 0;
    for (const d of decisions) {
      const group = review.groups.find((g) => g.key === d.key);
      const cat = catById.get(d.categoryId);
      if (!group || !cat) continue;
      const res = await this.db
        .update(transactions)
        .set({ categoryId: cat.id, category: cat.name, updatedAt: new Date() })
        .where(and(inArray(transactions.id, group.transactionIds), eq(transactions.userId, scope.userId), eq(transactions.clientId, scope.clientId)))
        .returning({ id: transactions.id });
      updated += res.length;
      if (d.remember) {
        await this.tools.setCategoryRule({ description: group.merchant, categoryId: cat.id, applyToExisting: false }, scope);
      }
    }

    const resolved: ReviewPayload = { ...review, resolved: true };
    const [message] = await this.db.update(chatMessages).set({ review: resolved }).where(eq(chatMessages.id, msg.id)).returning();
    return { updated, message };
  }

  /** Reverts everything a single AI import saved. */
  async undoImport(scope: ChatScope, importId: string): Promise<{ removed: number }> {
    const [imp] = await this.db
      .select()
      .from(imports)
      .where(and(eq(imports.id, importId), eq(imports.userId, scope.userId), eq(imports.clientId, scope.clientId)));
    if (!imp) throw new NotFoundException('Import not found');
    // Soft delete only: the rows are hidden, never destroyed (they can be restored with John's restore tool).
    const removed = await this.db
      .update(transactions)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(transactions.importId, importId), eq(transactions.userId, scope.userId), isNull(transactions.deletedAt)))
      .returning({ id: transactions.id });
    return { removed: removed.length };
  }

  private async systemPrompt(scope: ChatScope): Promise<string> {
    const [accs, cats, rules] = await Promise.all([
      this.db.select().from(accounts).where(and(eq(accounts.userId, scope.userId), isNull(accounts.deletedAt), eq(accounts.clientId, scope.clientId))),
      this.db.select().from(categories).where(and(eq(categories.userId, scope.userId), isNull(categories.deletedAt), eq(categories.clientId, scope.clientId))),
      this.db
        .select()
        .from(categorizationRules)
        .where(and(eq(categorizationRules.userId, scope.userId), isNull(categorizationRules.deletedAt), eq(categorizationRules.clientId, scope.clientId), eq(categorizationRules.isActive, true)))
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
