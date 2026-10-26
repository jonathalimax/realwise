#!/usr/bin/env python3
"""RealWise unit-economics simulation. Every number below is an assumption: replace with llm_call_log averages."""
SONNET = (3.0, 15.0)    # USD per million tokens (in, out) - apps/api/src/llm/model-pricing.ts
HAIKU = (0.10, 0.50)
BRL_PER_USD = 5.5

# Tokens per action (input, output), summed over the tool-calling rounds. Prompt (accounts/categories/rules) ~3.5k per round.
ACTIONS = {
    "import":     (30_000, 7_600),   # 1 statement ~150 txns: doc + save_transactions + summary round
    "question":   (12_000, 600),     # 2 rounds: query_transactions + answer
    "edit":       (14_000, 800),
    "insights":   (4_000, 800),      # per generation
    "onboarding": (45_000, 3_000),   # ~6 short turns
}
# Which model handles what in the 'hybrid' strategy (Sonnet only for documents / onboarding).
HYBRID_SONNET = {"import", "onboarding"}

# Per-month activity by profile: (imports, questions, edits, insight generations)
PROFILES = {
    "daily":        dict(share=0.15, imports=4, questions=45, edits=10, insights=8),
    "weekly":       dict(share=0.30, imports=3, questions=10, edits=3,  insights=4),
    "twice_month":  dict(share=0.30, imports=2, questions=4,  edits=2,  insights=2),
    "monthly":      dict(share=0.25, imports=1, questions=2,  edits=1,  insights=1),
}
# Trial (3 days): onboarding + 2 imports + a few questions, for users who activate.
TRIAL = dict(onboarding=1, imports=1.5, questions=6, edits=2, insights=2)
TRIAL_ACTIVATION = 0.70      # share of signups that actually use the trial

PRICE_MONTHLY, PRICE_ANNUAL = 8.99, 74.90
ANNUAL_SHARE = 0.30
STRIPE_PCT, STRIPE_FIXED, TAX = 0.0399, 0.39, 0.06
CACHE_INPUT_FACTOR = 0.55    # blended input cost if prompt caching hits (system prompt repeats every round)

def cost(action, model, cache=1.0):
    i, o = ACTIONS[action]
    return (i * cache * model[0] + o * model[1]) / 1e6

def action_cost(action, strategy):
    if strategy == "sonnet":        return cost(action, SONNET)
    if strategy == "hybrid":        return cost(action, SONNET if action in HYBRID_SONNET else HAIKU)
    if strategy == "hybrid+cache":  return cost(action, SONNET if action in HYBRID_SONNET else HAIKU, CACHE_INPUT_FACTOR)

def user_month(p, strategy):
    return (p["imports"] * action_cost("import", strategy) + p["questions"] * action_cost("question", strategy)
            + p["edits"] * action_cost("edit", strategy) + p["insights"] * action_cost("insights", strategy))

def trial_cost(strategy):
    t = TRIAL
    return (t["onboarding"] * action_cost("onboarding", strategy) + t["imports"] * action_cost("import", strategy)
            + t["questions"] * action_cost("question", strategy) + t["edits"] * action_cost("edit", strategy)
            + t["insights"] * action_cost("insights", strategy)) * TRIAL_ACTIVATION

def net_revenue_brl():
    m = PRICE_MONTHLY * (1 - TAX) - (PRICE_MONTHLY * STRIPE_PCT + STRIPE_FIXED)
    a = (PRICE_ANNUAL * (1 - TAX) - (PRICE_ANNUAL * STRIPE_PCT + STRIPE_FIXED)) / 12
    return m * (1 - ANNUAL_SHARE) + a * ANNUAL_SHARE

if __name__ == "__main__":
    net = net_revenue_brl()
    print(f"Net revenue per paying user/month: R$ {net:.2f} (US$ {net/BRL_PER_USD:.2f})\n")
    for s in ("sonnet", "hybrid", "hybrid+cache"):
        print(f"== strategy: {s}")
        for name, p in PROFILES.items():
            c = user_month(p, s)
            print(f"  {name:12} US$ {c:6.2f} /user/month  (R$ {c*BRL_PER_USD:5.2f})")
        avg = sum(p["share"] * user_month(p, s) for p in PROFILES.values())
        tc = trial_cost(s)
        print(f"  avg paying user: US$ {avg:.2f}   trial (activated-weighted): US$ {tc:.2f} per signup")
        for conv in (0.15, 0.30):
            for n in (10, 100, 1000):
                signups = n / conv                    # signups per month needed to keep n paying users (steady state ~ churn ignored)
                trial_total = signups * tc
                ai = n * avg + trial_total
                revenue = n * net / BRL_PER_USD
                print(f"  conv {int(conv*100):2}% | {n:4} paying | AI US$ {n*avg:8.0f} + trials US$ {trial_total:7.0f} = US$ {ai:8.0f}"
                      f" | net rev US$ {revenue:8.0f} | margin US$ {revenue-ai:8.0f} ({(revenue-ai)/revenue*100:5.1f}%)")
        print()

    # Lever: cap AI spend during the trial (enforced by LLM budget for users in 'trial' state; not built yet).
    print("== hybrid+cache with TRIAL cap (US$ per trial user) and paid-user cap US$ 0.60")
    for cap in (0.15, 0.25):
        tc = min(trial_cost("hybrid+cache"), cap * TRIAL_ACTIVATION)
        avg = sum(p["share"] * min(user_month(p, "hybrid+cache"), 0.60) for p in PROFILES.values())
        for conv in (0.15, 0.30):
            n = 1000
            total = n * avg + (n / conv) * tc
            rev = n * net / BRL_PER_USD
            print(f"  cap {cap:.2f} | conv {int(conv*100)}% | 1000 paying: AI US$ {total:6.0f} vs net rev US$ {rev:6.0f} -> margin {(rev-total)/rev*100:5.1f}%")
