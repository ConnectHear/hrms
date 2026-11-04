# AGENTS

Rules for agents working in this repo.

<!-- org:merge-train -->
## Merge train (every repo merges through the shared train)

- **One shared train for every active repo** (`ConnectHear/.github` `tools/merge-train.sh`, pinned by tag and sha256, configured by `.github/train.json`). The train is the only way into a repo's integration branch. It posts the `merge-train` check on each PR it tests, and the integration branch requires that check.
- **A train never runs for one PR.** Label every ready PR `train`, then run the train with no PR numbers (or leave it to a scheduled run). Never pass a PR number.
- **Every run is one full test pass plus one deploy.** That is why one PR alone wastes minutes; batching shares both.
- **One PR alone only when Arhum asks:** `--single-pr <n> --reason "<text>"`. The reason is required.
- **Live branches need a go.** Where the integration branch is live (`needs_go` in `train.json`: SILA, EWAI, ERPNext, ease, hrms and the content repos), run it with `--go "<who/why>"` only after someone asked for the merge. These trains never run on a schedule.
- **Per-PR local CI is optional.** The train's single run on the combined tree is the test pass; run a repo's local CI before a push only when you want the early signal. Batch review fixes into one commit so a PR is not re-tested once per fix.
- **Commands:** Backend `composer ci:train`. npm repos (Customer, Interpreter, Mobile-UI) `npm run ci:train`. pnpm repos (SILA, monorepo, ease) `pnpm ci:train`. Every other repo `bash scripts/merge-train`. All take the same arguments.
- **Never merge a train PR by hand** and never use `--admin`; the train merges with the exact head it tested.
<!-- /org:merge-train -->

<!-- org:data-handling -->
## Data handling (all ConnectHear repos)

- **Never print personal or secret data** in commands, logs, test output, commit messages, PR bodies or chat: customer/interpreter names with contact details, emails, phone numbers, CNICs, card or bank details, passwords, tokens, API keys, `.env` values. Mask them (`a***@gmail.com`, `+92 3** *** **12`, `sk_live_…a1b2`) or count them instead.
- Queries against staging or production data select only the columns the task needs, and aggregate where possible.
- If a secret turns up somewhere it should not be (a log, a repo file, a screenshot), say so and treat it as leaked; do not repeat it, and rotate it.
- **Secrets never enter git.** gitleaks scans every new commit in the repo's git hook and in CI; never commit a file it flags. A finding that is not a secret goes in `.gitleaksignore` with a reason, never as a disabled rule.
<!-- /org:data-handling -->
