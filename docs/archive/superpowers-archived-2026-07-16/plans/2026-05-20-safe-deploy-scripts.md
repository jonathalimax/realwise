# Safe Deploy Scripts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ad-hoc `firebase deploy` commands with guarded npm scripts that always target the right site/env and require explicit confirmation before touching production.

**Architecture:** A single bash script `scripts/deploy.sh` receives `<env> <target>` arguments, prints a colored summary box, prompts for `y` confirmation, then orchestrates build + Firebase deploy in the correct order. Seven npm scripts in `package.json` are the only entry points engineers need to remember.

**Tech Stack:** Bash, Firebase CLI (`firebase` must be in PATH), npm scripts

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `scripts/deploy.sh` | Create | Guard script — announce, confirm, build, deploy |
| `package.json` | Modify | Add 7 deploy npm scripts |

---

### Task 1: Create the guard script skeleton

**Files:**
- Create: `scripts/deploy.sh`

- [ ] **Step 1: Create `scripts/` directory and the script file**

```bash
mkdir -p scripts
touch scripts/deploy.sh
chmod +x scripts/deploy.sh
```

- [ ] **Step 2: Write the script skeleton with argument validation**

Write the full contents of `scripts/deploy.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# ── Arguments ────────────────────────────────────────────────────────────────
ENV="${1:-}"      # prod | dev
TARGET="${2:-}"   # all | hosting | functions | redirect

if [[ -z "$ENV" || -z "$TARGET" ]]; then
  echo "Usage: deploy.sh <env> <target>"
  echo "  env:    prod | dev"
  echo "  target: all | hosting | functions | redirect"
  exit 1
fi

if [[ "$ENV" != "prod" && "$ENV" != "dev" ]]; then
  echo "❌  Unknown env: $ENV (must be prod or dev)"
  exit 1
fi

if [[ "$TARGET" != "all" && "$TARGET" != "hosting" && "$TARGET" != "functions" && "$TARGET" != "redirect" ]]; then
  echo "❌  Unknown target: $TARGET (must be all | hosting | functions | redirect)"
  exit 1
fi

if [[ "$TARGET" == "redirect" && "$ENV" != "prod" ]]; then
  echo "❌  redirect target only makes sense for prod"
  exit 1
fi

echo "✅  Args valid: env=$ENV target=$TARGET"
```

- [ ] **Step 3: Verify the script runs and validates args**

```bash
bash scripts/deploy.sh
# Expected: Usage: deploy.sh <env> <target>

bash scripts/deploy.sh prod all
# Expected: ✅  Args valid: env=prod target=all

bash scripts/deploy.sh prod bad
# Expected: ❌  Unknown target: bad (must be all | hosting | functions | redirect)
```

- [ ] **Step 4: Commit**

```bash
git add scripts/deploy.sh
git commit -m "feat: add deploy.sh skeleton with argument validation"
```

---

### Task 2: Add the colored confirmation UI

**Files:**
- Modify: `scripts/deploy.sh`

- [ ] **Step 1: Add color variables and the summary box function**

Replace the contents of `scripts/deploy.sh` with the full version below. Add after the argument validation block (before the final `echo "✅ Args valid"` line — remove that line):

```bash
#!/usr/bin/env bash
set -euo pipefail

# ── Arguments ────────────────────────────────────────────────────────────────
ENV="${1:-}"
TARGET="${2:-}"

if [[ -z "$ENV" || -z "$TARGET" ]]; then
  echo "Usage: deploy.sh <env> <target>"
  echo "  env:    prod | dev"
  echo "  target: all | hosting | functions | redirect"
  exit 1
fi

if [[ "$ENV" != "prod" && "$ENV" != "dev" ]]; then
  echo "❌  Unknown env: $ENV (must be prod or dev)"
  exit 1
fi

if [[ "$TARGET" != "all" && "$TARGET" != "hosting" && "$TARGET" != "functions" && "$TARGET" != "redirect" ]]; then
  echo "❌  Unknown target: $TARGET (must be all | hosting | functions | redirect)"
  exit 1
fi

if [[ "$TARGET" == "redirect" && "$ENV" != "prod" ]]; then
  echo "❌  redirect target only makes sense for prod"
  exit 1
fi

# ── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'

# ── Build summary lines ───────────────────────────────────────────────────────
LINES=()

if [[ "$ENV" == "prod" ]]; then
  ICON="🔴"
  LABEL="${RED}${BOLD}DEPLOYING TO PRODUCTION${RESET}"
else
  ICON="🟢"
  LABEL="${GREEN}${BOLD}DEPLOYING TO DEV${RESET}"
fi

needs_build=false
if [[ "$TARGET" == "all" || "$TARGET" == "hosting" ]]; then
  needs_build=true
  LINES+=("  Build:     npm run build")
fi

if [[ "$TARGET" == "all" || "$TARGET" == "hosting" ]]; then
  if [[ "$ENV" == "prod" ]]; then
    LINES+=("  Hosting:   mymoneywise (realwise.com.br)")
    LINES+=("  Rules:     firestore.rules")
  else
    LINES+=("  Hosting:   realwise-dev")
  fi
fi

if [[ "$TARGET" == "all" || "$TARGET" == "functions" ]]; then
  if [[ "$ENV" == "prod" ]]; then
    LINES+=("  Functions: moneywise-ad9ec (prod)")
  else
    LINES+=("  Functions: realwise-dev (dev)")
  fi
fi

if [[ "$TARGET" == "redirect" ]]; then
  needs_build=false
  LINES+=("  Hosting:   realwise-redirect (short URL domain)")
fi

# ── Print box ────────────────────────────────────────────────────────────────
echo ""
echo -e "╔══════════════════════════════════════╗"
echo -e "║  $ICON  $LABEL"
echo -e "╠══════════════════════════════════════╣"
for line in "${LINES[@]}"; do
  echo -e "║ $line"
done
echo -e "╚══════════════════════════════════════╝"
echo ""

# ── Dirty tree warning (prod only) ───────────────────────────────────────────
if [[ "$ENV" == "prod" ]]; then
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo -e "${YELLOW}⚠️  Warning: you have uncommitted changes. Proceeding anyway.${RESET}"
    echo ""
  fi
fi

# ── Confirm ──────────────────────────────────────────────────────────────────
read -r -p 'Type "y" to continue, anything else aborts: ' answer
if [[ "$answer" != "y" ]]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "Placeholder: would deploy here"
```

- [ ] **Step 2: Test the UI visually**

```bash
bash scripts/deploy.sh prod all
# Expected: red box showing Build + Hosting (mymoneywise) + Rules + Functions (moneywise-ad9ec)
# Prompt appears; type anything other than y → "Aborted."

bash scripts/deploy.sh dev hosting
# Expected: green box showing Build + Hosting (realwise-dev)

bash scripts/deploy.sh prod redirect
# Expected: red box showing Hosting: realwise-redirect only (no build line)
```

- [ ] **Step 3: Commit**

```bash
git add scripts/deploy.sh
git commit -m "feat: deploy.sh confirmation UI with colored summary box"
```

---

### Task 3: Add build + Firebase deploy execution

**Files:**
- Modify: `scripts/deploy.sh`

- [ ] **Step 1: Replace the placeholder at the bottom with real execution logic**

Remove the line `echo "Placeholder: would deploy here"` and add the full execution block:

```bash
# ── Build ────────────────────────────────────────────────────────────────────
if [[ "$needs_build" == true ]]; then
  echo "📦  Building..."
  npm run build
  echo ""
fi

# ── Deploy ───────────────────────────────────────────────────────────────────
if [[ "$TARGET" == "all" || "$TARGET" == "hosting" ]]; then
  if [[ "$ENV" == "prod" ]]; then
    echo "🚀  Deploying hosting + rules to prod..."
    firebase deploy --only hosting:mymoneywise,firestore:rules
  else
    echo "🚀  Deploying hosting to dev..."
    firebase deploy --only hosting:realwise-dev --project realwise-dev
  fi
  echo ""
fi

if [[ "$TARGET" == "all" || "$TARGET" == "functions" ]]; then
  if [[ "$ENV" == "prod" ]]; then
    echo "⚡  Deploying functions to prod..."
    firebase deploy --only functions
  else
    echo "⚡  Deploying functions to dev..."
    firebase deploy --only functions --project realwise-dev
  fi
  echo ""
fi

if [[ "$TARGET" == "redirect" ]]; then
  echo "🔀  Deploying redirect site..."
  firebase deploy --only hosting:realwise-redirect
  echo ""
fi

echo "✅  Deploy complete."
```

- [ ] **Step 2: Dry-run test (abort before Firebase is called)**

```bash
bash scripts/deploy.sh prod hosting
# Type anything other than y → "Aborted." — Firebase never called

bash scripts/deploy.sh dev functions
# Type anything other than y → "Aborted."
```

- [ ] **Step 3: Commit**

```bash
git add scripts/deploy.sh
git commit -m "feat: deploy.sh — wire build and firebase deploy execution"
```

---

### Task 4: Add npm scripts to package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Open `package.json` and add the 7 deploy scripts to the `"scripts"` block**

Add these entries (keep all existing scripts, just add these):

```json
"deploy:prod": "bash scripts/deploy.sh prod all",
"deploy:dev": "bash scripts/deploy.sh dev all",
"deploy:hosting:prod": "bash scripts/deploy.sh prod hosting",
"deploy:hosting:dev": "bash scripts/deploy.sh dev hosting",
"deploy:functions:prod": "bash scripts/deploy.sh prod functions",
"deploy:functions:dev": "bash scripts/deploy.sh dev functions",
"deploy:redirect": "bash scripts/deploy.sh prod redirect"
```

- [ ] **Step 2: Verify all scripts are listed**

```bash
npm run | grep deploy
# Expected output (7 lines):
#   deploy:dev
#   deploy:functions:dev
#   deploy:functions:prod
#   deploy:hosting:dev
#   deploy:hosting:prod
#   deploy:prod
#   deploy:redirect
```

- [ ] **Step 3: Smoke test one script end-to-end (abort at confirmation)**

```bash
npm run deploy:hosting:prod
# Expected: green/red box appears, prompt shown, type "n" → "Aborted." — no Firebase called
```

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "feat: add deploy npm scripts (prod/dev/hosting/functions/redirect)"
```

---

### Task 5: Push and verify

- [ ] **Step 1: Push**

```bash
git push origin main
```

- [ ] **Step 2: Verify the full deploy:hosting:prod flow works end-to-end**

```bash
npm run deploy:hosting:prod
# Walk through: box appears, type y, build runs, firebase deploys hosting:mymoneywise + firestore:rules
# Expected final line: ✅  Deploy complete.
```

- [ ] **Step 3: Verify deploy:functions:dev works**

```bash
npm run deploy:functions:dev
# Box appears (green), type y, firebase deploys functions to realwise-dev project
# Expected final line: ✅  Deploy complete.
```
