# Costs and scale (simulation)

Reproduce with `python3 scripts/cost-simulation.py`. Every token count and usage share is an **assumption**; replace with averages from `llm_call_log` after ~2 weeks of real traffic.

## Assumptions
- Prices are the OpenRouter list prices (US$ per M tokens in/out), checked 2026-10-27: Sonnet 5.5 **2/10** (earlier drafts used 3/15, which overstated cost by a third), Haiku 5.5 0.10/0.50, gpt-5.4-mini 0.75/4.5, gemini-3.7-flash 0.75/3.75, gemini-3.5-flash-lite 0.30/2.5. US$1 = R$5,5.
- Per action (all tool rounds): import ~30k in / 7.6k out; question ~12k / 0.6k; edit ~14k / 0.8k; insights 4k / 0.8k; onboarding 45k / 3k.
- Mix of paying users: 15% daily, 30% weekly, 30% twice a month, 25% monthly.
- Trial (3 days, no card): onboarding + ~1.5 imports + 6 questions; 70% of signups actually use it.
- Price: R$ 8,99/mês, R$ 74,90/ano (30% annual). Net after Stripe (3,99% + R$0,39) and ~6% tax: **R$ 7,07 ≈ US$ 1,28 per paying user/month**.
- Prompt caching is modelled as a blended 0.55x on input; for non-Anthropic models that assumes implicit caching works (unverified).

## AI cost per paying user per month (US$)
| profile | Sonnet for everything | Hybrid (Sonnet only for documents) | Hybrid + prompt cache |
|---|---|---|---|
| daily | 2,38 | 0,64 | 0,50 |
| weekly | 0,88 | 0,43 | 0,34 |
| twice a month | 0,50 | 0,28 | 0,23 |
| monthly | 0,25 | 0,14 | 0,11 |
| **weighted average** | **0,83** | **0,35** | **0,27** |
| trial per signup | 0,43 | 0,24 | 0,18 |

## Monthly totals at 1000 paying users (AI incl. trials vs net revenue US$ 1.285)
| strategy | 15% conversion | 30% conversion |
|---|---|---|
| Sonnet for everything | 3.669 (-186%) | 2.251 (-75%) |
| Hybrid (current build: Sonnet docs, Haiku rest) | 1.923 (-50%) | 1.134 (+12%) |
| Hybrid + cache (current build) | 1.451 (-13%) | 862 (+33%) |
| + trial cap US$0,15 and paid cap US$0,60 | 973 (+24%) | 623 (+52%) |

Scaling to 10 / 100 users is linear (net revenue US$ 13 / 128; Hybrid + cache at 30% conversion: AI US$ 9 / 86).

## Swapping the document model (hybrid + cache, margin at 1000 users)
| document model | avg paying user | 15% conv. | 30% conv. | quality verified? |
|---|---|---|---|---|
| sonnet-5.5 (current) | 0,27 | -13% | +33% | yes (in use) |
| gpt-5.4-mini | 0,13 | +50% | +70% | **no** |
| gemini-3.7-flash | 0,11 | +55% | +73% | **no** |
| gemini-3.5-flash-lite | 0,07 | +73% | +83% | **no** |

Switching the document model is the biggest single lever, but price says nothing about extraction accuracy on Brazilian statements. Test on real PDFs (scanned, credit card, multi-page) by setting `LLM_MODEL_CHAT` on staging before changing prod. Prices for these models are already in `model-pricing.ts`, so the budget guard keeps working.

## Findings
1. **The trial is still the biggest cost** on Sonnet: US$0,18–0,43 per signup against US$1,28 monthly net revenue.
2. Sonnet for every turn is not viable at R$ 8,99; the hybrid routing is the minimum.
3. Daily power users are the risk; the per-user monthly budget protects the margin.

## Recommended levers (in order)
1. Env now: `LLM_MONTHLY_BUDGET_USD=0.6`, `LLM_MODEL_FALLBACK=anthropic/claude-haiku-5.5` (default budget is US$5/user, which loses money on every heavy user).
2. Trial AI cap of ~US$0,15–0,25 per user (budget by access state) — not built.
3. Route plain Q&A/insights to Haiku, Sonnet for turns with attached documents — **built** (`tier` on `LlmRequest`; env `LLM_MODEL_CHAT` strong, `LLM_MODEL_CHAT_LIGHT`, `LLM_MODEL_INSIGHTS`).
4. Prompt caching (Anthropic `cache_control` on the system prompt and last user message; cache reads/writes priced in the budget guard) — **built**; disable with `LLM_PROMPT_CACHE=off`. Check `llm_call_log` cost per turn after deploy to confirm cache hits.
5. Reminder emails to lift trial→paid conversion (built, `engagement-reminders`).

## Scalability (1.000 users at the same time)
Findings from the code:
- **Database pool**: `postgres(DATABASE_URL)` uses the default max of 10 connections. Hundreds of concurrent chat turns (each loads context, writes `llm_call_log`, saves transactions) will queue on it. Raise `max` to ~20–30 and check Postgres `max_connections`.
- **No rate limiting or LLM concurrency limit** anywhere. 1.000 simultaneous imports ≈ 30M input tokens in a minute, far above default Anthropic/OpenRouter per-minute limits; users would see the "temporarily unavailable" error. Needs a global semaphore (e.g. 20–40 in-flight LLM calls) with a short queue, plus one in-flight turn per user, plus a friendly "fila" message.
- **SSE streams** each hold a connection for 10–60 s. Node handles thousands, but the Coolify container's CPU/memory and the reverse proxy timeouts are the limits; one container is a single point of failure.
- **Crons run in every replica**: bill reminders have no cross-replica lock. Engagement reminders are safe (unique-index claim before sending); bill reminders would double-send if the API is scaled to 2+ containers.
- **Realistic peak**: with the mix above ~150 of 1.000 users are daily; a 9 AM peak is ~15–30 concurrent turns, which the current setup survives. A true 1.000-at-once spike (e.g. a launch email) does not.
- Resend: sends are sequential in a loop; fine for 1.000 recipients/day.
