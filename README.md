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
- `data/`：臺北市行道樹 CSV、本地前端索引與資料 manifest
- `scripts/`：CSV 更新、manifest 建立與靜態頁語法檢查
- `docs/CSV_UPDATE_FLOW.md`：資料更新流程說明
- `tests/routes.test.mjs`：頁面、導覽與資料 manifest 的基本驗證

## 本機檢視

頁面導覽以正式的 `/tptrees/` 路徑為準。本機可從包含 `tptrees/` 目錄的上一層啟動靜態伺服器，再瀏覽 `/tptrees/`。

## 驗證

```bash
node scripts/verify-static-pages.mjs
node --test tests/routes.test.mjs
```

## 更新資料

```bash
bash scripts/update-tree-csv.sh
```

若只要使用目前本機 CSV 重建前端索引：

```bash
bash scripts/update-tree-csv.sh --skip-download
```

正式網站目前由入口網站 repo 統一部署至 GitHub Pages；本 repo 是 TP Trees 的獨立來源。同步自動化完成前，這裡的變更不會立即出現在正式網址。
