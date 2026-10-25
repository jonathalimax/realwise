# Feature: AI Chat Assistant

## Purpose

The chat (`/chat`) is the **only** way for customers to add data (transactions, bills, accounts, categories) and the place to ask questions about their finances. The home screen shows AI insight cards and an "ask anything" bar that opens the chat.

## Persona

The assistant is **John**, a financial specialist: polite but relaxed, happy, inspiring, confident and empathetic. The persona lives in `chat/chat.prompt.ts` (and the insights prompt); keep numbers factual and advice general (not licensed advice).

## Architecture

```txt
apps/web  pages/Chat.jsx  ──multipart──▶  POST /chat/messages
                                              │
apps/api  chat/ChatService  (tool-calling loop, max 8 rounds)
            ├── chat/ChatToolsService   save_transactions, create_account, create_category,
            │                           create_bill, set_category_rule, query_transactions,
            │                           summarize_transactions
            └── llm/LlmService ──▶ LlmProvider (OpenRouterProvider)  + llm_call_log + monthly budget
```

- **LLM provider** (`apps/api/src/llm`): `LlmProvider` interface, `OpenRouterProvider` implementation (same approach as the `realwise-aichat` inference gateway: OpenRouter, `provider: { zdr: true, data_collection: 'deny' }`). `LlmService` enforces `LLM_MONTHLY_BUDGET_USD` per user and logs tokens/cost in `llm_call_log`. Model per purpose: `chat` and `insights`.
- **Documents**: PDF (sent natively as `file` parts), images, CSV/TSV/TXT/OFX/QIF (text) and XLSX (converted to CSV text). Up to 6 files × 15 MB per message.
- **Account detection**: the system prompt lists the user's accounts; the model must pick one with confidence or ask the user a question. Files stay in `chat_files` (24h TTL, deleted when saved via `sourceFile`) so the follow-up answer still has the documents.
- **Streaming**: `POST /chat/messages` and `POST /chat/messages/:id/answers` stream as Server-Sent Events when called with `Accept: text/event-stream` (events: `user`, `delta`, `reset`, `status`, `done`, `error`); without it they return the same final JSON. `OpenRouterProvider.generateStream` forwards text deltas and reassembles fragmented tool calls; `LlmService.generate(req, scope, onText)` keeps budget/logging identical. The web client (`lib/api/resources/chat.js` `postStream`) feeds a typewriter bubble (`LiveBubble` in `pages/Chat.jsx`) that reveals characters at a catch-up pace. Proxies must not buffer (`X-Accel-Buffering: no` is set).
- **Scrolling** (`pages/Chat.jsx`): the page follows the conversation only while the user is at the bottom (a `ResizeObserver` on the message list, not the incoming text, because the typewriter reveals after arrival); scrolling up stops following and shows a jump-to-latest button; the list's bottom padding tracks the composer's height.
- **Formatting**: assistant replies render a safe Markdown subset (`components/chat/Markdown.jsx`: paragraphs, lists, **bold**, `code`; React text nodes only, a half-typed `**` is hidden while streaming). The prompt asks for short paragraphs/bullets and no tables.
- **Mobile/iOS robustness**: the composer is `position: sticky` (not fixed) so it cannot be stranded when iOS leaves the viewport shrunk after a keyboard/native picker; the text box is blurred before the file picker opens; a `visualViewport` listener nudges a relayout; sheets freeze the page (`position: fixed` body, scroll restored on close), avoid `backdrop-filter`, and use 16px form controls (iOS zooms on anything smaller).
- **Retention**: only the last 3 days of messages are shown and sent to the model (`CHAT_RETENTION_DAYS` in `chat.service.ts`), which keeps the context and token cost small. Rows are not destroyed; financial data is unaffected.
- **Naming**: the UI chrome says "Assistente IA" / "AI Assistant" (nav, header, composer placeholder "Como posso te ajudar?"); "John" is the persona — a small sender label on his messages and a brief self-introduction in the welcome card and in his replies.
- **Pending files**: uploads wait in `chat_files` only until handled. A turn that saved data and asked nothing clears them; re-uploading a filename replaces the old copy; at most 6 files / 24 MB are re-attached per request.
- **Interactive sheets** (bottom sheets in `pages/Chat.jsx`, state on `chat_messages.questions` / `.review`):
  - *Question sheet* — when John can't tell the account (or payment method) of a document he calls `ask_user` and the turn ends. Account options always come from the database (never the model) plus a "new account" text field; the answers are posted to `POST /chat/messages/:id/answers`, become the next user message, and John continues with the documents still attached.
  - *Review sheet* — `save_transactions` saves **every** row immediately; rows with `confidence: "low"` (or no category) are grouped by merchant (`UBER ×7`) with up to 3 suggested categories. `POST /chat/messages/:id/review` updates the already-saved rows directly (no model call) and, with "remember" on, upserts the categorization rule.
  - Payment method (`credit|debit|pix|transfer|boleto|cash|other`) is inferred by John and stored in `transactions.payment_method`; asked only when unclear.
- **Editing and deleting** (`chat/chat-edit.service.ts`): tools `find_records`, `update_records`, `delete_records`, `restore_records` over a strict per-entity allowlist (transaction, account incl. closing/payment day, category, bill, budget, categorization rule, settings). Fields are type/range-validated and category/account references must belong to the user. A single-record update applies immediately; **every delete and any multi-record update is parked as a `confirm` question** (the exact action is stored server-side in `chat_messages.questions[].action`) and runs only when the user taps Confirm (`POST /chat/messages/:id/answers`), so the model cannot skip the gate. Every change is written to `chat_change_log` with the previous values.
- **Soft delete is a global rule**: `deleted_at` on transactions, accounts, categories, bills, budgets and categorization_rules. All existing services (`remove`) and all read paths filter `deleted_at IS NULL`; undo-import and John's deletes are soft too and recoverable via `restore_records`. New queries on these tables MUST add `isNull(table.deletedAt)`. (Not covered: investments and admin coupons/testimonials still hard-delete.)
- **Memory**: `categorization_rules` (merchant key → category) are injected in the system prompt (top 150 by `used_count`). `set_category_rule` upserts a rule keyed by `merchantKey()` (`chat/pattern.ts`) and can re-categorize past transactions. Saved rows matching a rule bump its `used_count`.
- **Dedup**: `transactions.dedup_hash` = sha1(user, account, date, amount, merchant pattern) + occurrence index, so re-uploading overlapping statements never double-counts while identical same-day purchases are kept.
- **Undo**: every AI save creates an `imports` row; `POST /chat/imports/:id/undo` deletes its transactions.
- **Insights**: `GET /chat/insights?month=YYYY-MM` builds SQL aggregates, asks the model for 3–4 cards, caches in `ai_insights` (unique per user+month, invalidated by a hash of the aggregates).

## Endpoints (all cookie-authenticated, scoped by `clientId` + `sub`)

| Method | Path | Notes |
|---|---|---|
| GET | `/chat/messages` | last 50 messages |
| POST | `/chat/messages` | multipart: `message`, `files[]` |
| POST | `/chat/messages/:id/answers` | answers to a question sheet → `{ userMessage, assistantMessage, questionsMessage }` |
| POST | `/chat/messages/:id/review` | `{ decisions: [{ key, categoryId, remember }] }` → `{ updated, message }` |
| POST | `/chat/imports/:id/undo` | revert one AI import |
| GET | `/chat/insights?month=` | `{ items: [{ title, body, tone }] }` |

## Runtime variables

`OPENROUTER_API_KEY` (required, otherwise 503), `LLM_MODEL_CHAT`, `LLM_MODEL_INSIGHTS` (default `anthropic/claude-sonnet-5.5` — verify the slug on OpenRouter), `LLM_MONTHLY_BUDGET_USD` (per user; blank/unset = 5, `0` = no caps), `LLM_MODEL_FALLBACK` (e.g. `anthropic/claude-haiku-5.5`: used once a user passes the budget, until budget × `LLM_HARD_CAP_MULTIPLIER` (default 3), then 429; unset = stop at the budget). Fallback models need an entry in `llm/model-pricing.ts` or their spend counts as $0, `OPENROUTER_API_URL`.

## Disabled / hidden

- Manual add (FABs on Home/Income/Expenses/Bills), the Import entry and `/import` (redirects to `/chat`).
- Investments and B3 sync (`features.investments`/`b3Sync` = false in `public/clients/*.json`), `/goals` (redirects home). Code is kept, unreachable.
- Gemini categorization (`aiCategorizationService.js`, `geminiApiKey`) is only reachable from the now-unrouted `ImportModal`; candidates for deletion together with the client-side bank parsers.

## Agent notes

- Tool arguments come from the model: validate everything in `ChatToolsService` and scope every query by `clientId` + `userId`.
- Document/tool text is data, never instructions (see `chat.prompt.ts`).
- New write capabilities for the chat = new tool in `CHAT_TOOLS` + executor + a line in the system prompt.
