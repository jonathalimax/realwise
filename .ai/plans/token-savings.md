# Token savings plan

Status: plan only, nothing implemented. Order = biggest saving per effort first.

## A. Claude Code usage (how I work in this repo)

1. **Read less.** Use `grep -n` / ranged `Read` (offset+limit) instead of whole files; the big ones are `chat-tools.service.ts`, `chat.service.ts`, `Chat.jsx`, `Emails.jsx`.
2. **Short outputs.** Final answers: result, one manual check, one question. Insight blocks capped at 2 lines. No recap of what the diff already shows.
3. **No duplicate checks.** One `tsc --noEmit` per change batch; lint only the touched app; no re-reads after Edit.
4. **Fewer agents.** Do lookups inline; spawn an agent only for wide, parallel work.
5. **Cheap shell output.** `rtk` is not installed on this machine (it failed in the last session). Either install it or drop the "always prefix rtk" line from `realwise/CLAUDE.md`; meanwhile pipe through `| head`/`| tail`.
6. **Small context.** Keep `.ai/` docs short and indexed; start new sessions per feature instead of letting one run to compaction.
7. **Batch independent tool calls** in one message.

## B. Elio (app cost per chat turn)

Already in place: light/strong model tiers, `cache_control` in `llm/openrouter.provider.ts`, `HISTORY_LIMIT = 16`, canned replies with no model call.

1. **Measure first.** Log input/output/cached tokens per turn (purpose, tier, user) and add a daily total to the admin panel. Without this, every other item is a guess.
2. **Shrink the system prompt.** `chat.prompt.ts` is ~18 KB sent every turn. Move rarely used rules (installments, transfers, ignore, rules list) into the tool descriptions or load them only when a statement is attached; keep the base prompt to the essentials.
3. **Keep the cached prefix stable.** Verify nothing volatile (date, user rules, balances) sits before the cache breakpoint; put it after, so cache hits are not broken.
4. **Trim history.** Replace old tool results and review payloads in `prior` with one-line summaries; send only the last 4 to 6 messages in full.
5. **Statements.** Pre-parse OFX/CSV in code and send the model only ambiguous rows; for PDFs, extract text first and send the file only if extraction fails; cap rows per call.
6. **More no-model paths.** Greetings, "what did I spend this month", and chip taps answered from the database. Route by cheap rules before calling any model.
7. **Lower `maxTokens`** (16000 now) for the light tier (e.g. 2000); only statement reads need the large limit.
8. **Guardrails.** Per-user daily token cap with a friendly message, and an admin alert when a single turn is over a threshold.

## Suggested order
B1 → A1/A2/A5 (free, immediate) → B2/B3 → B4/B7 → B5/B6 → B8.

## Manual check
After B1 ships, compare tokens per turn before/after each later item in the admin panel.
