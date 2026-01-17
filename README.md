# YouTube Playlist Enhancer

增強 YouTube 播放清單儲存功能的 Chrome 擴充功能，支援**多選播放清單**和**搜尋篩選**功能。

## 功能特色

### 1. 多選播放清單
- 一次勾選多個播放清單，批次儲存影片
- 視覺化的 checkbox 顯示選取狀態
- 支援新增和移除操作
- 底部顯示已選擇的播放清單數量

### 2. 搜尋篩選
- 即時搜尋篩選播放清單
- 支援中文、英文等多語言搜尋
- 按 `Esc` 鍵清空搜尋內容
- 找不到結果時顯示提示訊息

### 3. 智能檢測
- 自動識別「儲存至播放清單」選單
- 不影響 YouTube 其他選單功能（如三點選單）
- 支援多語言介面（繁體中文、簡體中文、英文、日文、韓文等）

## 安裝方式

### 開發者模式安裝

1. 下載或 clone 此專案
   ```bash
   git clone https://github.com/b12031106/youtube-playlist-enhancer.git
   cd youtube-playlist-enhancer
   ```

2. 安裝依賴並建置
   ```bash
   npm install
   npm run build
   ```

3. 開啟 Chrome 擴充功能頁面
   - 在網址列輸入 `chrome://extensions/`
   - 開啟右上角的「開發人員模式」

4. 載入擴充功能
   - 點擊「載入未封裝項目」
   - 選擇專案中的 `dist` 資料夾

## 使用方式

1. 前往 YouTube 網站
2. 在任何影片上點擊「儲存」按鈕
3. 在彈出的播放清單選單中：
   - 使用搜尋框快速找到目標播放清單
   - 勾選要儲存的播放清單（可多選）
   - 點擊「儲存」按鈕完成操作

## 開發指南

### 專案結構

```
youtube-playlist-enhancer/
├── src/
│   ├── content/           # Content Script
│   │   ├── index.ts       # 入口點
│   │   ├── observer.ts    # DOM 監聽器
│   │   ├── enhancer.ts    # 增強功能協調器
│   │   ├── multiselect.ts # 多選功能
│   │   ├── search.ts      # 搜尋功能
│   │   ├── selectors.ts   # DOM 選擇器
│   │   ├── toast.ts       # Toast 通知
│   │   └── styles.css     # 樣式
│   ├── background/        # Service Worker
│   ├── types/             # TypeScript 型別定義
│   └── utils/             # 工具函數
├── dist/                  # 建置輸出
├── scripts/               # 輔助腳本
└── icons/                 # 擴充功能圖示
```

### 開發指令

```bash
# 安裝依賴
npm install

# 開發模式（監聽檔案變更）
npm run dev

# 生產建置
npm run build

# 程式碼檢查
npm run lint
npm run lint:fix

# 程式碼格式化
npm run format

# 打包成 zip 檔案
npm run package
```

### 版本發布

```bash
# 發布 patch 版本 (1.0.0 → 1.0.1)
npm run release:patch

# 發布 minor 版本 (1.0.0 → 1.1.0)
npm run release:minor

# 發布 major 版本 (1.0.0 → 2.0.0)
npm run release:major
```

版本發布會自動：
1. 更新 `package.json` 版本號
2. 同步更新 `manifest.json` 版本號
3. 建立 git tag
4. 推送到遠端

### Git Hooks

專案使用 Husky 設置 Git Hooks：

- **pre-commit**: 執行 ESLint 檢查
- **pre-push**: 執行 ESLint 和 Build 檢查

## 技術架構

- **TypeScript**: 型別安全的開發體驗
- **Webpack**: 模組打包
- **Manifest V3**: 最新的 Chrome 擴充功能標準
- **MutationObserver**: 監聽 YouTube 動態 DOM 變化
- **AbortController**: 可靠的事件監聽器管理

## 支援的頁面

- ✅ 單一影片頁面 (`/watch`)
- ✅ 首頁 (`/`)
- ✅ 訂閱頁面 (`/feed/subscriptions`)
- ✅ 搜尋結果頁面 (`/results`)
- ✅ 頻道頁面 (`/@channel`)
- ✅ 播放清單頁面 (`/playlist`)

## 瀏覽器支援

- Chrome 88+（Manifest V3 支援）
- Edge 88+（Chromium 版本）

## 授權條款

MIT License

## 貢獻

歡迎提交 Issue 和 Pull Request！
