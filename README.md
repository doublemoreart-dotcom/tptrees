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

- `bundles/tptrees-<fingerprint>.tar.gz`：只含正式網站需要的公開檔案。
- `release-handoff.json`：來源 commit、版本指紋、候選／可交接狀態、bundle SHA-256、檔案大小、目標路徑與外部部署需求。
- `last-prepare.env`：本次準備狀態，供發布與追蹤使用。

確認差異後，只推 TP Trees source Repo：

```bash
bash scripts/release-site.sh publish --message "Describe update" --confirm
```

`publish` 會先確認目前 `HEAD` 與 `github/main` 一致，再預檢、commit 並 push；不會改動任何外部專案。正式站若由 `doublemoreart-dotcom/aidata-portal` 發布，需要協調工作階段依 `release-handoff.json` 另行同步與部署。

部署完成後可唯讀查驗正式站：

```bash
bash scripts/release-site.sh verify
```

若最近一次由此腳本發布的 source 需要回復：

```bash
bash scripts/release-site.sh rollback --confirm
```

回復使用 `git revert` 產生新 commit，不使用 `reset --hard` 或 force push；若遠端已有後續版本會停止。外部部署仍須使用新交接包另行處理。

底層資料更新腳本也可單獨使用：

```bash
bash scripts/update-site-data.sh --check-only
bash scripts/update-site-data.sh --prepare-push
bash scripts/update-site-data.sh --verify-live-only
```

線上查驗會檢查四個頁面、共用資產與 `data/site-release-manifest.json`。只有正式站版本指紋與目前來源一致才會通過。
