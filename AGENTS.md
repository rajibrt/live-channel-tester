# WEBTVBD Agent Handoff and Work Ledger

Last updated: 2026-08-04 (Asia/Dhaka)

## Mandatory start procedure

Every agent working in this repository must read this file before inspecting, editing, testing, committing, deploying, or advising the user.

At the beginning of a task:

1. Run `git status --short`, `git branch --show-current`, and `git log -8 --oneline`.
2. Treat all existing modified and untracked files as user-owned work. Do not discard, overwrite, reformat, or include them in a commit unless the current request clearly includes them.
3. Read the current handoff and pending work below. Verify time-sensitive external status instead of assuming this document is still current.
4. Work primarily in `vercel/` for the production Next.js website. The repository root also contains older Python/local-agent and Firebase tooling.
5. Before finishing any material task, update the current handoff if its state changed and append an entry to the Work ledger. Record facts, commands/checks, commit/deployment status, and remaining work. Never include passwords, tokens, cookies, private keys, or full environment-variable values.

## Repository and deployment

- Production site: `https://webtvbd.com`
- Canonical host: non-www `https://webtvbd.com`; HTTP and `www` permanently redirect to it.
- Production web application: Next.js app in `vercel/`.
- Deployment: Dokploy builds the `master` branch.
- Current local branch: `agent/improve-public-site-experience`.
- Current public-site commit: `3f6ad16` (`Improve public site navigation and article experience`).
- `origin/master` was verified at `3f6ad167dda6a5c85eb19f7995d9cc0fb83a4289` on 2026-08-04, so Dokploy can deploy the current public-site release.
- Do not assume pushing only an agent/feature branch deploys production. Verify the exact remote branch and commit used by Dokploy.

Useful checks:

```bash
cd vercel
npm run audit:public
curl -I https://webtvbd.com/
curl -I https://webtvbd.com/sitemap.xml
curl https://webtvbd.com/ads.txt
curl https://webtvbd.com/robots.txt
```

## Current external handoff

### Google AdSense

- Publisher ID: `pub-3010934061489506` / client ID `ca-pub-3010934061489506`.
- Site ownership is verified in AdSense.
- The earlier rejection reason was `Low value content`.
- The user submitted a new review request on 2026-08-04.
- Latest user-provided AdSense screen shows `Getting ready` and a green `Review requested` confirmation.
- Do not delete and re-add the site or submit another review while this review is active.
- AdSense says review normally takes a few days and can take 2-4 weeks. Monitor the AdSense Sites page, Policy Center, notifications, and the associated email account.
- No visible ads before approval is expected. The repository currently has the AdSense loader but no manual `<ins class="adsbygoogle">` ad slot. After approval, enable Auto ads in AdSense or create manual ad units and add the supplied slot IDs deliberately.
- The AdSense loader is currently gated by the site's local consent choice on monetizable public routes. Verify the Google-certified CMP/European regulations message in AdSense `Privacy & messaging`; the local banner alone must not be assumed to satisfy Google's certified-CMP requirements.
- Live `ads.txt` was verified as HTTP 200 with this exact record:

```text
google.com, pub-3010934061489506, DIRECT, f08c47fec0942fa0
```

- The latest AdSense dashboard recognition state for `ads.txt` is not confirmed in this document. Check whether it has changed to `Authorized` before making claims about it.

### Google Search Console

- Correct property: Domain property `webtvbd.com`, not the old URL-prefix property `https://www.webtvbd.com/`.
- Canonical sitemap: `https://webtvbd.com/sitemap.xml`.
- Latest user-provided screen on 2026-08-04 shows `Sitemap processed successfully`, last read `8/4/26`, and `34` discovered pages.
- Do not delete or repeatedly resubmit the working sitemap.
- `Discovered` does not mean every URL is indexed. Next checks belong in Page Indexing and URL Inspection for the homepage, `/articles`, and representative new articles.
- Old Google results may temporarily show legacy slugs or old `www` content until recrawling completes. Existing permanent redirects and canonicals should remain stable.

## Public-site release completed on 2026-08-03 and 2026-08-04

The current release includes:

- Rewritten and expanded editorial content intended to address the previous low-value-content rejection.
- 22 live article URLs in the sitemap at the time of the last audit.
- Article content measured at approximately 491-832 visible words, averaging about 636 words across the 22 live articles.
- Editorial images on all audited articles, Article JSON-LD, titles, descriptions, canonical URLs, authorship/update information, headings, and external reference links.
- Editorial Policy, Editorial Team, Corrections Policy, Advertising Disclosure, About, Contact, Privacy, Cookie, Terms, and DMCA pages.
- Root homepage at `/`; `/home` is not the canonical root.
- Nine latest article cards on the homepage and an all-articles navigation action.
- Rotating image-based homepage hero.
- Mobile slide-out navigation drawer with site design tokens, logo/navigation/social/footer treatment.
- Article share actions for common networks and copy-link.
- Route-change scroll restoration so internal links open at the top of the next page.
- Article pagination, loading skeletons, and image/performance refinements.
- Siyam Rupali Bengali font loaded through the Maateen CDN.

Relevant commits, oldest to newest:

- `6584ac8` Improve public editorial quality for AdSense review
- `989923d` Refine article metadata and image delivery
- `327faa7` Expand evergreen editorial authority
- `f9139b5` Add Google submission readiness audit
- `a4b682c` Add rotating latest-article homepage hero
- `343bcb2` Flatten homepage hero content overlay
- `3f6ad16` Improve public site navigation and article experience

## Last verified audit

On 2026-08-04, from `vercel/`, `npm run audit:public` reported:

```text
Public-site audit: https://webtvbd.com
Sitemap URLs: 34
Article URLs: 22
Legacy redirects: 5
Warnings: 0
Failures: 0
```

The audit checks live robots.txt, sitemap, ads.txt, HTTP status, redirects, titles, descriptions, canonicals, H1 counts, noindex directives, Article JSON-LD, editorial images, external links, duplicate metadata, legacy redirects, and canonical www redirection. Re-run it before any future AdSense-readiness claim because production and dashboard state can change.

## Pending and next work

1. Monitor the active AdSense review; do not resubmit while status is `Getting ready`.
2. Verify the AdSense `ads.txt` dashboard state becomes `Authorized`.
3. Verify or publish a Google-certified CMP/European regulations message in AdSense `Privacy & messaging`.
4. Monitor Search Console Page Indexing and use URL Inspection for priority pages; do not confuse sitemap discovery with indexing.
5. If AdSense approves the site, configure Auto ads or create manual ad units, then verify actual impressions without an ad blocker and with consent behavior tested.
6. Continue publishing original, reviewed, useful editorial content without making disruptive canonical/URL changes during review.
7. If AdSense rejects the site again, preserve the exact rejection email, status screenshots, date, Policy Center details, and affected URLs before making further changes.

## Existing local user work to preserve

At the time this file was created, the worktree already contained these unrelated or not-yet-scoped changes:

```text
M  vercel/app/dashboard/LocalAgentPanel.js
M  vercel/app/dashboard/channels/ChannelAttachForm.js
M  vercel/app/dashboard/page.module.css
?? vercel/docs/editorial-image-generation-batch-2026-08-03.md
?? vercel/lib/staticEditorialArticlesPhase2.js
?? vercel/scripts/publish-phase2-articles.mjs
```

Re-check `git status` every time. This list is a historical snapshot, not permission to modify or commit those files. Some Phase 2 articles were already live through production data even though helper/source files remained untracked locally; verify the live site and data flow before drawing conclusions.

## Work-ledger rules

- Append new entries below in chronological order; do not erase prior entries.
- Use Asia/Dhaka dates and include time when it matters.
- Record: user goal, files changed, verification performed, commit hash/branch, deployment result, external dashboard state, and explicit follow-up.
- Distinguish `verified` facts from `reported by user` and `pending/unverified` facts.
- If a prior status becomes stale, update the Current external handoff and add a ledger entry explaining the transition.
- Do not claim deployment, indexing, approval, authorization, email delivery, or external submission without direct evidence.

## Work ledger

### 2026-08-03 to 2026-08-04 - Public editorial and AdSense-readiness release

- Goal: address the AdSense `Low value content` rejection and improve the complete public reading experience.
- Result: implemented the public-site release summarized above through commits `6584ac8` to `3f6ad16`.
- Deployment correction: Dokploy originally rebuilt old `master` commit `343bcb2`; `3f6ad16` was then fast-forwarded to `origin/master` without force-push and the new production build was verified live.
- Verification: production assets returned HTTP 200; the new header/font/build appeared live; public audit later completed with 34 sitemap URLs, 22 articles, 5 redirects, 0 warnings, and 0 failures.

### 2026-08-04 - Search Console property and sitemap correction

- User initially submitted the sitemap under URL-prefix property `https://www.webtvbd.com/`, while production canonicals use non-www.
- User selected the correct Domain property `webtvbd.com` and submitted `https://webtvbd.com/sitemap.xml`.
- Search Console briefly displayed `Could not fetch`; live HTTP, Googlebot user-agent, robots, DNS, content type, and XML validity checks passed.
- Latest user evidence shows `Sitemap processed successfully`, last read 2026-08-04, with 34 discovered pages.

### 2026-08-04 - AdSense review submitted

- User confirmed the fixed-issues checkbox and submitted the AdSense site review.
- Latest user evidence shows `Getting ready`, verified ownership, and green `Review requested` status.
- Follow-up: wait for Google's result; monitor ads.txt recognition, CMP configuration, indexing, and email/Policy Center notices. Do not delete or resubmit the site during the active review.

### 2026-08-04 - Created repository handoff ledger

- Added root `AGENTS.md` to make the current production, Search Console, AdSense, deployment, dirty-worktree, audit, and follow-up state available to future agents.
- Future agents must maintain this file after material work.

### 2026-09-27 - Started local website and channel tester

- Goal: run the server, client site, and channel tester locally.
- Started Next.js from `vercel/` using `npm run dev -- --hostname 127.0.0.1 --webpack` on port 3000 and the Python agent using `python3 -m uvicorn local_agent:app --host 127.0.0.1 --port 8787`.
- Verification: `/` and `/dashboard/local-check` returned HTTP 200; agent `/health` returned `ok: true`.
- Default Turbopack startup failed to resolve Tailwind from the repository root; Webpack startup succeeded. Local port binding required execution outside the sandbox.
- Files changed: appended this ledger only; existing user work preserved. Branch remains `agent/improve-public-site-experience` at `3f6ad16`; no commit or deployment performed. External dashboards were not checked.
- Follow-up: services are running for local use; no channel scan was initiated.

### 2026-09-27 - Fixed dashboard user count truncation

- Goal: investigate dashboard showing 1,000 users while the client base is reported to be about 5,000.
- Finding: Supabase list queries were using the default 1,000-row response cap. This affected `Total Users` and the Clients page list.
- Files changed: `vercel/lib/dashboardReports.js` and `vercel/app/dashboard/clients/page.js`; added paginated 1,000-row fetches until the final short page.
- Verification: source diff reviewed; the running Next.js dev server compiled the affected dashboard route successfully. A separate `next build` was blocked because the dev/build lock is already held by the running local server.
- Branch remains `agent/improve-public-site-experience`; no commit or deployment performed. Existing user modifications were preserved.
- Follow-up: refresh the dashboard and Clients page; the count should reflect all rows available to the service role. If it still differs, inspect the actual Supabase `client_users` count and auth-user count separately.

### 2026-09-27 - Fixed client login destination

- Goal: send an approved client from the login form into the TV live viewing area instead of the public editorial home.
- Finding: successful client login and an already-authenticated visit to `/client-login` both redirected to `/`, while the intended viewer entry route is `/watch`.
- Files changed: `vercel/app/api/client/auth/login/route.js`, `vercel/app/client-login/page.js`, and `vercel/app/client-login/ClientAuthTabs.js`.
- Result: login now defaults to `/watch`, preserves a validated same-origin `next` path, and authenticated visits to the login page redirect to `/watch`. Pending users retain the pending destination.
- Verification: `/client-login` returned HTTP 200 on the running local server and `git diff --check` passed. No commit or deployment performed.
- Follow-up: log in with an approved client and verify `/watch` loads a channel. If `/watch` falls back to `/`, inspect live playlist/channel data returned by `getHomeIptvData()`.
