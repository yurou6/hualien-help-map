import React, { useState, useRef } from 'react';

interface ImageUploadProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  isEditable?: boolean;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ images, onImagesChange, isEditable = false }) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    
    try {
      // 模擬圖片上傳（實際專案中會上傳到 Supabase Storage）
      const newImages: string[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          // 創建預覽 URL
          const previewUrl = URL.createObjectURL(file);
          newImages.push(previewUrl);
        }
      }
      
      onImagesChange([...images, ...newImages]);
    } catch (error) {
      console.error('圖片上傳失敗:', error);
      alert('圖片上傳失敗，請重試');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    if (isEditable) {
      const newImages = images.filter((_, i) => i !== index);
      onImagesChange(newImages);
    }
  };

  const handleUploadClick = () => {
    if (isEditable) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="image-upload">
      <h4>相關圖片</h4>
      
      <div className="images-grid">
        {images.map((image, index) => (
          <div key={index} className="image-item">
            <img src={image} alt={`上傳圖片 ${index + 1}`} />
            {isEditable && (
              <button 
                onClick={() => handleRemoveImage(index)}
                className="remove-image-btn"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {isEditable && (
        <div className="upload-section">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            style={{ display: 'none' }}
          />
          <button 
            onClick={handleUploadClick}
            className="upload-btn"
            disabled={isUploading}
          >
            {isUploading ? '上傳中...' : '上傳圖片'}
          </button>
          <p className="upload-hint">支援 JPG、PNG 格式，最多 5 張圖片</p>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;
