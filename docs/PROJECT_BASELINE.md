# TP Trees 專案基準

本文件提供後續維護工作階段所需的最小背景；操作細節以 [CSV_UPDATE_FLOW.md](CSV_UPDATE_FLOW.md) 與腳本 `--help` 為準。

## 專案目標與責任邊界

TP Trees 將臺北市行道樹公開資料整理成可查驗的靜態網站，呈現可取得的樹木資料、資料品質與已知資訊落差。

- Source repo：`doublemoreart-dotcom/tptrees`，擁有本目錄的頁面、資料快照、資產、測試與發布交接腳本。
- 正式網址：`https://dinopeng.com/tptrees/`，所有內部路徑須相容 `/tptrees/` 前綴。
- 外部專案：`doublemoreart-dotcom/aidata-portal` 是獨立的 Private portal Repo；`doublemoreart-dotcom/dinopeng-com` 是目前正式 Pages 發布 Repo。source repo 只建立可驗證的 bundle 與 handoff，不搜尋或修改兩者的 checkout、remote、Pages、workflow、CNAME、網域或部署設定。

## 網站與資料結構

- `index.html`：專案首頁與資料脈絡。
- `lifecycle/index.html`：依公開欄位查驗樹木生命履歷。
- `species/index.html`：樹種科普與常見樹種統計。
- `daily/index.html`：每日樹卡、分享與圖片下載。
- `app/`、`public/`：共用互動、分析、動態效果、favicon 與社群資產。
- `data/TaipeiTree.csv`：官方 CSV 的 source repo 快照。
- `data/tree-records.js`：供靜態頁與 `file://` 使用的前端資料。
- `data/tree-data-manifest.json`：資料來源、欄位、雜湊與品質摘要。
- `data/site-release-manifest.json`：發布檔案雜湊與整站版本指紋。
- `data/species-image-sources.{json,js}`：樹種圖片來源與授權註記。

## 資料來源與更新

主要資料是臺北市資料大平臺的「臺北市行道樹分布圖」CSV；來源頁與直連記錄在 `tree-data-manifest.json`。資料是專案內快照，不代表官方系統的即時狀態。

日常工作由 `scripts/release-site.sh` 統一入口：

```bash
bash scripts/release-site.sh status
bash scripts/release-site.sh refresh --skip-download
bash scripts/release-site.sh prepare
```

需要抓取最新官方 CSV 時移除 `--skip-download`。完整參數、備份、圖片補齊與 manifest 說明見 [CSV_UPDATE_FLOW.md](CSV_UPDATE_FLOW.md)。

## 驗證基準

修改頁面、資料、資產或發布流程後，至少執行：

```bash
node scripts/verify-static-pages.mjs
node --test tests/*.test.mjs
bash scripts/preflight-release.sh
```

驗證涵蓋四個頁面的 inline JavaScript、基本頁面 landmark、互動選擇器狀態、結果 dialog 與焦點回復、所有靜態本機連結與頁內錨點、`/tptrees/` 路徑隔離、資料與發布 manifest、圖片來源、品牌資產、社群預覽 renderer 的內容判斷及每日樹卡互動。版本交接以 `data/site-release-manifest.json` 的 `releaseSha256` 為準。

發布流程整合測試只使用系統暫存目錄中的 fixture repo 與本機 bare remote，會實際模擬 push 被拒、續跑、rollback commit 後中斷與續跑，但不連線或寫入真正 GitHub remote。

修改 dialog、鍵盤互動或響應式導覽後，另以只提供本 Repo 的本機 `/tptrees/` 靜態站做瀏覽器 smoke test：確認焦點進入 dialog、Tab／Shift+Tab 不離開 dialog、Escape 關閉後焦點回到觸發元件，以及 390px viewport 的導覽可水平捲動且頁面沒有整體橫向溢出。這項真實瀏覽器檢查不包含在 Node preflight 中，交接時須明確記錄是否執行。

## 最近驗證快照

截至 2026-08-20，source checkout 位於 `codex/tptrees-release-stabilization`、HEAD `38ef0ec`，相對快取 `github/main` 為 ahead 1、behind 0；工作區有 24 個既有未提交路徑，publish／rollback transaction 皆無，且沒有 `CNAME`。此狀態仍是 `candidate`，不可交付部署。

- Routes：13/13；完整 Node tests 與 preflight：33/33；社群預覽 renderer regression：3/3。
- 生命履歷 `?treeId=...` 與樹種深連結均已在本機 `/tptrees/` 環境確認可還原條件並開啟結果。
- 真實瀏覽器 console 無 warning／error，本機 `/tptrees/` 資源均為 HTTP 200、無 404。
- 人工反轉 SVG／PNG mtime 後，renderer 仍依 tracked SVG 內容保留既有 PNG；連續兩次 `prepare` 的 fingerprint、bundle SHA、大小與 entries 完全一致。
- `SOURCE_PUBLISH_PATHS`、本文件清單與實際 dirty paths 均為相同 24-path 集合；fixture 已確認額外路徑、缺少路徑或 staging drift 都會使 publish 在真正 push 前停止。
- Release fingerprint：`90a0b109bf810ceed033b46c4c9025a69b860c5df693b4b1db3dd298653db071`。
- Candidate bundle：`tptrees-90a0b109bf81.tar.gz`；SHA-256 `b89143af07be290a67d989708344218763f388cefb84b89769e695ecd5e704f3`；5,889,700 bytes、27 entries。

本節只作為最近一次精簡交接參考；新 Session 開始時仍須以實際 Git、manifest、transaction 與測試狀態重新確認，不得只引用此快照。

## 發布前人工審閱清單

截至最近驗證快照，24 個 dirty paths 應以以下四組一起審閱；若實際 `git status --short` 與此清單不同，先停止並重新分類，不得沿用舊核准。

| 分組 | 路徑 | 人工確認重點 |
|---|---|---|
| 公開網站（6） | `index.html`、`lifecycle/index.html`、`species/index.html`、`daily/index.html`、`app/motion.js`、`data/site-release-manifest.json` | `/tptrees/` 路徑、官方證據連結、canonical、landmark、互動選取狀態、dialog 焦點、deep link 與整站 fingerprint |
| 文件／規則（4） | `AGENTS.md`、`README.md`、`docs/PROJECT_BASELINE.md`、`docs/CSV_UPDATE_FLOW.md` | source／外部部署分離、Session 分工、候選狀態、操作指令、限制與最近驗證是否一致 |
| Release tooling（8） | `scripts/build-release-bundle.sh`、`scripts/preflight-release.sh`、`scripts/release-site.sh`、`scripts/write-release-handoff.mjs`、`scripts/build-release-archive.mjs`、`scripts/check-publish-transaction.mjs`、`scripts/prepare-release-rollback.mjs`、`scripts/render-social-preview-png.sh` | deterministic archive、content-based social preview render、candidate／source-ready 判定、source-only 邊界、publish／rollback 續跑、遠端漂移拒絕與無外部寫入 |
| Tests（6） | `tests/routes.test.mjs`、`tests/release-archive.test.mjs`、`tests/release-flow.test.mjs`、`tests/release-site-integration.test.mjs`、`tests/release-transaction.test.mjs`、`tests/social-preview-render.test.mjs` | routes／deep link、防跨 Repo、封存與社群 PNG 可重現性、publish／rollback fixture 與 transaction 狀態覆蓋 |

人工審閱與授權順序：

1. [ ] 確認 branch、HEAD、快取 `github/main` 差異、dirty paths、pending publish／rollback 與 `CNAME` 狀態，沒有不屬於上述四組的檔案。
2. [ ] 逐組閱讀 diff；公開網站先確認市民可見內容與資料限制，release tooling 再確認失敗／續跑／回復路徑，文件最後核對描述沒有超過實際能力。
3. [ ] 重新執行 routes、完整 Node tests、preflight 與必要的真實瀏覽器 smoke test；確認 fingerprint、candidate bundle SHA 與 handoff 相互一致。
4. [ ] 取得本次 TP Trees source publication 的明確授權後，才可執行 `publish --confirm`；授權前不得 commit 或 push。發布流程必須以核准的精確 dirty-path allowlist staging，並在 staging 前後核對完整集合；禁止 `git add --all` 等全域 staging。若 dirty paths、staged paths 或遠端基底改變，原核准失效，須停止並重新審閱。
5. [ ] Source publish 只可操作 `doublemoreart-dotcom/tptrees`。完成後須重新產生並確認 `source-ready` handoff；`candidate` 不得交付部署。
6. [ ] `doublemoreart-dotcom/dinopeng-com` 的正式站整合／部署須由中央協調工作階段另案授權；`doublemoreart-dotcom/aidata-portal` 保持完全分離，本 Repo 不修改 Pages、CNAME 或網域。

## 發布、回復與隔離

- `prepare` 只在 source 未落後快取 `github/main` 時建立 `.release/` bundle 與 handoff；工作區未提交時狀態為 `candidate`。
- `publish --confirm` 才會 commit 並推送 `doublemoreart-dotcom/tptrees`；一般文件或檢查工作不得自行執行。
- Source publish 只能 staging 本次人工審閱與 authority 核准的精確路徑；prepare 後、staging 前及 staging 後都必須比對集合，缺少或新增任一路徑即停止。
- `candidate` handoff 不得部署；source commit 發布後的 `source-ready` handoff 必須先由中央協調工作階段驗證，再另案授權 portal 整合與 `doublemoreart-dotcom/dinopeng-com` 發布。
- 本工作流程不得直接搜尋、寫入、同步、commit、push 或部署 `doublemoreart-dotcom/aidata-portal` 與 `doublemoreart-dotcom/dinopeng-com`；部署完成後只能以 `release-site.sh verify` 唯讀比對版本指紋。
- `publish --confirm` 會以 `.release/pending-publish.env` 保存遠端基底與完整發布範圍；push 或 finalize 中斷時重跑相同命令可安全續跑，遠端漂移則停止。
- `rollback --confirm` 會將公開網站樹恢復成最近一次腳本發布前的內容並建立新 commit，保留目前的 release 腳本、測試與文件且不改寫歷史；`.release/pending-rollback.env` 會保存 `restoring`、`committed`、`ready` 階段，任一階段中斷時重跑相同命令可安全續跑。沒有公開網站差異的 source-only publish 會在建立 rollback 交易前停止；遠端漂移、非公開樹修改或手動改寫的恢復檔案也會使流程停止。外部站仍需另行部署新 bundle。
- 不得將 source 檔案直接複製到其他本機專案，也不得在此 repo 加入 `CNAME`。

## 已知限制

- 官方 CSV 有缺漏與疑似異常值；應保留 manifest 的品質摘要與頁面上的資料限制說明，不把公開欄位推論成完整維護紀錄。
- 網站是靜態快照，更新頻率取決於 source 更新與外部部署，source push 不等於正式站已更新。
- 樹種圖片以可追溯授權為前提，無可靠對應時允許缺圖，不應用不確定圖片填補。
- 樹種頁的 Wikimedia 外部圖片可能使瀏覽器完整 `load` 等待超過 30 秒；核心 DOM、dialog、資料與本機資源應分開驗證，不能把外部圖片延遲誤判為本機站台失敗。
- 線上驗證只能證明公開檔案與版本指紋一致，不能代替瀏覽器互動、無障礙或第三方服務的人工檢查。
- 開始發布工作前必須先檢查 branch、未提交變更與 `github/main` 差異；不得覆蓋他人既有工作。

## Session 延續基準

專案延續以 repo 文件與可驗證狀態為主，不以舊 Codex 對話歷史為主。新的乾淨 Session 應依序讀取 `AGENTS.md`、`README.md`、本文件與當次相關流程文件，再盤點實際 Git 狀態、pending 交易與測試結果；不得為了取得一般背景而重新喚醒已退役或過大的 Session。

乾淨的任務 Session 可依上述文件執行已授權的 repo 內工作，但不會因此取代 `AGENTS.md` 記載的 Repo 專屬對話或 Repo 授權權威；兩者角色只有在權威明確變更後才能改寫。

文件／規則 Session 只維護 Markdown 文件、Repo 指引、工作邊界、規劃與精簡交接，不修改頁面、runtime 資產、資料、scripts、tests 或 release implementation。需要開始建構程式碼時，先建立新的乾淨 Codex task；若需延續本地未提交成果，應從目前 working tree 啟動，並只交接允許範圍、實際 Git 狀態、最近驗證、release fingerprint、pending transaction、已知風險與禁止事項。新 task 負責實作與驗證，不因此取得改寫 Repo 邊界、授權角色或外部部署責任的權限。

獨立 worktree 內的修正與測試結果只是待整合的 implementation handoff，不是本 source checkout 的現況。只有在建構 task 或其他明確授權流程將差異整合回 source checkout，並在該 checkout 重新執行相稱驗證後，文件端才能把新的 dirty paths、測試數、release fingerprint、bundle 或 handoff 狀態寫成目前基準；文件／規則 Session 不自行套用建構 patch。

交接只保留下一個 Session 執行所需的最小資訊：允許範圍、branch／HEAD／遠端差異、未提交路徑、最近驗證、release fingerprint、handoff 狀態、已知風險與禁止事項。若 repo 文件與舊摘要不一致，以實際檔案、Git 狀態及最新明確授權為準，不載入或複製完整舊對話。
