# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YouTube Playlist Enhancer — Chrome 擴充功能 (Manifest V3)，增強 YouTube 的「儲存至播放清單」選單，支援多選播放清單與搜尋篩選。零第三方運行時依賴。

## Commands

```bash
npm run dev          # 開發模式 (webpack watch)
npm run build        # 生產構建 → dist/
npm run lint         # ESLint 檢查
npm run lint:fix     # ESLint 自動修復
npm run format       # Prettier 格式化
npm run package      # 打包成 zip (供 Chrome Web Store 上傳)
npm run version      # 同步 manifest.json 版本號
```

Git hooks (Husky): pre-commit 執行 lint，pre-push 執行 lint + build。

目前沒有測試框架配置，`npm test` 會直接通過。

## Architecture

Chrome Manifest V3 擴充功能，兩個 entry point：

- **Content Script** (`src/content/index.ts`) — 注入 YouTube 頁面，核心功能所在
- **Background Service Worker** (`src/background/service-worker.ts`) — 最小化實現

### Content Script 執行流程

```
index.ts (初始化)
  → observer.ts: MutationObserver 監聽 YouTube DOM
    → 偵測到 yt-sheet-view-model (播放清單選單)
    → isPlaylistSheet() 多層驗證 (標題文本 + DOM 結構 + 排除三點菜單)
  → enhancer.ts: 協調增強功能
    → installGlobalClickInterceptor(): capture 階段攔截事件，防止 YouTube 關閉選單
    → multiselect.ts (SelectionManager): 添加複選框、管理選擇狀態、批量保存
    → search.ts (SearchManager): 添加搜尋框、篩選播放清單
```

### 關鍵設計模式

- **事件攔截**: 使用 `window.addEventListener(event, handler, { capture: true, signal })` + `AbortController` 在 capture 階段攔截事件防止冒泡到 YouTube，cleanup 時透過 `abort()` 批量移除所有監聽器
- **DOM 選擇器策略** (`selectors.ts`): 每個選擇器有 primary + fallback 配置，應對 YouTube DOM 變更
- **多語言標題匹配** (`selectors.ts`): `PLAYLIST_TITLE_PATTERNS` 支援繁中/簡中/英/日/韓/德/西/法/俄等語言的「儲存至播放清單」標題
- **播放清單原始狀態檢測**: 透過 `[role="checkbox"]` aria-checked 或書籤 SVG path 形狀判斷影片是否已在該播放清單中
- **Quick Pre-Check**: 快速判斷選單類型 — `'playlist'` 用 50ms 延遲增強，`'not-playlist'` 立即清理，`'uncertain'` 用 300-400ms 重檢
- **SPA 導航**: 監聽 `yt-navigate-finish` 和 `popstate` 事件處理 YouTube SPA 頁面切換

### CSS 慣例

- 所有 CSS class 使用 `ype-` 前綴 (YouTube Playlist Enhancer)，避免污染 YouTube 樣式
- 使用 YouTube CSS 變數 (`--yt-spec-*`) 自動適應亮暗模式
- UI 文本使用繁體中文

### 類型定義

`src/types/index.ts` — `PlaylistItem`, `SelectorConfig`, `Selectors`, `ToastType`, `SheetCallback`

Webpack 透過 DefinePlugin 注入 `__NODE_ENV__` 和 `__EXTENSION_VERSION__`（從 package.json 讀取）。

## Code Style

- TypeScript strict mode, target ES2020
- ESLint: 允許 `_` 前綴的未使用變數，允許 `console.warn`/`console.error`
- Prettier: 單引號, 分號, 2 空格, trailing comma (es5), printWidth 100
- 結構化日誌使用 `src/utils/logger.ts`，輸出格式 `[YPE] [LEVEL] message`

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
