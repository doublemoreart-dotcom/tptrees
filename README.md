# TP Trees

整理臺北市行道樹公開資料的可查內容、資訊落差，以及可查驗的城市樹木生命履歷。

- 正式網址：https://dinopeng.com/tptrees/
- 生命履歷：https://dinopeng.com/tptrees/lifecycle/
- 入口網站：https://dinopeng.com/

## 專案結構

- `index.html`：臺北市行道樹小幫手首頁
- `lifecycle/index.html`：樹木的生命履歷查詢
- `species/index.html`：樹種科普與常見樹木排行榜
- `daily/index.html`：今天給我一棵樹
- `app/analytics.js`：GA4 追蹤碼共用設定，只在正式網域送出資料
- `app/heroicons.js`：主要導航與 CTA 使用的 Heroicons inline SVG 圖示
- `data/`：臺北市行道樹 CSV、本地前端索引與資料 manifest
- `favicon.ico`、`favicon.svg`、`public/social-preview.svg`：瀏覽器與社群分享資產
- `scripts/`：資料更新、圖片來源補齊、manifest 建立與靜態頁語法檢查
- [`docs/PROJECT_BASELINE.md`](docs/PROJECT_BASELINE.md)：專案目標、責任邊界、驗證與已知限制的維護基準
- `docs/CSV_UPDATE_FLOW.md`：資料更新流程說明
- `tests/*.test.mjs`：頁面、導覽、資料 manifest、handoff 狀態與專案隔離驗證

## 本機檢視

頁面導覽以正式的 `/tptrees/` 路徑為準。本機可從包含 `tptrees/` 目錄的上一層啟動靜態伺服器，再瀏覽 `/tptrees/`。

本機 construction verification 必須使用從目前 `doublemoreart-dotcom/tptrees` 的 authoritative `github/main` 完整 SHA 建立的乾淨 worktree。舊 detached worktree、未整合 patch 或 `candidate` bundle 都不是目前 source 基準；若 base、dirty/staged/untracked、pending transaction 或 `CNAME` 不符，先停止，不啟動測試站。

## 驗證

```bash
node scripts/verify-static-pages.mjs
node --test tests/*.test.mjs
```

若有調整品牌視覺或社群縮圖文案，可重建站台資產：

```bash
node scripts/generate-brand-assets.mjs
bash scripts/render-social-preview-png.sh
```

在 Git worktree 中，SVG 內容相對 `HEAD` 未變且既有 PNG 已受版本控制時，renderer 會保留該 PNG，不以 checkout mtime 重新產生；SVG 內容變更或 PNG 缺失時才重建。

上線前可直接跑完整檢查：

```bash
bash scripts/preflight-release.sh
```

## 更新資料

更新流程只會修改與推送本專案 `doublemoreart-dotcom/tptrees`。它不會寫入本機鏡像、入口網站 Repo、GitHub Pages、網域或其他部署設定。

先看來源分支、遠端差異、版本指紋與未提交檔案：

```bash
bash scripts/release-site.sh status
```

使用既有 CSV 更新資料與資產：

```bash
bash scripts/release-site.sh refresh --skip-download
```

若要下載官方 CSV，移除 `--skip-download`；若要補樹種圖片，可加 `--with-images --image-limit 120`。

發布前建立完整預檢與交接包：

```bash
bash scripts/release-site.sh prepare
```

`prepare` 會先確認目前來源沒有落後快取的 `github/main`；若遠端較新會停止，避免從舊基底產生發布包。

輸出位於 `.release/`：

- `bundles/tptrees-<fingerprint>.tar.gz`：只含正式網站需要的公開檔案；相同內容會產生相同的 bundle SHA-256。
- `release-handoff.json`：來源 commit、版本指紋、候選／可交接狀態、bundle SHA-256、檔案大小、目標路徑與外部部署需求。
- `last-prepare.env`：本次準備狀態，供發布與追蹤使用。

確認差異後，只推 TP Trees source Repo：

```bash
bash scripts/release-site.sh publish --message "Describe update" --confirm
```

這條命令不是一般日常指令。任何 source commit/push 前，除非使用者已提供仍有效的 authority 決定，必須先由文件／規則 task `01a01b1b-94d8-7f52-b5e1-f195d91e1f6d` 完成發布審閱，再由 authority `019f5fbe-f9d6-7af1-94ad-d36b38ecdd97` 核發一次性 AUTH；文件 task 的回覆不能取代 AUTH。

`publish` 會先確認目前 source 未落後或分叉自 `github/main`，再預檢、依本次核准的精確路徑 allowlist staging、commit 並以 fast-forward push；prepare 後、staging 前與 staging 後的路徑集合都必須與核准範圍完全一致，不得使用全域 staging。AUTH 必須綁定 executor、base/head SHA、路徑集合、commit message、fingerprint、bundle SHA、唯一命令、期限與失效條件；任一值漂移即停止。流程不會改動任何外部專案。`doublemoreart-dotcom/aidata-portal` 是獨立的 Private portal Repo，目前正式 Pages 發布 Repo 是 `doublemoreart-dotcom/dinopeng-com`；兩者都只能由中央協調工作階段另案授權處理。

若 push 或 source-ready handoff finalize 中斷，`.release/pending-publish.env` 會保留遠端基底、發布後 commit 與 commit 數；修正環境後重跑同一條 `publish --confirm`，腳本只會在遠端仍位於保存的基底或已發布 commit 時安全續跑。遠端若有其他更新會停止。

部署完成後可唯讀查驗正式站：

```bash
bash scripts/release-site.sh verify
```

若最近一次由此腳本發布的 source 需要回復：

```bash
bash scripts/release-site.sh rollback --confirm
```

Rollback 也是新的 source commit/push，必須重新經過文件審閱與一次性 authority AUTH；既有 `last-publish.env` 是交易證據，不是持續授權。回復會以發布前的遠端 SHA 為基底，把公開網站樹（頁面、資產與資料）恢復到發布前內容，再建立新的 source commit；release 腳本、測試與文件不會跟著舊網站內容退版，也不使用 destructive reset 或 force push。`.release/pending-rollback.env` 會依序記錄 `restoring`、`committed`、`ready` 階段，因此從網站樹恢復、commit、bundle、push 到 source-ready handoff finalize 任一階段中斷，都只能在同一 AUTH 與交易邊界內重跑相同的 `rollback --confirm` 安全續跑。若該次 publish 只有文件或工具異動而沒有公開網站差異，腳本會在建立 pending 狀態前停止，因為沒有網站版本需要回復。遠端若已有其他版本、工作樹含非預期手動修改，或 rollback commit 改到公開樹以外的檔案，腳本也會停止。外部部署回復仍須使用新交接包，由 `dinopeng-com` 的獨立 executor 另案取得 AUTH。

底層資料更新腳本也可單獨使用：

```bash
bash scripts/update-site-data.sh --check-only
bash scripts/update-site-data.sh --prepare-push
bash scripts/update-site-data.sh --verify-live-only
```

線上查驗會檢查四個頁面、共用資產與 `data/site-release-manifest.json`。只有正式站版本指紋與目前來源一致才會通過。

生命履歷支援以 `?treeId=...` 還原指定樹木；從生命履歷前往樹種科普時，也會保留樹種、樹木編號、行政區、道路與位置備註等可用查詢脈絡。這些 query deep link 由 routes regression 與本機 `/tptrees/` 瀏覽器 smoke test 驗證。
