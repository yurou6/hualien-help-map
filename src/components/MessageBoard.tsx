import React, { useState } from 'react';
import { imageService } from '../lib/supabase';

interface Message {
  id: string;
  author: string;
  content: string;
  timestamp: string;
  images?: string[];
}

interface MessageBoardProps {
  messages: Message[];
  onMessageAdd: (message: Omit<Message, 'id' | 'timestamp'>) => void;
}

const MessageBoard: React.FC<MessageBoardProps> = ({ messages, onMessageAdd }) => {
  const [newMessage, setNewMessage] = useState('');
  const [author, setAuthor] = useState('');
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreview, setImagePreview] = useState<string[]>([]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      // 限制最多 3 張圖片
      const limitedFiles = files.slice(0, 3);
      setSelectedImages(limitedFiles);
      
      // 創建預覽 URL
      const previews = limitedFiles.map(file => URL.createObjectURL(file));
      setImagePreview(previews);
    }
  };

  const removeImage = (index: number) => {
    const newImages = selectedImages.filter((_, i) => i !== index);
    const newPreviews = imagePreview.filter((_, i) => i !== index);
    setSelectedImages(newImages);
    setImagePreview(newPreviews);
  };

  const handleSubmitMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() && author.trim()) {
      // 處理圖片上傳
      let imageUrls: string[] = [];
      if (selectedImages.length > 0) {
        try {
          // 實際上傳圖片到 Supabase Storage
          const uploadPromises = selectedImages.map(async (file, index) => {
            const locationId = `message-${Date.now()}-${index}`;
            return await imageService.uploadImage(file, locationId);
          });
          
          const uploadResults = await Promise.all(uploadPromises);
          imageUrls = uploadResults.filter((url): url is string => url !== null);
          console.log('留言圖片上傳成功:', imageUrls);
        } catch (error) {
          console.error('圖片上傳失敗:', error);
          alert('圖片上傳失敗，請重試');
          return;
        }
      }

      onMessageAdd({
        author: author.trim(),
        content: newMessage.trim(),
        images: imageUrls.length > 0 ? imageUrls : undefined,
      });
      setNewMessage('');
      setSelectedImages([]);
      setImagePreview([]);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="message-board">
      <h4>留言板</h4>
      
      <div className="messages-list">
        {messages.length > 0 ? (
          messages.map((message) => (
            <div key={message.id} className="message-item">
              <div className="message-header">
                <span className="message-author">{message.author}</span>
                <span className="message-time">{formatTimestamp(message.timestamp)}</span>
              </div>
              <div className="message-content">{message.content}</div>
              {message.images && message.images.length > 0 && (
                <div className="message-images">
                  {message.images.map((image, index) => (
                    <div key={index} className="message-image-container">
                      <img 
                        src={image} 
                        alt={`留言圖片 ${index + 1}`}
                        className="message-image"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const fallback = target.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                      <div className="image-fallback" style={{ display: 'none' }}>
                        <span>📷 圖片載入失敗</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="no-messages">目前沒有留言</p>
        )}
      </div>

      <form onSubmit={handleSubmitMessage} className="message-form">
        <div className="form-group">
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="您的姓名"
            required
            maxLength={20}
          />
        </div>
        <div className="form-group">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="輸入留言內容..."
            required
            maxLength={500}
            rows={3}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="message-images" className="image-upload-label">
            📷 新增圖片 (可選，最多3張)
          </label>
          <input
            id="message-images"
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

        <button type="submit" className="submit-message-btn">
          發送留言
        </button>
      </form>
    </div>
  );
};

export default MessageBoard;
