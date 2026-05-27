# How to run your app audit (plain-language guide)

This checks your web app like a strict reviewer would before launch — how it looks, how it
feels, and whether everything works — and gives you a **web-page report with screenshots**.
You do **not** need to be technical. You answer a couple of questions, then walk away.

---

## What you do (3 things)

1. **Put `run-audit.sh` in your project folder** (the folder that has your app's code).

2. **Open a terminal in that folder and run these two lines** (copy–paste):
   ```bash
   chmod +x run-audit.sh
   ./run-audit.sh
   ```
   (The first line is only needed once, ever. After that, just `./run-audit.sh`.)

3. **Answer the few questions it asks**, then leave it. For example:
   - *"Local web address of your app?"* — if you know it (like `http://localhost:3000`), type it.
     If not, just press **Enter** and Claude will start your app and find it.
   - *"Does your app need a login?"* — type **y** or **n**.
   - If yes, it asks for a **test login**. Use a staging/test account, not a real personal one.
     The password is hidden as you type and is **never saved to a file**.

That's it. A browser window may open and click around by itself — that's normal. When it's
done, your report **opens automatically in your browser**.

---

## What you get

- **`AUDIT_REPORT.html`** — a clean web page. Open it any time by double-clicking it.
  - Top: an overall "is it ready?" verdict and a count of issues by seriousness.
  - Then: what's working, polish suggestions, real bugs (with screenshots), performance,
    security/config, and a prioritized to-do list.
- **`audit-screenshots/`** — the pictures the report uses. Keep this folder next to the report.
- **`audit-run.log`** — a behind-the-scenes log, in case something needs checking.

Colour key in the report: **Critical** (must fix before launch) · **High** (major problem) ·
**Medium** (noticeable, has a workaround) · **Low** (small visual glitch) · **Polish** (nice-to-have).

---

## It's safe — nothing is permanent

- Before starting, the script makes a **restore point**. If you ever want to undo *everything*
  the audit did, the script prints a line like:
  ```
  git reset --hard <id>
  ```
  Run that (or paste it to Claude Code and say "undo the audit") and you're back to before.
- The audit is **look-but-don't-touch**: it's instructed not to change your app's code — it only
  writes the report and screenshots.

---

## Handing the results to Claude Code to fix things

When you've read the report and decided what you want fixed, you don't have to do it yourself.
Open Claude Code in the same folder and say, in your own words, e.g.:

> "Read AUDIT_REPORT.html and fix all the Critical and High issues. Show me each change before
> moving on."

You stay in charge of the decisions; Claude does the hands-on work.

---

## If something goes wrong

- **"Node.js isn't installed"** → install it from https://nodejs.org, then re-run.
- **"Claude Code isn't installed"** → see https://docs.claude.com/en/docs/claude-code/overview
- **"This folder isn't a git project"** → make sure you opened your actual project folder.
- **Report didn't appear** → open `audit-run.log` (or paste it to Claude Code and ask what
  happened), then just run `./run-audit.sh` again.

---

## One safety habit

Use a **staging/test login**, never a real personal account, for the audit. If the test
password is reused anywhere real, change it. The script keeps your password in memory only for
the single run and never writes it to disk.
