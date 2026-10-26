# Costs and scale (simulation)

Reproduce with `python3 scripts/cost-simulation.py`. Every token count and usage share is an **assumption**; replace with averages from `llm_call_log` after ~2 weeks of real traffic.

## Assumptions
- Models: Sonnet 5.5 US$3/15 per M tokens (in/out), Haiku 5.5 US$0.10/0.50 (`llm/model-pricing.ts`, verify against OpenRouter). US$1 = R$5,5.
- Per action (all tool rounds): import ~30k in / 7.6k out; question ~12k / 0.6k; edit ~14k / 0.8k; insights 4k / 0.8k; onboarding 45k / 3k.
- Mix of paying users: 15% daily, 30% weekly, 30% twice a month, 25% monthly.
- Trial (3 days, no card): onboarding + ~1.5 imports + 6 questions; 70% of signups actually use it.
- Price: R$ 8,99/mês, R$ 74,90/ano (30% annual). Net after Stripe (3,99% + R$0,39) and ~6% tax: **R$ 7,07 ≈ US$ 1,28 per paying user/month**.

## AI cost per paying user per month (US$)
| profile | Sonnet for everything | Hybrid (Sonnet only for documents) | Hybrid + prompt cache |
|---|---|---|---|
| daily | 3,57 | 0,91 | 0,71 |
| weekly | 1,32 | 0,64 | 0,51 |
| twice a month | 0,74 | 0,42 | 0,33 |
| monthly | 0,37 | 0,21 | 0,17 |
| **weighted average** | **1,25** | **0,51** | **0,40** |
| trial per signup | 0,64 | 0,35 | 0,26 |

## Monthly totals (AI incl. trials vs net revenue, US$)
Paying users needed signups = paying / conversion. Net revenue: 10 → 13, 100 → 128, 1000 → 1.285.

| strategy | conversion | 10 users | 100 users | 1000 users | margin |
|---|---|---|---|---|---|
| Sonnet for everything | 15% | 55 | 550 | 5.504 | -328% |
| Hybrid | 15% | 28 | 284 | 2.839 | -121% |
| Hybrid + cache | 15% | 21 | 215 | 2.146 | -67% |
| Hybrid + cache | 30% | 13 | 127 | 1.273 | ~0% |
| Hybrid + cache + trial cap US$0,15 + paid cap US$0,60 | 15% / 30% | | | 1.084 / 734 | +16% / +43% |

## Findings
1. **The trial is the biggest cost.** One unconverted signup costs about as much as a full paying month (US$0,26–0,64 vs US$1,28 net revenue). At 15% conversion the trial alone exceeds revenue.
2. **Sonnet for every turn is not viable at R$ 8,99.** Q&A/edits/insights on Haiku and Sonnet only for documents cuts the average user by ~60%.
3. Daily power users are the risk (US$3,57 on all-Sonnet); the per-user monthly budget is what protects the margin.

## Recommended levers (in order)
1. Env now: `LLM_MONTHLY_BUDGET_USD=0.6`, `LLM_MODEL_FALLBACK=anthropic/claude-haiku-5.5` (default budget is US$5/user, which loses money on every heavy user).
2. Trial AI cap of ~US$0,15–0,25 per user (budget by access state) — not built.
3. Route plain Q&A/insights to Haiku, keep Sonnet for documents/onboarding — not built.
4. Enable prompt caching for the system prompt (resent every tool round) — not built.
5. Reminder emails to lift trial→paid conversion (built, `engagement-reminders`).

## Scalability (1.000 users at the same time)
Findings from the code:
- **Database pool**: `postgres(DATABASE_URL)` uses the default max of 10 connections. Hundreds of concurrent chat turns (each loads context, writes `llm_call_log`, saves transactions) will queue on it. Raise `max` to ~20–30 and check Postgres `max_connections`.
- **No rate limiting or LLM concurrency limit** anywhere. 1.000 simultaneous imports ≈ 30M input tokens in a minute, far above default Anthropic/OpenRouter per-minute limits; users would see the "temporarily unavailable" error. Needs a global semaphore (e.g. 20–40 in-flight LLM calls) with a short queue, plus one in-flight turn per user, plus a friendly "fila" message.
- **SSE streams** each hold a connection for 10–60 s. Node handles thousands, but the Coolify container's CPU/memory and the reverse proxy timeouts are the limits; one container is a single point of failure.
- **Crons run in every replica**: bill reminders have no cross-replica lock. Engagement reminders are safe (unique-index claim before sending); bill reminders would double-send if the API is scaled to 2+ containers.
- **Realistic peak**: with the mix above ~150 of 1.000 users are daily; a 9 AM peak is ~15–30 concurrent turns, which the current setup survives. A true 1.000-at-once spike (e.g. a launch email) does not.
- Resend: sends are sequential in a loop; fine for 1.000 recipients/day.
