# 花蓮互助地圖

一個幫助花蓮地區災後重建和資源分配的協作地圖應用。

## 功能特色

- 🗺️ **互動式地圖**：使用 Leaflet.js 顯示花蓮地區地圖
- 📍 **位置標記**：標記需要幫助的地點，支援分類標籤
- 📦 **物資清單**：管理每個位置的物資需求
- 📸 **圖片上傳**：上傳相關照片
- 💬 **留言板**：即時溝通和協作
- 🔍 **搜尋功能**：搜尋地標、分類、物資或地址
- 📍 **地址輸入**：直接輸入地址轉換為地圖位置
- 📍 **我的位置**：一鍵發送當前位置
- 🏷️ **分類篩選**：按交通、住宿、物資、勞力、醫療、通訊等分類
- ✅ **狀態管理**：進行中/已完成狀態管理
- 📋 **已完成清單**：查看所有已完成的地標
- 👥 **多人共編**：即時同步更新
- 📱 **響應式設計**：支援手機和桌面裝置

## 技術架構

- **前端**：React + TypeScript
- **地圖服務**：Leaflet.js + OpenStreetMap
- **後端**：Supabase (PostgreSQL + 即時同步)
- **部署**：GitHub Pages

## 快速開始

### 1. 安裝依賴

```bash
npm install
```

### 2. 設定 Supabase

1. 到 [Supabase](https://supabase.com) 建立新專案
2. 複製 `.env.example` 為 `.env.local`
3. 填入你的 Supabase 專案 URL 和 API Key

### 3. 設定資料庫

在 Supabase SQL 編輯器中執行以下 SQL：

```sql
-- 建立位置表格
CREATE TABLE locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  position JSONB NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '其他',
  status TEXT DEFAULT '進行中',
  supplies TEXT[] DEFAULT '{}',
  images TEXT[] DEFAULT '{}',
  messages JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 建立即時更新觸發器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 設定 RLS (Row Level Security)
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- 允許所有人讀取和寫入（公開協作）
CREATE POLICY "Allow all operations" ON locations
  FOR ALL USING (true) WITH CHECK (true);
```

### 4. 設定 Storage

1. 在 Supabase 控制台建立 Storage bucket 名為 `location-images`
2. 設定公開存取權限

### 5. 啟動開發伺服器

```bash
npm start
```

## 部署到 GitHub Pages

### 1. 建立 GitHub 儲存庫

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-username/hualien-help-map.git
git push -u origin main
```

### 2. 設定 GitHub Pages

1. 到 GitHub 儲存庫的 Settings > Pages
2. 選擇 "Deploy from a branch"
3. 選擇 "gh-pages" 分支
4. 設定 Source 為 "GitHub Actions"

### 3. 建立部署腳本

建立 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Build
      run: npm run build
      env:
        REACT_APP_SUPABASE_URL: ${{ secrets.REACT_APP_SUPABASE_URL }}
        REACT_APP_SUPABASE_ANON_KEY: ${{ secrets.REACT_APP_SUPABASE_ANON_KEY }}
        
    - name: Deploy to GitHub Pages
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./build
```

## 使用方式

1. **瀏覽地圖**：地圖會自動定位到花蓮市中心
2. **新增位置**：點擊地圖上任意位置，輸入位置資訊
3. **管理物資**：為每個位置新增需要的物資清單
4. **上傳圖片**：為位置新增相關圖片
5. **留言互動**：在每個位置留下訊息

## 貢獻

歡迎提交 Issue 和 Pull Request 來改善這個專案！

## 授權

MIT License