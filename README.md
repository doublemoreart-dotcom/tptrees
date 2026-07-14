# TP Trees

整理臺北市行道樹公開資料的可查內容、資訊落差，以及可查驗的城市樹木生命履歷。

- 正式網址：https://dinopeng.com/tptrees/
- 生命履歷：https://dinopeng.com/tptrees/lifecycle/
- 入口網站：https://dinopeng.com/

## 專案結構

- `index.html`：臺北市行道樹公開資料現況
- `lifecycle/index.html`：可查驗的城市樹木生命履歷
- `tests/routes.test.mjs`：頁面、導覽與部署路徑的基本驗證

## 本機檢視

頁面導覽以正式的 `/tptrees/` 路徑為準。本機可從包含 `tptrees/` 目錄的上一層啟動靜態伺服器，再瀏覽 `/tptrees/`。

## 驗證

```bash
node --test tests/routes.test.mjs
```

正式網站目前由入口網站 repo 統一部署至 GitHub Pages；本 repo 是 TP Trees 的獨立來源。同步自動化完成前，這裡的變更不會立即出現在正式網址。
