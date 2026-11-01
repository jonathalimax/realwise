import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, lt, isNull } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { accounts, categories, categorizationRules, chatFiles, chatMessages, imports, planner, settings, transactions } from '../db/schema';
import { LlmService } from '../llm/llm.service';
import type { LlmContentPart, LlmMessage } from '../llm/llm.types';
import { prepareFile, toContentPart, type PreparedFile } from './attachments';
import { buildSystemPrompt } from './chat.prompt';
import { CHAT_TOOLS, ChatToolsService, type SavedSummary } from './chat-tools.service';
import { ChatCategoriesService } from './chat-categories.service';
import { ChatMemoryService } from './chat-memory.service';
import { MAX_REVIEW_ITEMS, TOOL_STATUS, quickQuestion, type ChatQuestion, type ChatStreamEvent, type ReviewGroup, type ReviewPayload } from './chat.types';
import { ACCOUNT_TYPES, BANKS, DEFAULT_CATEGORIES, WELCOME_GOALS, welcomeMessage } from './onboarding';
import { ChatSnippetsService } from './chat-snippets.service';
import { EngagementRemindersService } from '../engagement-reminders/engagement-reminders.service';

const HISTORY_LIMIT = 16;
/** Messages older than this are neither shown nor sent to the model (keeps the context, and token cost, small). Rows are kept, not destroyed. */
const CHAT_RETENTION_DAYS = 3;
const MAX_TOOL_ROUNDS = 8;
const FILE_TTL_MS = 24 * 60 * 60 * 1000;
/** Upper bound (base64 chars ≈ bytes) of document data sent to the model in one request. */
const MAX_ATTACHED_BYTES = 24 * 1024 * 1024;
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
    private readonly cats: ChatCategoriesService,
    private readonly memory: ChatMemoryService,
    private readonly snippets: ChatSnippetsService,
    private readonly engagement: EngagementRemindersService,
  ) {}

  async history(scope: ChatScope, limit = 50): Promise<ChatMessageRow[]> {
    const rows = await this.db
      .select()
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.userId, scope.userId),
          eq(chatMessages.clientId, scope.clientId),
          gte(chatMessages.createdAt, new Date(Date.now() - CHAT_RETENTION_DAYS * 24 * 60 * 60 * 1000)),
        ),
      )
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
    const ordered = rows.reverse();

    // A category sheet saved earlier carries the category list from when it was created. Refresh it so the picker
    // always offers every category the user has now (including ones enabled in Settings since).
    const openReviews = ordered.filter((m) => {
      const r = m.review as ReviewPayload | null;
      return r && !r.resolved && Array.isArray(r.groups) && r.groups.length > 0;
    });
    if (openReviews.length > 0) {
      await this.cats.ensure(scope);
      const current = await this.db
        .select({ id: categories.id, name: categories.name, type: categories.type })
        .from(categories)
        .where(and(eq(categories.userId, scope.userId), eq(categories.clientId, scope.clientId), isNull(categories.deletedAt)));
      for (const m of openReviews) m.review = { ...(m.review as ReviewPayload), categories: current };
    }
    return ordered;
  }

  async send(
    scope: ChatScope,
    text: string,
    uploads: { originalname: string; buffer: Buffer; mimetype?: string }[],
    onEvent?: (event: ChatStreamEvent) => void,
    /** `displayText` is what the user sees in their bubble; `text` (technical, with ids/results) goes only to the model. */
    options?: { displayText?: string },
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
        content: options?.displayText?.trim() || trimmed || '(arquivos anexados)',
        attachments: prepared.length ? prepared.map((p) => ({ name: p.name, kind: p.kind })) : null,
      })
      .returning();

    onEvent?.({ type: 'user', message: userMessage });

    // A tapped quick-reply chip that stands for a ready-made explanation is answered from the database: no model call.
    if (prepared.length === 0) {
      const scripted = await this.snippets.byTrigger(trimmed);
      if (scripted) {
        // The goal chips of the welcome are remembered like a goal the user typed, then the next step is offered.
        if (scripted.key.startsWith('goal_') && scripted.triggerLabel) {
          await this.memory.add(scope, `Objetivo: ${scripted.triggerLabel}`, 'goal', 'user').catch(() => undefined);
        }
        const questions: ChatQuestion[] =
          scripted.key === 'account_offer'
            ? [{ id: 'q1', kind: 'account_form', title: 'Cadastre sua primeira conta ou cartão', subtitle: 'O nome do titular me ajuda a reconhecer transferências entre as suas contas.', options: BANKS.map((b) => ({ value: b.id, label: b.name })) }]
            : [quickQuestion(scripted.quickReplies)];
        const [assistantMessage] = await this.db
          .insert(chatMessages)
          .values({ ...scope, role: 'assistant', content: scripted.body, questions })
          .returning();
        return { userMessage, assistantMessage };
      }
    }

    if (prepared.length) {
      // A re-upload (e.g. retrying after an error) replaces the earlier copy instead of piling up next to it.
      await this.db
        .delete(chatFiles)
        .where(and(eq(chatFiles.userId, scope.userId), inArray(chatFiles.name, prepared.map((p) => p.name))));
      await this.db.insert(chatFiles).values(prepared.map((p) => ({ ...p, ...scope })));
    }

    // Files still pending from earlier turns (the assistant asked a question before saving them).
    await this.db.delete(chatFiles).where(and(eq(chatFiles.userId, scope.userId), lt(chatFiles.createdAt, new Date(Date.now() - FILE_TTL_MS))));
    const allPending = await this.db
      .select()
      .from(chatFiles)
      .where(and(eq(chatFiles.userId, scope.userId), eq(chatFiles.clientId, scope.clientId), gte(chatFiles.createdAt, new Date(Date.now() - FILE_TTL_MS))))
      .orderBy(asc(chatFiles.createdAt));
    // Never send an unbounded pile: keep the newest files that fit the budget (this turn's uploads are the newest).
    const pendingFiles: typeof allPending = [];
    let budget = MAX_ATTACHED_BYTES;
    for (const f of [...allPending].reverse()) {
      if (pendingFiles.length >= MAX_FILES_PER_MESSAGE || f.data.length > budget) continue;
      budget -= f.data.length;
      pendingFiles.unshift(f);
    }

    await this.cats.ensure(scope); // every category enabled in Settings is available to Elio and the review sheet
    const system = await this.systemPrompt(scope);
    // The month snapshot changes every turn, so it rides in its own message after the (cached) system prompt.
    const snapshot = await this.memory.monthSnapshot(scope);
    const messages: LlmMessage[] = [{ role: 'system', content: system }, { role: 'system', content: snapshot }];
    for (const m of prior) {
      messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content } as LlmMessage);
    }
    const parts: LlmContentPart[] = [{ type: 'text', text: trimmed || userMessage.content }];
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
    let staticReply = '';

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const result = await this.llm.generate(
        // Reading statements needs the strong model; everything else (questions, edits, answers) runs on the cheap one.
        { purpose: 'chat', tier: pendingFiles.length ? 'strong' : 'light', messages, tools: CHAT_TOOLS, maxTokens: 16000, statement: pendingFiles.length > 0 },
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
        if (outcome.staticReply) staticReply = outcome.staticReply;
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(outcome.result) });
      }
      // A ready-made explanation from the database is the whole reply: show it and stop, no second model call.
      if (staticReply) {
        reply = staticReply;
        onEvent?.({ type: 'reset' });
        onEvent?.({ type: 'delta', text: staticReply });
        break;
      }
      // A question sheet ends the turn: the user's answers start the next one.
      if (questions.length) {
        // The model's own sentence wins; otherwise the question text; the generic line is the last resort.
        const quickOnly = questions.every((q) => q.kind === 'quick');
        reply = result.text || (quickOnly ? questions.find((q) => q.title)?.title || 'Escolha uma opção abaixo ou me conte do seu jeito:' : '') || 'Preciso de uma ajudinha para continuar:';
        break;
      }
    }

    if (!reply) reply = saved.length ? 'Pronto! Salvei as transações.' : 'Não consegui concluir agora. Pode tentar de novo?';

    // The turn saved data and asked nothing, so Elio has dealt with whatever was attached: clear it, so it is never
    // re-sent with later messages. (If he asked something, or saved nothing, the files stay for the user's answer.)
    if (questions.length === 0 && saved.length > 0 && pendingFiles.length > 0) {
      await this.db
        .delete(chatFiles)
        .where(and(eq(chatFiles.userId, scope.userId), inArray(chatFiles.id, pendingFiles.map((f) => f.id))));
    }

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

  // ───────────────────────────── onboarding ─────────────────────────────

  private async hasIncomeConfigured(scope: ChatScope): Promise<boolean> {
    const [row] = await this.db
      .select()
      .from(planner)
      .where(and(eq(planner.clientId, scope.clientId), eq(planner.userId, scope.userId)));
    const raw = (row?.state as { plannerVersions?: unknown } | null)?.plannerVersions;
    const versions = Array.isArray(raw) ? (raw as { salarioBruto?: unknown }[]) : [];
    return Number(row?.salaryGross ?? 0) > 0 || versions.some((v) => Number(v.salarioBruto) > 0);
  }

  /** A user needs setup until they have at least one account: the chat then leads them through it. */
  async onboardingStatus(scope: ChatScope): Promise<{ needsSetup: boolean; accountCount: number; categoryCount: number }> {
    const [accs, cats] = await Promise.all([
      this.db.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.userId, scope.userId), eq(accounts.clientId, scope.clientId), isNull(accounts.deletedAt))),
      this.db.select({ id: categories.id }).from(categories).where(and(eq(categories.userId, scope.userId), eq(categories.clientId, scope.clientId), isNull(categories.deletedAt))),
    ]);
    return { needsSetup: accs.length === 0, accountCount: accs.length, categoryCount: cats.length };
  }

  /**
   * First chat open for a user with no accounts: creates the default categories (once) and posts Elio's scripted
   * welcome with the account form. Idempotent: it does nothing if the welcome is already in the recent conversation.
   */
  async startOnboarding(scope: ChatScope): Promise<{ needsSetup: boolean; message: ChatMessageRow | null }> {
    const status = await this.onboardingStatus(scope);
    if (!status.needsSetup) return { needsSetup: false, message: null };

    if (status.categoryCount === 0) {
      await this.db.insert(categories).values(DEFAULT_CATEGORIES.map((c) => ({ ...scope, name: c.name, type: c.type, color: c.color, icon: c.icon })));
    }

    const recent = await this.history(scope, 50);
    // Earlier versions opened the account form with the welcome, so that counts as welcomed too.
    const alreadyWelcomed = recent.some(
      (m) =>
        m.role === 'assistant' &&
        Array.isArray(m.questions) &&
        (m.questions as ChatQuestion[]).some((q) => q.kind === 'account_form' || q.id === 'welcome'),
    );
    if (alreadyWelcomed) return { needsSetup: true, message: null };

    const [s] = await this.db.select().from(settings).where(and(eq(settings.userId, scope.userId), eq(settings.clientId, scope.clientId)));
    const lang = String(s?.language ?? 'pt-BR').toLowerCase().startsWith('en') ? 'en' : 'pt';
    // Portuguese welcome and chips come from the database (editable, no model call); English falls back to code.
    const snippet = lang === 'pt' ? await this.snippets.get('welcome') : null;
    const content = snippet?.body ?? welcomeMessage(lang).content;
    const chips = quickQuestion(snippet?.quickReplies?.length ? snippet.quickReplies : WELCOME_GOALS[lang]);
    const [message] = await this.db
      .insert(chatMessages)
      .values({ ...scope, role: 'assistant', content, questions: [{ ...chips, id: 'welcome' }] })
      .returning();
    // The first chat open is the start of the interview: send the warm welcome e-mail (once, never blocks the chat).
    void this.engagement.sendWelcome(scope.userId);
    return { needsSetup: true, message };
  }

  /** Saves the onboarding account form, then lets Elio continue the conversation (next: more accounts, income, first statement). */
  async submitAccountForm(
    scope: ChatScope,
    messageId: string,
    form: {
      bankId: string;
      customBankName?: string;
      cardName?: string;
      type: string;
      holderName: string;
      closingDay?: number;
      paymentDay?: number;
    },
    onEvent?: (event: ChatStreamEvent) => void,
  ) {
    const msg = await this.ownMessage(scope, messageId);
    const questions = (msg.questions ?? []) as ChatQuestion[];
    const target = questions.find((q) => q.kind === 'account_form' && !q.answer);
    if (!target) throw new BadRequestException('There is no account form waiting to be filled.');

    if (!BANKS.some((b) => b.id === form.bankId)) throw new BadRequestException('Choose a bank from the list.');
    if (!(ACCOUNT_TYPES as readonly string[]).includes(form.type)) throw new BadRequestException('Invalid account type.');
    if (form.bankId === 'other' && !form.customBankName?.trim()) throw new BadRequestException('Type the bank name.');
    if (!form.holderName?.trim()) throw new BadRequestException('Enter the account holder name.');
    if (form.type === 'credit' && (!form.closingDay || !form.paymentDay)) throw new BadRequestException('Enter the closing and due day of the card.');

    const acc = await this.tools.createAccountFull(scope, {
      bankId: form.bankId,
      customBankName: form.customBankName,
      cardName: form.cardName,
      type: form.type as 'checking' | 'savings' | 'credit' | 'wallet',
      holderName: form.holderName,
      closingDay: form.closingDay ?? null,
      paymentDay: form.paymentDay ?? null,
    });

    const updated = questions.map((q) => (q === target ? { ...q, answer: { value: acc.id, label: acc.name } } : q));
    await this.db.update(chatMessages).set({ questions: updated }).where(eq(chatMessages.id, msg.id));

    const bank = BANKS.find((b) => b.id === form.bankId)?.name ?? form.customBankName;
    const kind = form.type === 'credit' ? 'cartão de crédito' : form.type === 'wallet' ? 'carteira' : form.type === 'savings' ? 'poupança' : 'conta corrente';
    const text = `Cadastrei a conta "${acc.name}" (${bank}, ${kind}, titular ${form.holderName.trim()}).`;
    const turn = await this.send(scope, text, [], onEvent);
    return { ...turn, questionsMessage: { ...msg, questions: updated } };
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
    existing.items.push(...g.items.slice(0, Math.max(0, MAX_REVIEW_ITEMS - existing.items.length)));
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

  /** Turns the user's picks in a question sheet into their next message, so Elio continues with the documents still attached. */
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
    const shown: string[] = []; // what the user sees as their own message (no ids, no JSON)
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
          shown.push(label);
        } else {
          lines.push(`${where}: o usuário CANCELOU. Nada foi alterado.`);
          shown.push(label);
        }
      } else if (isNew) {
        lines.push(`${where}: é uma conta NOVA chamada "${label}" (crie-a e use-a).`);
        shown.push(`Conta nova: ${label}`);
      } else if (q.kind === 'account') {
        lines.push(`${where}: ${label} (accountId ${a.value}).`);
        shown.push(label);
      } else {
        lines.push(`${where}: ${label}${q.kind === 'payment_method' ? ` (paymentMethod ${a.value})` : ''}.`);
        shown.push(label);
      }
      updated.push({ ...q, answer: { value: a.value, label } });
    }
    if (lines.length === 0) throw new BadRequestException('No answers provided.');

    await this.db.update(chatMessages).set({ questions: updated }).where(eq(chatMessages.id, msg.id));
    const displayText = shown.length > 1 ? shown.map((l) => `• ${l}`).join('\n') : shown[0];
    const turn = await this.send(scope, lines.join('\n'), [], onEvent, { displayText });
    return { ...turn, questionsMessage: { ...msg, questions: updated } };
  }

  /**
   * Applies the user's category confirmations to rows that were already saved. No model call:
   * the choice is deterministic, and "remember" feeds the categorization memory.
   */
  async applyReview(
    scope: ChatScope,
    messageId: string,
    decisions: { key: string; categoryId?: string; remember: boolean; transfer?: boolean; ignore?: boolean }[],
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
      if (!group) continue;
      if (d.transfer === true) {
        // The user says this is money moving between their own accounts: no category, left out of totals, linked to its other side.
        const res = await this.db
          .update(transactions)
          .set({ isTransfer: true, ignored: true, categoryId: null, category: null, updatedAt: new Date() })
          .where(and(inArray(transactions.id, group.transactionIds), eq(transactions.userId, scope.userId), eq(transactions.clientId, scope.clientId), isNull(transactions.deletedAt)))
          .returning({ id: transactions.id });
        updated += res.length;
        if (d.remember) await this.tools.rememberLeftOutRule(group.merchant, 'transfer', scope);
        continue;
      }
      if (d.ignore === true) {
        // "Don't count this" (e.g. a card invoice payment): out of every total, but it is not a transfer, so nothing gets linked.
        const res = await this.db
          .update(transactions)
          .set({ ignored: true, categoryId: null, category: null, updatedAt: new Date() })
          .where(and(inArray(transactions.id, group.transactionIds), eq(transactions.userId, scope.userId), eq(transactions.clientId, scope.clientId), isNull(transactions.deletedAt)))
          .returning({ id: transactions.id });
        updated += res.length;
        if (d.remember) await this.tools.rememberLeftOutRule(group.merchant, 'ignore', scope);
        continue;
      }
      const cat = d.categoryId ? catById.get(d.categoryId) : undefined;
      if (!cat) continue;
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

    await this.tools.linkTransfers(scope);

    const resolved: ReviewPayload = { ...review, resolved: true };
    const [message] = await this.db.update(chatMessages).set({ review: resolved }).where(eq(chatMessages.id, msg.id)).returning();
    return { updated, message };
  }

  /**
   * Called when a streamed turn ends. If the person had already left (closed the app while a statement was being read),
   * the reply is waiting for them: send the "your statement is ready" e-mail, with how many rows need a category.
   */
  notifyTurnFinishedAway(result: unknown): void {
    const m = (result as { assistantMessage?: ChatMessageRow } | null)?.assistantMessage;
    if (!m || (!m.saved && !m.review)) return;
    const groups = (m.review as ReviewPayload | null)?.groups ?? [];
    void this.engagement.sendStatementReady(m.userId, m.id, groups.reduce((acc, g) => acc + g.count, 0));
  }

  /** Reverts everything a single AI import saved. */
  async undoImport(scope: ChatScope, importId: string): Promise<{ removed: number }> {
    const [imp] = await this.db
      .select()
      .from(imports)
      .where(and(eq(imports.id, importId), eq(imports.userId, scope.userId), eq(imports.clientId, scope.clientId)));
    if (!imp) throw new NotFoundException('Import not found');
    // Soft delete only: the rows are hidden, never destroyed (they can be restored with Elio's restore tool).
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
    const hasIncome = await this.hasIncomeConfigured(scope);
    const memory = await this.memory.factsBlock(scope);
    return buildSystemPrompt({
      memory,
      setup: { accountCount: accs.length, categoryCount: cats.length, hasIncome },
      today: new Date().toISOString().slice(0, 10),
      accounts: accs.map((a) => ({ id: a.id, name: a.name, type: a.type, cardName: a.cardName, holderName: a.holderName })),
      categories: cats.map((c) => ({ id: c.id, name: c.name, type: c.type })),
      rules: rules.map((r) => ({ keyword: r.keyword, categoryName: r.category, usedCount: r.usedCount, isTransfer: r.type === 'transfer', isIgnore: r.type === 'ignore' })),
    });
  }
}
