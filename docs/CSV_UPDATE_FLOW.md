# 臺北市行道樹資料更新流程

CSV 是站方維護用的資料鏡像，不是一般使用者要操作的介面。使用者看到的是「樹木的生命履歷」、「樹種科普」與「今天給我一棵樹」；資料更新由我們端主動執行。

## 目前網站結構

```text
outputs/local-tptrees/
  index.html
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
    update-tree-csv.sh
    build-tree-manifest.mjs
    verify-static-pages.mjs
  docs/
    CSV_UPDATE_FLOW.md
```

## 官方資料來源

- 資料集：臺北市行道樹分布圖
- 官方頁面：https://data.taipei/dataset/detail?id=7a49d00c-a5ff-4a6b-be9e-aaa6dc1ff7e8
- CSV 直連：https://tppkl.blob.core.windows.net/blobfs/TaipeiTree.csv

## 建議更新方式

在專案根目錄執行：

```bash
bash outputs/local-tptrees/scripts/update-tree-csv.sh
```

這會完成：

1. 下載官方 CSV 到暫存檔，不直接覆蓋現有資料。
2. 檢查 CSV 檔案大小，避免下載到錯誤頁或空檔。
3. 備份既有 `data/TaipeiTree.csv` 到 `data/backups/`。
4. 產生 `tree-data-manifest.json`。
5. 產生 `tree-records.js`，供 `file://` 與靜態站直接使用。
6. 檢查四個 HTML 頁面的 inline JavaScript 語法。

## 其他更新情境

只用既有 CSV 重建資料：

```bash
bash outputs/local-tptrees/scripts/update-tree-csv.sh --skip-download
```

使用手動下載的 CSV：

```bash
bash outputs/local-tptrees/scripts/update-tree-csv.sh --from /path/to/TaipeiTree.csv
```

不保留備份：

```bash
bash outputs/local-tptrees/scripts/update-tree-csv.sh --no-backup
```

## 更新後會產生什麼

- `TaipeiTree.csv`：官方資料的本機鏡像。
- `tree-records.js`：靜態頁使用的壓縮資料，讓本機 `file://` 也能查全量資料。
- `tree-data-manifest.json`：資料來源、更新時間、欄位對應、雜湊值與資料品質摘要。
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
outputs/local-tptrees/index.html
```

若要模擬正式站台路徑，可用本地伺服器：

```bash
python3 -m http.server 8000 --directory outputs/local-tptrees
```

再開啟：

```text
http://localhost:8000/
```

## 上 git 前檢查

建議至少執行：

```bash
bash outputs/local-tptrees/scripts/update-tree-csv.sh --skip-download
```

並確認：

- `tree-data-manifest.json` 的 `rowCount` 合理。
- `qualityChecks` 沒有突然暴增。
- 四個頁面驗證皆為 `ok`。
- 本機瀏覽 `index.html`、`lifecycle/`、`species/`、`daily/` 正常。

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
