#!/usr/bin/env bash
#
# run-audit.sh — One-command production-readiness audit for ANY web app / SaaS portal.
#
# What it does, with no further input from you after a few plain questions:
#   1. Makes a git "restore point" so everything is undoable.
#   2. Sets up the browser-automation tool (Playwright) for Claude Code.
#   3. Asks you (in plain language) for the app address + login, if needed.
#   4. Runs a full UI/UX + look-and-feel + functionality audit, fully automatically.
#   5. Produces AUDIT_REPORT.html — a web page with screenshots — and opens it for you.
#
# HOW TO RUN (from inside your project folder):
#   chmod +x run-audit.sh        # one time only
#   ./run-audit.sh
#
# Do NOT run with sudo. You don't need to be technical to use this.

set -euo pipefail

BOLD=$(tput bold 2>/dev/null || true); DIM=$(tput dim 2>/dev/null || true); RESET=$(tput sgr0 2>/dev/null || true)
say()  { printf "\n%s==> %s%s\n" "$BOLD" "$1" "$RESET"; }
warn() { printf "%s!! %s%s\n" "$BOLD" "$1" "$RESET"; }
ask()  { local p="$1" v; read -rp "    $p " v; printf '%s' "$v"; }

open_report() {
  local f="$1"
  if   command -v xdg-open     >/dev/null 2>&1; then xdg-open "$f"   >/dev/null 2>&1 &
  elif command -v open         >/dev/null 2>&1; then open "$f"       >/dev/null 2>&1 &
  elif command -v explorer.exe >/dev/null 2>&1; then explorer.exe "$(wslpath -w "$f" 2>/dev/null || echo "$f")" >/dev/null 2>&1 &
  else echo "    (Open this file in your browser: $f)"; fi
}

# -- 0. Safety: never as root -------------------------------------------------
[ "$(id -u)" -ne 0 ] || { echo "X Please don't run this with sudo / as root. Just: ./run-audit.sh"; exit 1; }

# -- 1. Prerequisites ---------------------------------------------------------
say "Checking what's installed"
command -v node   >/dev/null 2>&1 || { echo "X Node.js isn't installed. Install Node 18+ from https://nodejs.org then re-run."; exit 1; }
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
[ "$NODE_MAJOR" -ge 18 ] || { echo "X Node 18+ needed (you have $(node --version)). Update from https://nodejs.org"; exit 1; }
command -v claude >/dev/null 2>&1 || { echo "X Claude Code isn't installed. See https://docs.claude.com/en/docs/claude-code/overview"; exit 1; }
command -v git    >/dev/null 2>&1 || { echo "X git isn't installed. Install it, then re-run."; exit 1; }
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "X This folder isn't a git project. Open your project folder and re-run."; exit 1; }
echo "OK  Node $(node --version), Claude Code, and git are all ready."

# -- 2. Safety restore point (so the audit is fully undoable) -----------------
say "Creating a safety restore point"
git add -A >/dev/null 2>&1 || true
git commit -m "Safety checkpoint before audit — $(date '+%Y-%m-%d %H:%M')" --no-verify >/dev/null 2>&1 || true
CHECKPOINT=$(git rev-parse HEAD)
echo "OK  Restore point saved (id: ${CHECKPOINT:0:8})."
echo "    If you ever want to undo everything from this audit, you (or Claude) can run:"
echo "        git reset --hard $CHECKPOINT"

# -- 3. Browser automation for Claude Code (auto-loads, no manual step) -------
say "Setting up the browser tool (Playwright)"
if [ ! -f .mcp.json ] || ! grep -q '"playwright"' .mcp.json 2>/dev/null; then
  [ -f .mcp.json ] && cp .mcp.json ".mcp.json.bak.$(date +%s)"
  cat > .mcp.json <<'JSON'
{ "mcpServers": { "playwright": { "command": "npx", "args": ["@playwright/mcp@latest"] } } }
JSON
fi
npx --yes playwright install >/dev/null 2>&1 || npx --yes playwright install
echo "OK  Browser tool ready (Claude can now open and click through your app)."

# -- 4. A few plain questions, then it's hands-off ----------------------------
say "A few quick questions (then you can walk away)"
APP_URL=$(ask "Local web address of your app, e.g. http://localhost:3000 (or press Enter to let Claude start it and find it):")
NEEDS_LOGIN=$(ask "Does your app need a login to reach the main features? (y/n):")
LOGIN_URL=""; export TEST_USER_EMAIL="${TEST_USER_EMAIL:-}"; export TEST_USER_PASSWORD="${TEST_USER_PASSWORD:-}"
if [[ "${NEEDS_LOGIN,,}" == y* ]]; then
  LOGIN_URL=$(ask "Login page address (or press Enter to let Claude find it):")
  [ -n "$TEST_USER_EMAIL" ] || TEST_USER_EMAIL=$(ask "Test login email (use a STAGING/test account, never a real personal one):")
  if [ -z "$TEST_USER_PASSWORD" ]; then read -rsp "    Test login password (hidden as you type): " TEST_USER_PASSWORD; echo; fi
fi
export APP_URL LOGIN_URL NEEDS_LOGIN TEST_USER_EMAIL TEST_USER_PASSWORD
echo "OK  Got it. Credentials stay in memory for this run only — never saved to a file."

# -- 5. The audit instructions (generic; works on any web app) ----------------
read -r -d '' PROMPT <<'PROMPT' || true
You are running a FINAL PRE-RELEASE production-readiness audit of THIS web application, as if it were a
premium, paying-customer SaaS product. Run completely autonomously from start to finish — never pause to
ask. When finished, print: "===== AUDIT COMPLETE — open AUDIT_REPORT.html =====".

READ-ONLY RULE (critical): Investigate and test only. Do NOT modify, delete, commit, push, or rm any
existing source/app files. The ONLY files you may create or write are: AUDIT_REPORT.html, screenshots
under ./audit-screenshots/, and (optionally) ./audit-auth.json. Treat everything else as untouchable.

ENVIRONMENT (from env vars, may be empty):
- APP_URL: where the app runs. If empty, detect the stack from the repo (package.json etc.), start the
  dev server yourself, and discover the URL. Use playwright mcp for all browser actions — say
  "use playwright mcp" before browser steps so you don't fall back to bash.
- NEEDS_LOGIN: "y" if the app requires login. LOGIN_URL: the login page (find it yourself if empty).
- TEST_USER_EMAIL / TEST_USER_PASSWORD: the staging test account. Refer to it everywhere as [TEST_USER].
  NEVER print, log, or write these credentials anywhere, including the report.

STEP 1 — LOG IN ONCE (if NEEDS_LOGIN is "y"): open the login page, log in as [TEST_USER] using the env
credentials (find the email/password/submit fields from the page's accessibility tree), confirm you are
logged in, and KEEP THE SAME BROWSER SESSION for the entire audit so you never re-log-in. If login fails,
record it as a Critical defect and continue auditing whatever public pages you can reach.

STEP 2 — DISCOVER & WALK THE APP: map the real pages and primary user journeys yourself (e.g. landing/
home, sign-up/onboarding, login, dashboard, the main feature workflows, forms, settings, logout). You do
NOT have a fixed feature list — explore and test what actually exists.

WHAT TO CHECK:
- UI/UX & look-and-feel at THREE screen sizes — mobile (<768px), tablet (768-1024px), desktop (>1024px):
  layout consistency, spacing, typography hierarchy, color contrast (WCAG 2.1 AA), visual polish/brand
  consistency, and all interactive + edge states (hover, focus, active, disabled, loading, empty, error,
  skeleton, offline).
- Functionality: every core journey end-to-end; forms (validation, submission, error recovery, success
  feedback); data flow (saves persist, lists load, navigation works); broken links / 404s / dead-ends;
  edge cases (invalid input, slow network, session expiry, double-submit) where feasible.
- Stability / performance / accessibility / SEO: console errors and unhandled errors during flows; Core
  Web Vitals where measurable (LCP, INP, CLS); keyboard navigation; ARIA labels and landmarks; basic SEO
  (page titles, meta description, headings).

SCREENSHOTS: with playwright mcp, capture a screenshot at each screen size during the visual pass and at
each key step of each journey. Save to ./audit-screenshots/ with clear names (e.g. dashboard_mobile.png,
signup_error-state.png). You will embed these in the report.

DELIVERABLE — AUDIT_REPORT.html: produce ONE self-contained, polished HTML page that a NON-TECHNICAL
reader can understand at a glance AND a developer can act on. It must:
- Open correctly in a browser by double-clicking it, sitting next to the ./audit-screenshots/ folder
  (reference images with relative paths like ./audit-screenshots/dashboard_mobile.png).
- Start with an executive summary: an overall readiness verdict, and counts of issues by severity.
- Use this severity scale, colour-coded: Critical (blocks release / data loss / security), High (major
  break), Medium (noticeable bug, workaround exists), Low (minor visual glitch), Polish (nice-to-have).
- Group findings into clear sections: What's Working / Polish Suggestions / Defects (with repro steps,
  expected vs actual, and the file/route if known) / Performance & Stability / Security & Config /
  Prioritized Next Actions (task, effort S-M-L, is-it-a-blocker).
- Show the relevant screenshot inline next to each visual finding so it can be verified by eye.
- Be clean and readable — short plain-English summaries up top, technical detail below each item.

Finish by printing the completion banner above.
PROMPT

# -- 6. Run it, fully automatically -------------------------------------------
say "Running the audit now — this can take a while. You can walk away."
echo "    A browser window may open and click around on its own. That's expected."
LOG="audit-run.log"
claude -p "$PROMPT" --dangerously-skip-permissions 2>&1 | tee "$LOG" || true

# -- 7. Done — open the report ------------------------------------------------
say "Audit finished"
if [ -f AUDIT_REPORT.html ]; then
  echo "OK  Your report is ready. Opening it in your browser..."
  open_report "$(pwd)/AUDIT_REPORT.html"
  echo "    Report:      AUDIT_REPORT.html"
  echo "    Screenshots: ./audit-screenshots/"
  echo "    Full log:    $LOG"
else
  warn "The report file wasn't found. Check $LOG for what happened, or just re-run ./run-audit.sh"
fi
echo
echo "    Safety note: to undo any changes from this audit ->  git reset --hard $CHECKPOINT"
echo "    If your test password is reused on any real account, change it now."
