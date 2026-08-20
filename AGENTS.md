# Repository guidance

- This repository owns the TP Trees source published at `https://dinopeng.com/tptrees/`.
- Keep all internal navigation compatible with the `/tptrees/` deployment prefix.
- Preserve evidence links and clearly distinguish available public data from identified gaps.
- Run `node --test tests/routes.test.mjs` after modifying pages or navigation.
- Do not add a `CNAME` file here while `dinopeng.com` is served by the portal repository.

## Repository authorization

- This repository's dedicated Codex thread is `01a01b43-a36c-7ae3-87d7-ef37539e0d3d` (`TP Trees｜Repo 專屬對話`).
- The repository authorization authority is Codex thread `019f5fbe-f9d6-7af1-94ad-d36b38ecdd97` (`規劃 Repo 拆分 / 統一設定路徑`).
- The required source-publication reviewer is Codex thread `01a01b1b-94d8-7f52-b5e1-f195d91e1f6d` (`Documentation`). Its review is necessary before any source commit or push, but it is not an authorization; that thread must obtain a one-time, exact-scope AUTH from the repository authorization authority.
- Obtain explicit authorization from that authority before creating or adopting another repository, or changing repository boundaries, ownership, location, name, remote, publication target, or cross-repository scope.
- Ordinary edits inside this already-authorized repository may proceed when they do not change those repository-level boundaries.
- A source publish or source rollback is not an ordinary edit: unless the user explicitly supplies a still-valid authority decision, it requires documentation review followed by a one-time AUTH bound to the repository, executor task, base and head SHAs, exact path allowlist, commit message, release fingerprint, bundle SHA, allowed command, expiry, and invalidation conditions.

## Authoritative source and local verification

- The authoritative source is the fetched `github/main` commit for `doublemoreart-dotcom/tptrees`; a local branch, detached worktree, candidate bundle, or older test result is never authoritative merely because it exists.
- The designated local construction-verification task is `01a01ded-be42-77b2-b135-c9dac7915e50`, but it may operate only in a clean worktree created from the current authoritative full commit SHA. Its old detached `38ef0ec` worktree and `6ade…` diagnostic candidate are retired evidence and must not be cleaned, rebased, or relabeled as the current test baseline.
- A construction-verification task may run a local `/tptrees/` test site, browser smoke tests, and implementation diagnostics. It may not update Markdown governance, commit, push, publish, deploy, redefine the source baseline, or operate another repository.
- Before using a local test worktree, record its full base SHA and confirm clean staged, unstaged, and untracked state. Stop if it differs from the authoritative source, has a pending publish or rollback transaction, contains `CNAME`, or preserves unexplained files from an older candidate.
- If implementation is required, use a fresh construction task or clean worktree and return an exact patch handoff. Integrate and reverify it in the authoritative source checkout before documentation or publication review treats it as current.

## Session continuity

- Treat this repository's files and verifiable Git state as the continuity source; do not depend on replaying a previous Codex session.
- A clean Codex session should begin with `AGENTS.md`, `README.md`, `docs/PROJECT_BASELINE.md`, the relevant workflow document, and an actual Git/status inspection.
- Clean task sessions may perform authorized in-repository work from these rules, but they do not replace the dedicated repository thread or the repository authorization authority unless that relationship is explicitly changed by the authority.
- Keep documentation-and-rules sessions limited to Markdown documentation, repository guidance, working boundaries, plans, and concise handoffs. Do not use such a session to modify pages, runtime assets, data, scripts, tests, or release implementation.
- Before construction work begins, create a fresh Codex task for the implementation. Start it from this repository's current working tree when the uncommitted work is required, and provide only the minimum handoff needed to preserve scope and verification state.
- A construction task may implement and verify authorized in-repository changes, but it may not redefine repository boundaries, authorization roles, external deployment ownership, or the documentation session's scope.
- Treat changes and test results from a separate worktree as a pending implementation handoff, not as the source checkout's current baseline. Do not report its fingerprint, bundle, dirty paths, or verification counts as current until those changes are integrated into the authorized source checkout and reverified there.
- Documentation-and-rules sessions may record that a worktree handoff is pending, but they must not apply construction patches themselves. Integration remains construction work and requires an implementation task or another explicitly authorized workflow.
- Do not send follow-up work to retired or oversized sessions merely to recover context. Consult an older session read-only only when a specific missing fact cannot be established from repository evidence.
- Keep handoffs concise: include scope, branch and commit, dirty paths, completed checks, release fingerprint, pending transaction state, known risks, and explicit prohibitions. Do not copy the full conversation history.
