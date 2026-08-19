# TP Trees 專案基準

本文件提供後續維護工作階段所需的最小背景；操作細節以 [CSV_UPDATE_FLOW.md](CSV_UPDATE_FLOW.md) 與腳本 `--help` 為準。

## 專案目標與責任邊界

TP Trees 將臺北市行道樹公開資料整理成可查驗的靜態網站，呈現可取得的樹木資料、資料品質與已知資訊落差。

- Source repo：`doublemoreart-dotcom/tptrees`，擁有本目錄的頁面、資料快照、資產、測試與發布交接腳本。
- 正式網址：`https://dinopeng.com/tptrees/`，所有內部路徑須相容 `/tptrees/` 前綴。
- 外部部署：正式站由其他專案接手部署。source repo 只建立可驗證的 bundle 與 handoff，不修改入口網站 repo、GitHub Pages、workflow、CNAME 或網域。

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
node --test tests/routes.test.mjs
bash scripts/preflight-release.sh
```

驗證涵蓋四個頁面的 inline JavaScript、`/tptrees/` 路由、資料與發布 manifest、圖片來源、品牌資產及每日樹卡互動。版本交接以 `data/site-release-manifest.json` 的 `releaseSha256` 為準。

## 發布、回復與隔離

- `prepare` 只在 source 未落後快取 `github/main` 時建立 `.release/` bundle 與 handoff；工作區未提交時狀態為 `candidate`。
- `publish --confirm` 才會 commit 並推送 `doublemoreart-dotcom/tptrees`；一般文件或檢查工作不得自行執行。
- 外部正式站需由協調工作階段依 `release-handoff.json` 同步、部署，再以 `release-site.sh verify` 唯讀比對版本指紋。
- `rollback --confirm` 只回復最近一次由腳本發布的 source commit，使用 `git revert`，不改寫歷史；外部站仍需另行部署新 bundle。
- 不得將 source 檔案直接複製到其他本機專案，也不得在此 repo 加入 `CNAME`。

## 已知限制

- 官方 CSV 有缺漏與疑似異常值；應保留 manifest 的品質摘要與頁面上的資料限制說明，不把公開欄位推論成完整維護紀錄。
- 網站是靜態快照，更新頻率取決於 source 更新與外部部署，source push 不等於正式站已更新。
- 樹種圖片以可追溯授權為前提，無可靠對應時允許缺圖，不應用不確定圖片填補。
- 線上驗證只能證明公開檔案與版本指紋一致，不能代替瀏覽器互動、無障礙或第三方服務的人工檢查。
- 開始發布工作前必須先檢查 branch、未提交變更與 `github/main` 差異；不得覆蓋他人既有工作。
