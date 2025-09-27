import { createClient } from '@supabase/supabase-js';

// 從環境變數讀取 Supabase 配置
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// 檢查環境變數是否存在
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('請設定正確的 REACT_APP_SUPABASE_URL 和 REACT_APP_SUPABASE_ANON_KEY 環境變數');
}

// 檢查環境變數是否正確載入
console.log('Supabase 配置已載入');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 位置分類類型
export type LocationCategory = '交通' | '住宿' | '物資' | '勞力' | '醫療' | '通訊' | '其他';
export type LocationStatus = '進行中' | '已完成';

// 頻道類型
export type ChannelType = '求助' | '快訊' | '一般';
export type ChannelStatus = '進行中' | '已解決' | '已過期';

// 資料庫表格類型定義
export interface LocationMarker {
  id: string;
  position: [number, number];
  title: string;
  description: string;
  category: LocationCategory;
  status?: LocationStatus; // 暫時設為可選，因為資料庫可能還沒有這個欄位
  supplies: string[];
  images: string[];
  messages: Array<{
    id: string;
    author: string;
    content: string;
    timestamp: string;
    images?: string[];
  }>;
  created_at: string;
  updated_at: string;
}

// 頻道資訊介面
export interface ChannelInfo {
  id: string;
  type: ChannelType;
  title: string;
  content: string;
  status: ChannelStatus;
  priority: '低' | '中' | '高' | '緊急';
  author: string;
  contact: string;
  images: string[];
  tags: string[];
  location?: {
    name: string;
    lat?: number;
    lng?: number;
  };
  created_at: string;
  updated_at: string;
  expires_at?: string;
}

// 資料庫操作函數
export const locationService = {
  // 獲取所有位置標記
  async getAllLocations(): Promise<LocationMarker[]> {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('獲取位置失敗:', error);
      return [];
    }

    return data || [];
  },

  // 新增位置標記
  async addLocation(location: Omit<LocationMarker, 'id' | 'created_at' | 'updated_at'>): Promise<LocationMarker | null> {
    console.log('準備新增位置，包含圖片:', location.images);
    
    const { data, error } = await supabase
      .from('locations')
      .insert([location])
      .select()
      .single();

    if (error) {
      console.error('新增位置失敗:', error);
      return null;
    }
    
    console.log('位置新增成功，返回資料:', data);

    return data;
  },

  // 更新位置標記
  async updateLocation(id: string, updates: Partial<LocationMarker>): Promise<LocationMarker | null> {
    const { data, error } = await supabase
      .from('locations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('更新位置失敗:', error);
      return null;
    }

    return data;
  },

  // 刪除位置標記
  async deleteLocation(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('locations')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('刪除位置失敗:', error);
      return false;
    }

    return true;
  },

  // 訂閱位置變更（即時更新）
  subscribeToLocations(callback: (locations: LocationMarker[]) => void) {
    return supabase
      .channel('locations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'locations'
        },
        async () => {
          const locations = await this.getAllLocations();
          callback(locations);
        }
      )
      .subscribe();
  }
};

// 圖片上傳服務
export const imageService = {
  // 上傳圖片到 Supabase Storage
  async uploadImage(file: File, locationId: string): Promise<string | null> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${locationId}_${Date.now()}.${fileExt}`;
    const filePath = `images/${fileName}`;

    const { error } = await supabase.storage
      .from('location-images')
      .upload(filePath, file);

    if (error) {
      console.error('圖片上傳失敗:', error);
      console.error('錯誤詳情:', error.message);
      console.error('完整錯誤物件:', error);
      return null;
    }

    // 獲取公開 URL
    const { data: { publicUrl } } = supabase.storage
      .from('location-images')
      .getPublicUrl(filePath);

    console.log('圖片上傳成功，URL:', publicUrl);
    return publicUrl;
  },

  // 刪除圖片
  async deleteImage(imageUrl: string): Promise<boolean> {
    try {
      const fileName = imageUrl.split('/').pop();
      const { error } = await supabase.storage
        .from('location-images')
        .remove([`images/${fileName}`]);

      if (error) {
        console.error('圖片刪除失敗:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('圖片刪除失敗:', error);
      return false;
    }
  }
};

// 頻道資訊服務
export const channelService = {
  // 獲取所有頻道資訊
  async getAllChannels(): Promise<ChannelInfo[]> {
    const { data, error } = await supabase
      .from('channels')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('獲取頻道資訊失敗:', error);
      return [];
    }

    return data || [];
  },

  // 根據類型獲取頻道資訊
  async getChannelsByType(type: ChannelType): Promise<ChannelInfo[]> {
    const { data, error } = await supabase
      .from('channels')
      .select('*')
      .eq('type', type)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('獲取頻道資訊失敗:', error);
      return [];
    }

    return data || [];
  },

  // 新增頻道資訊
  async addChannel(channel: Omit<ChannelInfo, 'id' | 'created_at' | 'updated_at'>): Promise<ChannelInfo | null> {
    const { data, error } = await supabase
      .from('channels')
      .insert([channel])
      .select()
      .single();

    if (error) {
      console.error('新增頻道資訊失敗:', error);
      return null;
    }

    return data;
  },

  // 更新頻道資訊
  async updateChannel(id: string, updates: Partial<ChannelInfo>): Promise<ChannelInfo | null> {
    const { data, error } = await supabase
      .from('channels')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('更新頻道資訊失敗:', error);
      return null;
    }

    return data;
  },

  // 刪除頻道資訊
  async deleteChannel(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('channels')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('刪除頻道資訊失敗:', error);
      return false;
    }

    return true;
  },

  // 訂閱頻道變更（即時更新）
  subscribeToChannels(callback: (channels: ChannelInfo[]) => void) {
    return supabase
      .channel('channels_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channels'
        },
        async () => {
          const channels = await this.getAllChannels();
          callback(channels);
        }
      )
      .subscribe();
  }
};
