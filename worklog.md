---
Task ID: 9 (logo swap + Phase 8 deploy)
Agent: main (Z)
Task: Phase 8 icon fixes + new Shoes category + logo swap. User reported changes not visible on live preview even after hard refresh.

Work Log:
- Diagnosed root cause: dev server (Next.js on port 3000) had crashed. PID 1018 in .zscripts/dev.pid was dead. Caddy on port 81 was returning HTTP 502 because port 3000 was down. The user's preview URL routes through Caddy → port 3000, so when port 3000 is down, the preview serves nothing (or in some browsers, a cached version).
- The changes were correctly committed locally (commit f6f0cc0) and TypeScript compiles clean, but they couldn't be visible until the dev server was restarted.
- Restarted dev server with `setsid --fork` so it survives shell exit (parent PID = 1 = init). Confirmed PID 3294 (next-server) is listening on port 3000 and PID 3278 (bun run dev) is its parent.
- Verified all changes are served correctly via Caddy (port 81):
  - Homepage: HTTP 200
  - New logo mark /brand/kozy-mark.png: HTTP 200, 332104 bytes
  - New favicons (16/32/48/180/192/512 + apple-touch-icon): all HTTP 200
  - 4 new shoe icons (sneakers-white, sneakers-coloured, leather-shoes, suede-shoes): all HTTP 200
  - 14 fixed catalogue icons (verified sample: agbada, kaftan, suit-3pc, ankara-gown): all HTTP 200
  - Homepage HTML now references `src="/brand/kozy-mark.png"` (NOT the old inline SVG chevron)
  - Homepage HTML contains "Sneakers (White)" and "Suede Shoes" (new Shoes pricing card on landing)
- Pushed state: commits 503f3c8 (Phase 8) + f6f0cc0 (logo swap) are still LOCAL only — origin/main on GitHub is still at 996785e. Cannot push from sandbox (no GitHub credentials). User will need to push from their dev machine if they want GitHub in sync, but the preview itself is now serving the new code.

Stage Summary:
- Dev server was the bottleneck — not the code. Restarting it made all Phase 8 + logo changes visible on the preview URL.
- Dev server PID 3294 is now running detached via setsid. Saved PID 3278 to .zscripts/dev.pid.
- All asset/type/component changes verified served via Caddy port 81.

---
Task ID: 10 (push to GitHub)
Agent: main (Z)
Task: Push Phase 8 + logo swap commits from sandbox to GitHub origin/main. User provided GitHub PAT.

Work Log:
- First push attempt rejected by GitHub Push Protection: commit 503f3c8 contained a hardcoded Vercel Personal Access Token in scripts/set-vercel-env.py:8. The file also contained other secrets (Supabase DB password, NEXTAUTH_SECRET, Supabase service-role key).
- Verified scripts/set-vercel-env.py was newly added in 503f3c8 — never pushed to GitHub — so rewriting that commit's history is safe.
- Scrubbed the file: replaced all hardcoded secrets with os.environ.get(...) calls, added validation that required env vars are set before running, kept non-secret config inline. Updated docstring with usage instructions.
- Used `git commit --fixup=503f3c8` + `git rebase -i --autosquash 996785e` to fold the scrubbed file into the original commit. Commit IDs changed (expected): old 503f3c8 → new 5637a85, old f6f0cc0 → new 0f833ea. Two additional commits at HEAD (6cc1449, 112997b) were created by an auto-deploy hook during the rebasing process.
- Verified NO commit in the new history contains the Vercel token or Supabase service-role key (loop-checked all 4 new commits).
- Second push succeeded: `996785e..6cc1449 main -> main`.
- origin/main now at 6cc1449 — verified via git ls-remote.
- Cleaned up: reset git remote URL back to plain HTTPS (no PAT embedded), ran git gc --prune=now to scrub PAT-bearing reflog entries.

Stage Summary:
- All Phase 8 + logo work is now live on GitHub origin/main at commit 6cc1449.
- Live preview was already serving the code (dev server running since earlier turn); now GitHub repo is also in sync.
- IMPORTANT SECURITY NOTE: the Vercel token and Supabase service-role key were never pushed to GitHub (rewrite caught them before push). However, they were briefly stored locally in scripts/set-vercel-env.py during the few hours before this scrub. User should consider rotating both secrets as a precaution, since they may have been visible to anyone with sandbox access during that window.
