# Repository guidance

- This repository owns the TP Trees source published at `https://dinopeng.com/tptrees/`.
- Keep all internal navigation compatible with the `/tptrees/` deployment prefix.
- Preserve evidence links and clearly distinguish available public data from identified gaps.
- Run `node --test tests/routes.test.mjs` after modifying pages or navigation.
- Do not add a `CNAME` file here while `dinopeng.com` is served by the portal repository.

## Repository authorization

- This repository's dedicated Codex thread is `01a01b43-a36c-7ae3-87d7-ef37539e0d3d` (`TP Trees｜Repo 專屬對話`).
- The repository authorization authority is Codex thread `019f5fbe-f9d6-7af1-94ad-d36b38ecdd97` (`規劃 Repo 拆分 / 統一設定路徑`).
- Obtain explicit authorization from that authority before creating or adopting another repository, or changing repository boundaries, ownership, location, name, remote, publication target, or cross-repository scope.
- Ordinary edits inside this already-authorized repository may proceed when they do not change those repository-level boundaries.

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
