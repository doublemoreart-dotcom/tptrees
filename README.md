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
- `docs/CSV_UPDATE_FLOW.md`：資料更新流程說明
- `tests/routes.test.mjs`：頁面、導覽與資料 manifest 的基本驗證

## 本機檢視

頁面導覽以正式的 `/tptrees/` 路徑為準。本機可從包含 `tptrees/` 目錄的上一層啟動靜態伺服器，再瀏覽 `/tptrees/`。

## 驗證

```bash
node scripts/verify-static-pages.mjs
node --test tests/routes.test.mjs
```

若有調整品牌視覺或社群縮圖文案，可重建站台資產：

```bash
node scripts/generate-brand-assets.mjs
bash scripts/render-social-preview-png.sh
```

上線前可直接跑完整檢查：

```bash
bash scripts/preflight-release.sh
```

## 更新資料

日常更新建議跑總入口，會更新資料、檢查頁面，並同步本機測試鏡像：

```bash
bash scripts/update-site-data.sh --skip-download
```

若只是要確認目前版本能不能提交或推送，不重新產生資料：

```bash
bash scripts/update-site-data.sh --check-only
```

推 git 前可用準備模式，會跑完整檢查、同步本機鏡像，並列出 branch、remote、diff 與建議推送命令：

```bash
bash scripts/update-site-data.sh --prepare-push
```

推送後若要確認正式站真的更新，可跑：

```bash
bash scripts/update-site-data.sh --check-only --no-sync-local --verify-live
```

這會檢查 `https://dinopeng.com/tptrees/`、`/lifecycle/`、`/species/`、`/daily/` 是否都能讀到新版頁面標記，並確認 `app/analytics.js`、`app/heroicons.js`、favicon、社群縮圖與每日樹卡分享功能是否已經出現在正式站。

若要同步到主站 repo 的 `/tptrees` 目錄，可指定目標：

```bash
bash scripts/update-site-data.sh --check-only --portal-target /path/to/dinopeng-com/tptrees
```

這會用同一份發布清單同步 HTML、`app/`、`public/`、`data/`、子頁與資產，避免正式站只更新頁面但漏掉 JS、favicon 或社群縮圖。

若要下載官方 CSV：

```bash
bash scripts/update-site-data.sh
```

若要同時補樹種照片來源，可限制批次數，先從高出現率樹種補起：

```bash
bash scripts/update-site-data.sh --skip-download --with-images --image-limit 120
```

更新腳本會重建 `data/tree-data-manifest.json` 與 `data/tree-records.js`，可選擇補齊 `data/species-image-sources.json`，並自動執行基本驗證；其中也會檢查「今天給我一棵樹」的分享與下載分享圖片互動。更新前的 CSV 備份會放在 `data/backups/`，此資料夾不進版控。

正式網站目前由入口網站 repo 統一部署至 GitHub Pages；本 repo 是 TP Trees 的獨立來源。若 GitHub 已推送但正式網址仍沒變，先用 `--verify-live` 確認是部署尚未完成、快取未刷新，或是入口網站尚未同步。
