import React, { useState, useEffect } from 'react';
import { ChannelInfo, ChannelType, ChannelStatus, channelService, imageService } from '../lib/supabase';
import './ChannelArea.css';

interface ChannelAreaProps {
  onClose: () => void;
}

const ChannelArea: React.FC<ChannelAreaProps> = ({ onClose }) => {
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<ChannelInfo | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeTab, setActiveTab] = useState<ChannelType>('求助');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreview, setImagePreview] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<ChannelStatus | '全部'>('全部');

  // 優先級配置
  const priorityConfig = {
    '低': { color: '#4caf50', icon: '🟢', bgColor: '#e8f5e8' },
    '中': { color: '#ff9800', icon: '🟡', bgColor: '#fff3e0' },
    '高': { color: '#f44336', icon: '🔴', bgColor: '#ffebee' },
    '緊急': { color: '#9c27b0', icon: '🚨', bgColor: '#f3e5f5' }
  };

  // 狀態配置
  const statusConfig = {
    '進行中': { color: '#1976d2', icon: '🟢', bgColor: '#e3f2fd' },
    '已解決': { color: '#388e3c', icon: '✅', bgColor: '#e8f5e8' },
    '已過期': { color: '#616161', icon: '⏰', bgColor: '#f5f5f5' }
  };

  // 載入頻道資料
  useEffect(() => {
    const loadChannels = async () => {
      try {
        setIsLoading(true);
        const allChannels = await channelService.getAllChannels();
        setChannels(allChannels);
      } catch (error) {
        console.error('載入頻道失敗:', error);
        alert('載入頻道失敗，請檢查網路連線');
      } finally {
        setIsLoading(false);
      }
    };

    loadChannels();
  }, []);

  // 設定即時同步
  useEffect(() => {
    const subscription = channelService.subscribeToChannels((channels) => {
      setChannels(channels);
    });

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  // 處理圖片選擇
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const limitedFiles = files.slice(0, 3);
      setSelectedImages(limitedFiles);
      
      const previews = limitedFiles.map(file => URL.createObjectURL(file));
      setImagePreview(previews);
    }
  };

  // 移除圖片
  const removeImage = (index: number) => {
    const newImages = selectedImages.filter((_, i) => i !== index);
    const newPreviews = imagePreview.filter((_, i) => i !== index);
    setSelectedImages(newImages);
    setImagePreview(newPreviews);
  };

  // 新增頻道資訊
  const handleAddChannel = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // 處理圖片上傳
    let imageUrls: string[] = [];
    if (selectedImages.length > 0) {
      try {
        const uploadPromises = selectedImages.map(async (file, index) => {
          const channelId = `channel-${Date.now()}-${index}`;
          return await imageService.uploadImage(file, channelId);
        });
        
        const uploadResults = await Promise.all(uploadPromises);
        imageUrls = uploadResults.filter((url): url is string => url !== null);
      } catch (error) {
        console.error('圖片上傳失敗:', error);
        alert('圖片上傳失敗，請重試');
        return;
      }
    }

    const newChannel: Omit<ChannelInfo, 'id' | 'created_at' | 'updated_at'> = {
      type: activeTab,
      title: formData.get('title') as string,
      content: formData.get('content') as string,
      status: '進行中',
      priority: formData.get('priority') as '低' | '中' | '高' | '緊急',
      author: formData.get('author') as string,
      contact: formData.get('contact') as string,
      images: imageUrls,
      tags: (formData.get('tags') as string).split(',').map(tag => tag.trim()).filter(tag => tag),
      location: formData.get('locationName') ? {
        name: formData.get('locationName') as string,
        lat: formData.get('locationLat') ? parseFloat(formData.get('locationLat') as string) : undefined,
        lng: formData.get('locationLng') ? parseFloat(formData.get('locationLng') as string) : undefined
      } : undefined,
      expires_at: (formData.get('expiresAt') as string) || undefined
    };

    try {
      const savedChannel = await channelService.addChannel(newChannel);
      if (savedChannel) {
        setChannels([savedChannel, ...channels]);
        setShowAddForm(false);
        setSelectedImages([]);
        setImagePreview([]);
        // 重置表單
        (e.target as HTMLFormElement).reset();
      } else {
        alert('新增失敗，請重試');
      }
    } catch (error) {
      console.error('新增頻道失敗:', error);
      alert('新增頻道失敗，請檢查網路連線');
    }
  };

  // 更新頻道狀態
  const handleUpdateStatus = async (channel: ChannelInfo, newStatus: ChannelStatus) => {
    try {
      const updatedChannel = await channelService.updateChannel(channel.id, { status: newStatus });
      if (updatedChannel) {
        setChannels(channels.map(c => c.id === channel.id ? updatedChannel : c));
        setSelectedChannel(updatedChannel);
      }
    } catch (error) {
      console.error('更新狀態失敗:', error);
      alert('更新狀態失敗，請重試');
    }
  };

  // 篩選頻道
  const filteredChannels = channels.filter(channel => {
    const typeMatch = channel.type === activeTab;
    const statusMatch = statusFilter === '全部' || channel.status === statusFilter;
    return typeMatch && statusMatch;
  });

  if (isLoading) {
    return (
      <div className="channel-area">
        <div className="channel-header">
          <h2>頻道區</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="channel-area">
      <div className="channel-header">
        <h2>頻道區</h2>
        <button onClick={onClose} className="close-btn">×</button>
      </div>

      {/* 標籤頁 */}
      <div className="channel-tabs">
        <button 
          className={`tab-btn ${activeTab === '求助' ? 'active' : ''}`}
          onClick={() => setActiveTab('求助')}
        >
          🆘 求助資訊
        </button>
        <button 
          className={`tab-btn ${activeTab === '快訊' ? 'active' : ''}`}
          onClick={() => setActiveTab('快訊')}
        >
          📢 最新快訊
        </button>
        <button 
          className={`tab-btn ${activeTab === '一般' ? 'active' : ''}`}
          onClick={() => setActiveTab('一般')}
        >
          ⚠️ 注意事項
        </button>
      </div>

      {/* 狀態篩選器 */}
      <div className="status-filter-section">
        <div className="status-filter-label">
          <span>狀態篩選：</span>
        </div>
        <div className="status-filter-buttons">
          {(['全部', '進行中', '已解決', '已過期'] as (ChannelStatus | '全部')[]).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`status-filter-btn ${
                statusFilter === status ? 'active' : ''
              } status-${status}`}
            >
              {status === '全部' && '📋'}
              {status === '進行中' && '🟢'}
              {status === '已解決' && '✅'}
              {status === '已過期' && '⏰'}
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* 新增按鈕 */}
      <div className="channel-actions">
        <button 
          onClick={() => setShowAddForm(true)}
          className="add-channel-btn"
        >
          ➕ 新增{activeTab === '求助' ? '求助' : activeTab === '快訊' ? '快訊' : '注意事項'}
        </button>
      </div>

      {/* 頻道列表 */}
      <div className="channel-list">
        {filteredChannels.length === 0 ? (
          <div className="no-channels">
            <p>
              目前沒有{activeTab === '求助' ? '求助' : activeTab === '快訊' ? '快訊' : '注意事項'}
              {statusFilter !== '全部' && `（狀態：${statusFilter}）`}
            </p>
            {statusFilter !== '全部' && (
              <button 
                onClick={() => setStatusFilter('全部')}
                className="clear-filter-btn"
              >
                清除篩選
              </button>
            )}
          </div>
        ) : (
          filteredChannels.map((channel) => (
            <div 
              key={channel.id} 
              className={`channel-item priority-${channel.priority}`}
              onClick={() => setSelectedChannel(channel)}
            >
              <div className="channel-item-header">
                <div className="channel-badges">
                  <span className={`priority-badge priority-${channel.priority}`}>
                    {priorityConfig[channel.priority].icon} {channel.priority}
                  </span>
                  <span className={`status-badge status-${channel.status}`}>
                    {statusConfig[channel.status].icon} {channel.status}
                  </span>
                </div>
                <div className="channel-meta">
                  <span className="channel-author">👤 {channel.author}</span>
                  <span className="channel-date">
                    {new Date(channel.created_at).toLocaleString('zh-TW')}
                  </span>
                </div>
              </div>
              
              <h3 className="channel-title">{channel.title}</h3>
              <p className="channel-content">{channel.content}</p>
              
              {channel.tags.length > 0 && (
                <div className="channel-tags">
                  {channel.tags.map((tag, index) => (
                    <span key={index} className="tag">#{tag}</span>
                  ))}
                </div>
              )}
              
              {channel.location && (
                <div className="channel-location">
                  📍 {channel.location.name}
                </div>
              )}
              
              <div className="channel-contact">
                📞 {channel.contact}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 新增表單 */}
      {showAddForm && (
        <div className="add-channel-modal">
          <div className="modal-content">
            <h3>新增{activeTab === '求助' ? '求助' : activeTab === '快訊' ? '快訊' : '注意事項'}</h3>
            <form onSubmit={handleAddChannel}>
              <input
                type="text"
                name="title"
                placeholder="標題"
                required
              />
              
              <textarea
                name="content"
                placeholder="詳細內容"
                required
                rows={4}
              />
              
              <div className="form-row">
                <input
                  type="text"
                  name="author"
                  placeholder="您的姓名"
                  required
                />
                <input
                  type="text"
                  name="contact"
                  placeholder="聯絡方式"
                  required
                />
              </div>
              
              <div className="form-row">
                <select name="priority" required>
                  <option value="低">🟢 低優先級</option>
                  <option value="中">🟡 中優先級</option>
                  <option value="高">🔴 高優先級</option>
                  <option value="緊急">🚨 緊急</option>
                </select>
                <input
                  type="text"
                  name="tags"
                  placeholder="標籤（用逗號分隔）"
                />
              </div>
              
              <div className="form-row">
                <input
                  type="text"
                  name="locationName"
                  placeholder="地點名稱（選填）"
                />
                <input
                  type="datetime-local"
                  name="expiresAt"
                  placeholder="過期時間（選填）"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="channel-images" className="image-upload-label">
                  📷 新增圖片 (可選，最多3張)
                </label>
                <input
                  id="channel-images"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="image-upload-input"
                />
              </div>

              {imagePreview.length > 0 && (
                <div className="image-preview-container">
                  <p className="preview-label">預覽圖片：</p>
                  <div className="image-preview-list">
                    {imagePreview.map((preview, index) => (
                      <div key={index} className="image-preview-item">
                        <img src={preview} alt={`預覽 ${index + 1}`} className="preview-image" />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="remove-image-btn"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="form-actions">
                <button type="submit">新增</button>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowAddForm(false);
                    setSelectedImages([]);
                    setImagePreview([]);
                  }}
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 頻道詳情 */}
      {selectedChannel && (
        <div className="channel-details">
          <div className="channel-details-container">
            {/* 左側：主要資訊 */}
            <div className="channel-details-left">
              <div className="channel-details-header">
                <div className="channel-details-badges">
                  <span className={`priority-badge priority-${selectedChannel.priority}`}>
                    {priorityConfig[selectedChannel.priority].icon} {selectedChannel.priority}
                  </span>
                  <span className={`status-badge status-${selectedChannel.status}`}>
                    {statusConfig[selectedChannel.status].icon} {selectedChannel.status}
                  </span>
                </div>
                <button onClick={() => setSelectedChannel(null)} className="close-btn">×</button>
              </div>
              
              <h3>{selectedChannel.title}</h3>
              <p className="channel-details-content">{selectedChannel.content}</p>
              
              <div className="channel-details-meta">
                <div className="meta-item">
                  <span className="meta-label">👤 發布者：</span>
                  <span className="meta-value">{selectedChannel.author}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">📅 發布時間：</span>
                  <span className="meta-value">{new Date(selectedChannel.created_at).toLocaleString('zh-TW')}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">📞 聯絡方式：</span>
                  <span className="meta-value">{selectedChannel.contact}</span>
                </div>
                {selectedChannel.location && (
                  <div className="meta-item">
                    <span className="meta-label">📍 地點：</span>
                    <span className="meta-value">{selectedChannel.location.name}</span>
                  </div>
                )}
                {selectedChannel.expires_at && (
                  <div className="meta-item">
                    <span className="meta-label">⏰ 過期時間：</span>
                    <span className="meta-value">{new Date(selectedChannel.expires_at).toLocaleString('zh-TW')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 右側：圖片、標籤、狀態管理 */}
            <div className="channel-details-right">
              {selectedChannel.images.length > 0 && (
                <div className="channel-details-images">
                  <div className="images-section-header">
                    <h4>相關圖片</h4>
                    <span className="image-count">({selectedChannel.images.length} 張)</span>
                  </div>
                  <div className="channel-images-list">
                    {selectedChannel.images.map((image, index) => (
                      <div key={index} className="channel-image-wrapper">
                        <div className="channel-image-container">
                          <img 
                            src={image} 
                            alt={`圖片 ${index + 1}`}
                            className="channel-image"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const fallback = target.nextElementSibling as HTMLElement;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                          <div className="image-fallback" style={{ display: 'none' }}>
                            <span>📷</span>
                          </div>
                        </div>
                        <div className="image-overlay">
                          <span className="image-index">{index + 1}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {selectedChannel.tags.length > 0 && (
                <div className="channel-details-tags">
                  <h4>標籤</h4>
                  <div className="tags-list">
                    {selectedChannel.tags.map((tag, index) => (
                      <span key={index} className="tag">#{tag}</span>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="channel-status-controls">
                <h4>狀態管理</h4>
                <div className="status-buttons">
                  {(['進行中', '已解決', '已過期'] as ChannelStatus[]).map((status) => (
                    <button
                      key={status}
                      onClick={() => handleUpdateStatus(selectedChannel, status)}
                      className={`status-control-btn ${
                        selectedChannel.status === status ? 'active' : ''
                      } status-${status}`}
                    >
                      {statusConfig[status].icon} {status}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChannelArea;
