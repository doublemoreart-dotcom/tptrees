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
    tree-records.js
    backups/
  scripts/
    generate-brand-assets.mjs
    render-social-preview-png.sh
    update-site-data.sh
    update-tree-csv.sh
    update-species-images.mjs
    check-species-images.mjs
    build-tree-manifest.mjs
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
6. 同步到本機測試鏡像 `outputs/local-tptrees`。
7. 驗證本機測試鏡像的四個頁面 inline JavaScript。

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

這會跑圖片來源檢查、preflight，並重新同步與驗證本機鏡像。

若下一步就是準備推 git，建議改用：

```bash
bash scripts/update-site-data.sh --prepare-push
```

這會自動使用 `--check-only` 模式，並在最後列出：

- 目前 branch 與 upstream。
- GitHub remote。
- 待提交檔案。
- diff 摘要。
- 建議 commit / push 指令。

若這次有改畫面、互動、資料或靜態資產，還需要把同一份發布內容同步到主站 repo 的 `/tptrees` 目錄：

```bash
bash scripts/update-site-data.sh --check-only --portal-target /path/to/dinopeng-com/tptrees
```

也可以先設定環境變數，之後不用每次輸入路徑：

```bash
export TPTREES_PORTAL_TARGET=/path/to/dinopeng-com/tptrees
bash scripts/update-site-data.sh --check-only
```

同步清單由腳本內的 `PUBLISH_ENTRIES` 統一管理，包含 HTML、`app/`、`daily/`、`data/`、`lifecycle/`、`public/`、`scripts/`、`species/`、favicon、README 與測試檔。

推送後若要確認正式站已經吃到新版：

```bash
bash scripts/update-site-data.sh --check-only --no-sync-local --verify-live
```

這會檢查正式網址下的四個主要頁面與共用資產：

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
bash scripts/update-site-data.sh --check-only --no-sync-local --verify-live https://example.com/tptrees
```

若有調整社群縮圖文案或視覺，可以單獨重建品牌資產：

```bash
node scripts/generate-brand-assets.mjs
bash scripts/render-social-preview-png.sh
```

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
2. 首頁、生命履歷、樹種科普、今天給我一棵樹的路由測試。
3. `tree-data-manifest.json` 的筆數、雜湊與品質摘要。
4. `species-image-sources.json` 的覆蓋率與可疑圖片標題。
5. `favicon.ico`、`favicon.svg`、`social-preview.svg`、社群分享 meta 與 GA4 追蹤檔是否存在。
6. `daily/index.html` 的換樹、分享與下載分享圖片互動是否存在。
7. `git status --short`，確認有哪些檔案待提交。

## 更新後會產生什麼

- `TaipeiTree.csv`：官方資料的本機鏡像。
- `tree-records.js`：靜態頁使用的壓縮資料，讓本機 `file://` 也能查全量資料。
- `tree-data-manifest.json`：資料來源、更新時間、欄位對應、雜湊值與資料品質摘要。
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

並確認：

- `tree-data-manifest.json` 的 `rowCount` 合理。
- `qualityChecks` 沒有突然暴增。
- 四個頁面驗證皆為 `ok`。
- 本機瀏覽 `index.html`、`lifecycle/`、`species/`、`daily/` 正常。
- `daily/` 的「分享今天這棵樹」與「下載分享圖片」可正常操作。

## 推 git 後確認正式站

推送完成後執行：

```bash
bash scripts/update-site-data.sh --check-only --no-sync-local --verify-live
```

判讀方式：

- `Live verification complete.`：正式站 HTML 已經有新版標記。
- 缺少某個 marker：正式站該頁還不是新版，先等 GitHub Pages 部署或清快取。
- 某個 asset/path 404：頁面 HTML 已更新，但部署端漏同步資產或資料夾。
- `curl` 失敗：正式網址無法讀取，需檢查部署狀態或網址設定。

若出現「頁面 HTML 已更新，但 `app/analytics.js`、`app/heroicons.js`、`favicon.ico` 或 `public/social-preview.png` 404」，代表 source repo 已推，但主站 repo 的 `/tptrees` 目錄沒有完整同步。此時先同步主站目錄，再推主站 repo。

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
