-- 建立 channels 表格
CREATE TABLE IF NOT EXISTS channels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('求助', '快訊', '一般')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT '進行中' CHECK (status IN ('進行中', '已解決', '已過期')),
  priority TEXT NOT NULL CHECK (priority IN ('低', '中', '高', '緊急')),
  author TEXT NOT NULL,
  contact TEXT,
  images TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  location JSONB,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_channels_type ON channels(type);
CREATE INDEX IF NOT EXISTS idx_channels_status ON channels(status);
CREATE INDEX IF NOT EXISTS idx_channels_priority ON channels(priority);
CREATE INDEX IF NOT EXISTS idx_channels_created_at ON channels(created_at DESC);

-- 建立 updated_at 自動更新觸發器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 為 channels 表格建立 updated_at 觸發器（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_channels_updated_at') THEN
        CREATE TRIGGER update_channels_updated_at 
            BEFORE UPDATE ON channels 
            FOR EACH ROW 
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 啟用 Row Level Security (RLS)
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;

-- 建立 RLS 政策 - 允許所有人讀取
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'channels' AND policyname = 'Allow public read access') THEN
        CREATE POLICY "Allow public read access" ON channels
            FOR SELECT USING (true);
    END IF;
END $$;

-- 建立 RLS 政策 - 允許所有人插入
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'channels' AND policyname = 'Allow public insert access') THEN
        CREATE POLICY "Allow public insert access" ON channels
            FOR INSERT WITH CHECK (true);
    END IF;
END $$;

-- 建立 RLS 政策 - 允許所有人更新
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'channels' AND policyname = 'Allow public update access') THEN
        CREATE POLICY "Allow public update access" ON channels
            FOR UPDATE USING (true);
    END IF;
END $$;

-- 建立 RLS 政策 - 允許所有人刪除
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'channels' AND policyname = 'Allow public delete access') THEN
        CREATE POLICY "Allow public delete access" ON channels
            FOR DELETE USING (true);
    END IF;
END $$;

-- 如果還沒有 locations 表格，也建立它
CREATE TABLE IF NOT EXISTS locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  position POINT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('交通', '住宿', '物資', '勞力', '醫療', '通訊', '其他')),
  status TEXT DEFAULT '進行中' CHECK (status IN ('進行中', '已完成')),
  supplies TEXT[] DEFAULT '{}',
  images TEXT[] DEFAULT '{}',
  messages JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 為 locations 表格建立索引
CREATE INDEX IF NOT EXISTS idx_locations_category ON locations(category);
CREATE INDEX IF NOT EXISTS idx_locations_status ON locations(status);
CREATE INDEX IF NOT EXISTS idx_locations_created_at ON locations(created_at DESC);

-- 為 locations 表格建立 updated_at 觸發器（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_locations_updated_at') THEN
        CREATE TRIGGER update_locations_updated_at 
            BEFORE UPDATE ON locations 
            FOR EACH ROW 
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 啟用 locations 的 RLS
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- 建立 locations 的 RLS 政策
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'locations' AND policyname = 'Allow public read access') THEN
        CREATE POLICY "Allow public read access" ON locations
            FOR SELECT USING (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'locations' AND policyname = 'Allow public insert access') THEN
        CREATE POLICY "Allow public insert access" ON locations
            FOR INSERT WITH CHECK (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'locations' AND policyname = 'Allow public update access') THEN
        CREATE POLICY "Allow public update access" ON locations
            FOR UPDATE USING (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'locations' AND policyname = 'Allow public delete access') THEN
        CREATE POLICY "Allow public delete access" ON locations
            FOR DELETE USING (true);
    END IF;
END $$;
