# 臺北市行道樹資料更新流程

CSV 是站方維護用的資料鏡像，不是一般使用者要操作的介面。使用者看到的是「樹木的生命履歷」、「樹種科普」與「今天給我一棵樹」；資料更新由我們端主動執行。

## 目前網站結構

```text
tptrees/
  index.html
  app/
    analytics.js
    heroicons.js
  lifecycle/
    index.html
  species/
    index.html
  daily/
    index.html
  data/
    TaipeiTree.csv
    tree-data-manifest.json
    site-release-manifest.json
    tree-records.js
    backups/
  scripts/
    generate-brand-assets.mjs
    render-social-preview-png.sh
    update-site-data.sh
    update-tree-csv.sh
    build-release-archive.mjs
    build-release-bundle.sh
    check-publish-transaction.mjs
    prepare-release-rollback.mjs
    write-release-handoff.mjs
    release-site.sh
    update-species-images.mjs
    check-species-images.mjs
    build-tree-manifest.mjs
    build-release-manifest.mjs
    preflight-release.sh
    verify-static-pages.mjs
  docs/
    CSV_UPDATE_FLOW.md
```

## 官方資料來源

- 資料集：臺北市行道樹分布圖
- 官方頁面：https://data.taipei/dataset/detail?id=7a49d00c-a5ff-4a6b-be9e-aaa6dc1ff7e8
- CSV 直連：https://tppkl.blob.core.windows.net/blobfs/TaipeiTree.csv

## 建議更新方式：日常總入口

一般情況使用總入口，不需要分別記每支腳本：

```bash
bash scripts/update-site-data.sh --skip-download
```

這會完成：

1. 重建 `favicon.ico`、社群分享縮圖來源稿，並在需要時轉出 PNG。
2. 用既有 `data/TaipeiTree.csv` 重建 manifest 與前端資料。
3. 執行頁面語法、路由與資料測試。
4. 檢查樹種圖片來源覆蓋率與可疑檔名。
5. 檢查品牌資產、社群分享 meta、GA4 與「今天給我一棵樹」分享 / 下載互動。
6. 建立站台版本指紋，確認正式發布檔案彼此一致。

若要下載官方 CSV：

```bash
bash scripts/update-site-data.sh
```

若要同時補樹種圖片來源，建議用批次限制，先補高出現率樹種：

```bash
bash scripts/update-site-data.sh --skip-download --with-images --image-limit 120
```

> 圖片補完採「可信才補」策略。若 Wikimedia Commons / Wikidata 無法穩定對到正確樹種，會留在缺圖清單，不會硬塞錯圖。

若只是要確認目前版本能不能準備提交，不重新產生資料：

```bash
bash scripts/update-site-data.sh --check-only
```

這會跑圖片來源檢查、站台版本指紋與 preflight，不寫入任何外部專案。

若下一步就是準備推 git，建議改用：

```bash
bash scripts/update-site-data.sh --prepare-push
```

這會自動使用 `--check-only` 模式，並在最後列出：

- 目前 branch 與 upstream。
- GitHub remote。
- 待提交檔案。
- diff 摘要。
- source repo 的建議 commit / push 指令。
- 外部部署仍待交接的提醒。

本工作流程只負責 TP Trees source repo。它不搜尋、不複製、不提交，也不推送其他本機專案或 GitHub Repo。

需要交給正式站部署流程時，使用發布入口建立隔離交接包：

```bash
bash scripts/release-site.sh prepare
```

這會產生：

- `.release/bundles/tptrees-<fingerprint>.tar.gz`：可部署的公開檔案；固定排序、檔案 metadata 與 gzip header，讓相同內容可重建出相同 SHA-256。
- `.release/release-handoff.json`：來源 commit、版本指紋、bundle SHA-256、檔案大小、目標路徑與所需外部動作。

`.release/` 不進版控。`doublemoreart-dotcom/aidata-portal` 是獨立的 Private portal Repo，`doublemoreart-dotcom/dinopeng-com` 是目前正式 Pages 發布 Repo；兩者都必須由中央協調工作階段另案授權接手，本腳本不會跨專案執行。

工作區尚未 commit 時，handoff 會標記為 `candidate`；`publish` 完成 source commit 後會重建 bundle 與 handoff，狀態才會是 `source-ready`。外部部署只能使用已發布 source commit 對應的版本。

推送後若要確認正式站已經吃到「同一版」：

```bash
bash scripts/update-site-data.sh --verify-live-only
```

這會檢查正式網址下的四個主要頁面、共用資產，並比對 `data/site-release-manifest.json` 的版本指紋。只要正式站仍是舊版或漏了任何發布檔，就會中止並顯示本機與線上指紋。

- `https://dinopeng.com/tptrees/`
- `https://dinopeng.com/tptrees/lifecycle/`
- `https://dinopeng.com/tptrees/species/`
- `https://dinopeng.com/tptrees/daily/`
- `app/analytics.js`
- `app/heroicons.js`
- `favicon.svg`
- `favicon.ico`
- `public/social-preview.png`

如果正式站使用不同測試網址，也可以指定：

```bash
bash scripts/update-site-data.sh --verify-live-only https://example.com/tptrees
```

若有調整社群縮圖文案或視覺，可以單獨重建品牌資產：

```bash
node scripts/generate-brand-assets.mjs
bash scripts/render-social-preview-png.sh
```

在 Git worktree 中，`render-social-preview-png.sh` 以 tracked SVG 相對 `HEAD` 的內容差異判斷是否重建，不使用 checkout mtime：SVG 內容未變且 tracked PNG 存在時保留既有 PNG；SVG 內容有變或 PNG 缺失時才啟動 Chrome。非 Git 環境才使用 mtime fallback。這項規則避免相同 source 因不同 checkout 時間或 Chrome 輸出形成不同 fingerprint；修改此流程時須執行 `tests/social-preview-render.test.mjs`。

一般日常更新不需要另外記這兩條，`update-site-data.sh` 會自動處理。若環境沒有 Chrome 或暫時不想轉 PNG，可加：

```bash
bash scripts/update-site-data.sh --check-only --no-social-png
```

## 進階：只更新 CSV

在專案根目錄執行：

```bash
bash scripts/update-tree-csv.sh
```

這支腳本會完成：

1. 下載官方 CSV 到暫存檔，不直接覆蓋現有資料。
2. 檢查 CSV 檔案大小，避免下載到錯誤頁或空檔。
3. 備份既有 `data/TaipeiTree.csv` 到 `data/backups/`。
4. 產生 `tree-data-manifest.json`。
5. 產生 `tree-records.js`，供 `file://` 與靜態站直接使用。
6. 檢查四個 HTML 頁面的 inline JavaScript 語法。
7. 執行路由與資料 manifest 測試。

## 其他更新情境

只用既有 CSV 重建資料：

```bash
bash scripts/update-tree-csv.sh --skip-download
```

使用手動下載的 CSV：

```bash
bash scripts/update-tree-csv.sh --from /path/to/TaipeiTree.csv
```

不保留備份：

```bash
bash scripts/update-tree-csv.sh --no-backup
```

只重建資料、不跑頁面檢查：

```bash
bash scripts/update-tree-csv.sh --skip-download --no-verify
```

## 上線前 preflight

資料更新後、推 git 前執行：

```bash
bash scripts/preflight-release.sh
```

這會檢查：

1. 四個 HTML 頁面的 inline JavaScript。
2. 首頁、生命履歷、樹種科普、今天給我一棵樹的基本 landmark、互動選擇器狀態、結果 dialog 與焦點回復、導覽、靜態本機連結、頁內錨點與 `/tptrees/` 路徑隔離測試。
3. `tree-data-manifest.json` 的筆數、雜湊與品質摘要。
4. `species-image-sources.json` 的覆蓋率與可疑圖片標題。
5. `favicon.ico`、`favicon.svg`、`social-preview.svg`、社群分享 meta 與 GA4 追蹤檔是否存在。
6. `daily/index.html` 的換樹、分享與下載分享圖片互動是否存在。
7. `git status --short`，確認有哪些檔案待提交。

Preflight 不會自行啟動瀏覽器。若修改 dialog、鍵盤互動或手機導覽，另以只提供本 Repo 的本機 `/tptrees/` 靜態站確認焦點進入與回復、Tab／Shift+Tab 焦點循環、Escape 關閉，以及 390px viewport 沒有整頁橫向溢出。

## 更新後會產生什麼

- `TaipeiTree.csv`：官方資料的本機鏡像。
- `tree-records.js`：靜態頁使用的壓縮資料，讓本機 `file://` 也能查全量資料。
- `tree-data-manifest.json`：資料來源、更新時間、欄位對應、雜湊值與資料品質摘要。
- `site-release-manifest.json`：頁面、資料與共用資產的發布版本指紋，用來確認本機、主站 Repo 與正式站是否一致。
- `species-image-sources.json`：樹種科普與每日樹卡使用的圖片來源與授權註記。
- `species-image-sources.js`：供靜態頁直接讀取的圖片來源資料。
- `favicon.ico`：瀏覽器分頁與舊版 favicon 使用。
- `public/social-preview.svg`：社群轉發縮圖來源稿。
- `public/social-preview.png`：社群轉發實際使用縮圖。
- 「今天給我一棵樹」下載分享圖片：由瀏覽器即時產生 PNG，不會寫入 repo。
- `data/backups/TaipeiTree-YYYYMMDD-HHMMSS.csv`：更新前備份。

## manifest 會記錄的品質摘要

`tree-data-manifest.json` 會包含：

- `rowCount`：資料筆數。
- `csvSha256`：CSV 雜湊值。
- `recordsSha256`：靜態資料雜湊值。
- `summary.topSpecies`：前十大樹種。
- `summary.districtCounts`：各行政區筆數。
- `qualityChecks`：缺漏與異常摘要。

`qualityChecks` 目前檢查：

| 項目 | 意義 |
|---|---|
| requiredColumnsPresent | 必要欄位是否存在 |
| rowCountAboveMinimum | 筆數是否高於最低門檻 |
| missingTreeIds | 缺樹木編號筆數 |
| duplicateTreeIds | 重複樹木編號筆數 |
| missingSpecies | 缺樹種筆數 |
| missingDistrict | 缺行政區筆數 |
| missingRoad | 缺道路筆數 |
| missingSurveyDate | 缺調查日期筆數 |
| missingCoordinates | 缺座標筆數 |
| suspiciousDiameter | 胸徑疑似異常筆數 |
| suspiciousHeight | 樹高疑似異常筆數 |

## 欄位對應

| 網站用途 | 官方欄位 |
|---|---|
| 樹木編號 | TreeID |
| 行政區 | Dist |
| 道路或路段 | Region |
| 位置備註 | RegionRemark |
| 樹種 | TreeType |
| 胸徑 | Diameter |
| 樹高 | TreeHeight |
| 調查日期 | SurveyDate |
| 座標 X | TWD97X |
| 座標 Y | TWD97Y |
| 來源更新日期 | UpdDate |

## 本地測試方式

可直接用 `file://` 開啟：

```text
index.html
```

若要模擬正式站台路徑，可用本地伺服器：

```bash
python3 -m http.server 8000
```

再開啟：

```text
http://localhost:8000/
```

## 上 git 前檢查

建議至少執行：

```bash
bash scripts/update-site-data.sh --prepare-push
```

執行前先完成 source identity 與交易檢查；不能只看本機快取或舊 handoff：

```bash
git fetch github main
git remote get-url github
git branch --show-current
git rev-parse HEAD
git rev-parse github/main
git rev-list --left-right --count github/main...HEAD
git status --short
git diff --cached --name-only
bash scripts/release-site.sh status
test ! -e CNAME
```

若 source 落後／分叉、dirty path 無法完整分類、已有 staged path、存在 pending publish／rollback、remote 不符或出現 `CNAME`，立即停止。新的 changeset 若不等於 `SOURCE_PUBLISH_PATHS`，不得沿用舊 allowlist；先由 construction task 更新 allowlist 與 fixture tests，再回 authoritative source checkout 重驗。

並確認：

- `tree-data-manifest.json` 的 `rowCount` 合理。
- `qualityChecks` 沒有突然暴增。
- 四個頁面驗證皆為 `ok`。
- 本機瀏覽 `index.html`、`lifecycle/`、`species/`、`daily/` 正常。
- `daily/` 的「分享今天這棵樹」與「下載分享圖片」可正常操作。

## 推 git 後確認正式站

推送完成後執行：

```bash
bash scripts/update-site-data.sh --verify-live-only
```

判讀方式：

- `Live verification complete.`：正式站 HTML 已經有新版標記。
- 缺少某個 marker：正式站該頁還不是新版，先等 GitHub Pages 部署或清快取。
- 某個 asset/path 404：頁面 HTML 已更新，但部署端漏同步資產或資料夾。
- `curl` 失敗：正式網址無法讀取，需檢查部署狀態或網址設定。

若出現「頁面 HTML 已更新，但 `app/analytics.js`、`app/heroicons.js`、`favicon.ico` 或 `public/social-preview.png` 404」，代表正式站部署內容不完整。請把 `.release/release-handoff.json` 與對應 bundle 交給管理正式站 Repo 的協調工作階段處理。

## 固定推送順序

建議使用發布控制入口，固定 source 更新與交接順序：

```bash
bash scripts/release-site.sh status
bash scripts/release-site.sh refresh --skip-download
bash scripts/release-site.sh prepare
bash scripts/release-site.sh publish --message "Describe update" --confirm
bash scripts/release-site.sh verify
```

在 `publish` 之前還有兩個治理閘門：文件／規則 task `01a01b1b-94d8-7f52-b5e1-f195d91e1f6d` 必須先審閱實際 changeset 與全部驗證證據，再由 authority `019f5fbe-f9d6-7af1-94ad-d36b38ecdd97` 核發一次性精確 AUTH。審閱結論不是 AUTH；未取得 AUTH 不得 commit 或 push。

申請必須附上 executor、base/head SHA、ahead/behind、精確 dirty-path allowlist、staged=0、pending 狀態、CNAME、完整測試、瀏覽器 smoke、兩次 deterministic prepare、fingerprint、bundle SHA／size／entries、固定 commit message 與唯一執行命令。AUTH 後任何一項改變即失效，prepare 後與 staging 後仍要再次核對完整路徑集合。

各階段用途：

1. `status`：顯示 source branch、快取遠端差異、release fingerprint 與工作區狀態。
2. `refresh`：只在 source repo 更新資料或資產並跑 preflight。
3. `prepare`：再次驗證，建立 bundle、handoff JSON 與 `.release/last-prepare.env`。
4. `publish`：只 commit / push `doublemoreart-dotcom/tptrees`；未加 `--confirm` 不會推送。
5. `verify`：部署尚未完成時自動重試，直到正式站指紋與本機一致。

`publish` 在 push 前會把 `REMOTE_BEFORE`、`SOURCE_PUBLISHED` 與本次 commit 數寫入 `.release/pending-publish.env`。若 push 或 source-ready handoff finalize 中斷，修正環境後重跑相同的 `publish --confirm` 即可；只有遠端仍在保存的基底或已到達發布 commit 時才會續跑，其他遠端狀態一律停止。

續跑不會擴張原 AUTH：只能由同一 executor 使用原命令、message、path set 與 transaction boundaries。若 AUTH 已過期、遠端或工作樹漂移，先停止並回文件／規則 task 與 authority，不得自行清 pending、補 commit 或 force push。

`tests/release-site-integration.test.mjs` 會在系統暫存目錄建立 fixture repo 與本機 bare remote，實際測試 publish push 被拒後續跑，以及 rollback 在 commit 後、bundle 前中斷再續跑。測試不使用真正 GitHub remote。

若已推送的版本需要退回：

```bash
bash scripts/release-site.sh rollback --confirm --verify
```

這條命令同樣需要新的文件審閱與一次性 rollback AUTH；先前 publish AUTH 不會自動包含 rollback。外部 `dinopeng-com` 回復也不包含在 source rollback AUTH 中，必須由其獨立 executor 另案申請。

腳本會讀取 `.release/last-publish.env`，以保存的 `REMOTE_BEFORE` 將公開網站樹（`index.html`、favicon、`app/`、各頁面目錄、`data/` 與 `public/`）恢復成發布前內容，再建立新的 source commit。控制流程、測試與文件保留目前版本，避免回復網站內容時同時刪除正在執行的 release 工具。

`.release/pending-rollback.env` 會依序保存 `restoring`、`committed`、`ready` 三個階段；網站樹恢復、commit、bundle、push 或 source-ready handoff finalize 中斷後，修正環境並重跑相同的 `rollback --confirm` 即可。腳本會驗證 rollback commit 只有公開樹異動且內容精確等於發布前版本，也只會在遠端仍位於被回復版本或已到達保存的 rollback commit 時續跑；其他遠端狀態、非公開樹異動、未追蹤檔案或手動改寫的恢復內容一律停止。

若最近一次 publish 只有文件、測試或 release 工具異動，公開網站樹沒有差異，`rollback` 會在建立 `.release/pending-rollback.env` 前停止；此情況沒有外部網站版本需要回復，也不應建立空的 rollback commit。

發布與回復 pending 狀態互斥：存在 `.release/pending-publish.env` 時不得開始回復，存在 `.release/pending-rollback.env` 時也不得開始新發布。回復以新 commit 表達，不使用 `reset --hard` 或 force push；若原發布範圍含 merge commit 或 commit 數不符則直接停止。正式站部署仍須由協調工作階段依新交接包處理。

```text
1. 在 TP Trees source repo 跑 `release-site.sh status` 與 `release-site.sh prepare`。
2. 確認 source repo diff，使用 `release-site.sh publish --confirm` 推送 `doublemoreart-dotcom/tptrees`。
3. 把 `source-ready` 的 `.release/release-handoff.json` 與對應 bundle 交給中央協調工作階段驗證；`candidate` 不得交付部署。
4. 由中央協調工作階段另案授權 portal 整合與 `doublemoreart-dotcom/dinopeng-com` 發布；TP Trees 工作階段不得直接操作 `aidata-portal` 或 `dinopeng-com`。
5. 外部部署完成後跑 `release-site.sh verify`。
```

正式網址 `https://dinopeng.com/tptrees/` 只有在外部部署完成後才會更新；只推 source repo 不代表正式站已發布。

## 樹種圖片補完流程

```bash
node scripts/update-species-images.mjs --limit=120
```

圖片來源更新會：

1. 依公開資料中的樹種數量排序，優先補常見樹。
2. 先用樹種中文名、已知學名與英文名查 Wikimedia Commons。
3. 找不到時查 Wikidata，但只接受具有學名欄位的分類群條目。
4. 排除明顯非植物語境，例如獎項、劇場、經文、災害、木材、果汁等。
5. 寫入圖片網址、來源頁、作者、授權與擷取日期。

檢查目前圖片來源狀態：

```bash
node scripts/check-species-images.mjs
```

這會列出：

- 目前有圖的樹種數與覆蓋率。
- 最近一次補圖仍缺圖的樹種。
- 圖片來源是否缺少標題、來源網址、作者或授權。
- 是否有疑似錯誤語境的圖片標題。

## 目前資料邊界

目前頁面只使用行道樹公開資料本身能提供的欄位，因此可以做：

- 樹木身分查詢
- 樹種與尺寸查驗
- 道路、備註與座標查找
- 欄位缺漏與尺寸異常提示

目前仍不能直接回答：

- 健康狀態
- 移植核准
- 移除原因
- 修剪比例
- 工程前後差異
- 移植後存活狀況
