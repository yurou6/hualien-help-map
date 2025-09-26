import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import { Icon, DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';
import SupplyList from './components/SupplyList';
import MessageBoard from './components/MessageBoard';
import CompletedList from './components/CompletedList';
import { locationService, imageService, LocationMarker, LocationCategory, LocationStatus } from './lib/supabase';

// 修復 Leaflet 預設圖標問題
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (Icon.Default.prototype as any)._getIconUrl;
Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// 花蓮市中心座標
const HUALIEN_CENTER: [number, number] = [23.9739, 121.6014];

// 分類圖示和顏色對應
const categoryConfig = {
  '交通': { color: '#1976d2', icon: '🚗', bgColor: '#e3f2fd' },
  '住宿': { color: '#7b1fa2', icon: '🏠', bgColor: '#f3e5f5' },
  '物資': { color: '#388e3c', icon: '📦', bgColor: '#e8f5e8' },
  '勞力': { color: '#f57c00', icon: '👷', bgColor: '#fff3e0' },
  '醫療': { color: '#d32f2f', icon: '🏥', bgColor: '#ffebee' },
  '通訊': { color: '#00695c', icon: '📡', bgColor: '#e0f2f1' },
  '其他': { color: '#616161', icon: '📍', bgColor: '#f5f5f5' }
};

// 建立自訂地標圖標
const createCustomIcon = (category: LocationCategory) => {
  const config = categoryConfig[category];
  
  return new DivIcon({
    html: `
      <div style="
        background-color: ${config.bgColor};
        border: 3px solid ${config.color};
        border-radius: 50%;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        position: relative;
      ">
        <span style="color: ${config.color};">${config.icon}</span>
      </div>
    `,
    className: 'custom-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
  });
};

function MapClickHandler({ onLocationAdd }: { onLocationAdd: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;
      onLocationAdd(lat, lng);
    },
  });
  return null;
}

function App() {
  const [markers, setMarkers] = useState<LocationMarker[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<LocationMarker | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLocation, setNewLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState<LocationCategory[]>([]);
  const [selectedLocationImages, setSelectedLocationImages] = useState<File[]>([]);
  const [locationImagePreview, setLocationImagePreview] = useState<string[]>([]);
  const [showCompletedList, setShowCompletedList] = useState(false);
  // const [statusFilter, setStatusFilter] = useState<LocationStatus>('進行中'); // 暫時註解掉
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationMarker[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [locationSearchResults, setLocationSearchResults] = useState<any[]>([]);
  const [isLocationSearching, setIsLocationSearching] = useState(false);
  const [showAddressInput, setShowAddressInput] = useState(false);
  const [addressInput, setAddressInput] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);

  const handleLocationAdd = (lat: number, lng: number) => {
    setNewLocation({ lat, lng });
    setShowAddForm(true);
  };

  const handleLocationImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      // 限制最多 3 張圖片
      const limitedFiles = files.slice(0, 3);
      setSelectedLocationImages(limitedFiles);
      
      // 創建預覽 URL
      const previews = limitedFiles.map(file => URL.createObjectURL(file));
      setLocationImagePreview(previews);
    }
  };

  const removeLocationImage = (index: number) => {
    const newImages = selectedLocationImages.filter((_, i) => i !== index);
    const newPreviews = locationImagePreview.filter((_, i) => i !== index);
    setSelectedLocationImages(newImages);
    setLocationImagePreview(newPreviews);
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setLocationSearchResults([]);
      setIsSearching(false);
      setIsLocationSearching(false);
      return;
    }

    // 先搜尋現有的地標
    setIsSearching(true);
    const existingResults = markers.filter(marker => 
      marker.title.toLowerCase().includes(query.toLowerCase()) ||
      marker.description.toLowerCase().includes(query.toLowerCase()) ||
      marker.category.toLowerCase().includes(query.toLowerCase()) ||
      marker.supplies.some(supply => supply.toLowerCase().includes(query.toLowerCase()))
    );
    setSearchResults(existingResults);

    // 搜尋實際地點（使用 OpenStreetMap Nominatim API，限制在台灣）
    try {
      setIsLocationSearching(true);
      
      // 先嘗試精確的花蓮地區搜尋
      let response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ' 花蓮縣')}&limit=3&addressdetails=1&countrycodes=tw&accept-language=zh-TW`
      );
      let data = await response.json();
      
      // 如果結果太少，再嘗試台灣地區搜尋
      if (data.length < 2) {
        response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ' 台灣')}&limit=5&addressdetails=1&countrycodes=tw&accept-language=zh-TW`
        );
        data = await response.json();
      }
      
      // 過濾掉中國的地點，只保留台灣的地點
      const taiwanResults = data.filter((location: any) => {
        const address = location.display_name.toLowerCase();
        const isChina = address.includes('china') || 
                       address.includes('中國') || 
                       address.includes('大陆') ||
                       address.includes('beijing') ||
                       address.includes('shanghai');
        const isTaiwan = address.includes('台灣') || 
                        address.includes('taiwan') || 
                        address.includes('花蓮') ||
                        address.includes('hualien') ||
                        address.includes('taipei') ||
                        address.includes('kaohsiung');
        return !isChina && isTaiwan;
      });
      
      // 如果沒有找到結果，提供一些常見的花蓮地點
      if (taiwanResults.length === 0) {
        const commonHualienPlaces = [
          { display_name: '花蓮火車站', lat: '23.9931', lon: '121.6014', type: 'station', class: 'railway' },
          { display_name: '花蓮市公所', lat: '23.9739', lon: '121.6014', type: 'government', class: 'office' },
          { display_name: '花蓮醫院', lat: '23.9739', lon: '121.6014', type: 'hospital', class: 'healthcare' },
          { display_name: '花蓮高中', lat: '23.9739', lon: '121.6014', type: 'school', class: 'education' },
          { display_name: '花蓮港', lat: '23.9739', lon: '121.6014', type: 'port', class: 'transport' }
        ];
        
        const filteredCommonPlaces = commonHualienPlaces.filter(place => 
          place.display_name.toLowerCase().includes(query.toLowerCase())
        );
        
        if (filteredCommonPlaces.length > 0) {
          setLocationSearchResults(filteredCommonPlaces);
        } else {
          setLocationSearchResults([]);
        }
      } else {
        setLocationSearchResults(taiwanResults);
      }
    } catch (error) {
      console.error('地點搜尋失敗:', error);
      setLocationSearchResults([]);
    } finally {
      setIsLocationSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setLocationSearchResults([]);
    setIsSearching(false);
    setIsLocationSearching(false);
  };

  const focusOnMarker = (marker: LocationMarker) => {
    // 這裡可以添加地圖縮放和聚焦到特定標記的功能
    setSelectedMarker(marker);
  };

  const handleLocationSearchSelect = (location: any) => {
    const lat = parseFloat(location.lat);
    const lng = parseFloat(location.lon);
    setNewLocation({ lat, lng });
    setShowAddForm(true);
    clearSearch();
  };

  const handleAddressGeocode = async (address: string) => {
    if (!address.trim()) return;

    try {
      setIsGeocoding(true);
      
      // 嘗試多種搜尋策略
      let searchQueries = [
        address, // 原始地址
        address + ' 台灣', // 加上台灣
        address + ' 花蓮', // 加上花蓮
        address.replace('花蓮縣', '').replace('花蓮市', '').trim() + ' 花蓮縣', // 簡化地址
      ];

      let result = null;
      
      for (const query of searchQueries) {
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&addressdetails=1&countrycodes=tw&accept-language=zh-TW`
          );
          const data = await response.json();
          
          if (data.length > 0) {
            result = data[0];
            break;
          }
        } catch (err) {
          console.log('搜尋策略失敗:', query);
          continue;
        }
      }
      
      if (result) {
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        setNewLocation({ lat, lng });
        setShowAddForm(true);
        setShowAddressInput(false);
        setAddressInput('');
      } else {
        // 如果都找不到，提供一些常見的花蓮地址選項
        const commonAddresses = [
          { name: '花蓮火車站', lat: 23.9931, lng: 121.6014 },
          { name: '花蓮市公所', lat: 23.9739, lng: 121.6014 },
          { name: '花蓮醫院', lat: 23.9739, lng: 121.6014 },
          { name: '花蓮港', lat: 23.9739, lng: 121.6014 }
        ];
        
        const selectedAddress = commonAddresses.find(addr => 
          address.includes(addr.name) || addr.name.includes(address.split('縣')[0])
        );
        
        if (selectedAddress) {
          setNewLocation({ lat: selectedAddress.lat, lng: selectedAddress.lng });
          setShowAddForm(true);
          setShowAddressInput(false);
          setAddressInput('');
        } else {
          // 提供地址建議
          const suggestions = [
            '花蓮火車站',
            '花蓮市公所', 
            '花蓮醫院',
            '花蓮港',
            '花蓮高中',
            '花蓮大學'
          ];
          
          const suggestionText = suggestions.join('、');
          alert(`找不到該地址，請嘗試使用以下格式：\n\n${suggestionText}\n\n或使用簡化的地址格式`);
        }
      }
    } catch (error) {
      console.error('地址轉換失敗:', error);
      alert('地址轉換失敗，請重試');
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleAddMarker = async (title: string, description: string, category: LocationCategory) => {
    if (!newLocation) return;

    // 處理圖片上傳
    let imageUrls: string[] = [];
    if (selectedLocationImages.length > 0) {
      try {
        // 實際上傳圖片到 Supabase Storage
        const uploadPromises = selectedLocationImages.map(async (file, index) => {
          const locationId = `location-${Date.now()}-${index}`;
          return await imageService.uploadImage(file, locationId);
        });
        
        const uploadResults = await Promise.all(uploadPromises);
        imageUrls = uploadResults.filter((url): url is string => url !== null);
        console.log('圖片上傳成功:', imageUrls);
        console.log('上傳結果詳情:', uploadResults);
        
        // 檢查是否有上傳失敗的圖片
        if (imageUrls.length !== selectedLocationImages.length) {
          console.warn('部分圖片上傳失敗，只上傳了', imageUrls.length, '張，預期', selectedLocationImages.length, '張');
        }
      } catch (error) {
        console.error('圖片上傳失敗:', error);
        alert('圖片上傳失敗，請重試');
        return;
      }
    }

    const newMarkerData = {
      position: [newLocation.lat, newLocation.lng] as [number, number],
      title,
      description,
      category,
      supplies: [],
      images: imageUrls,
      messages: [],
    };

    try {
      const savedMarker = await locationService.addLocation(newMarkerData);
      if (savedMarker) {
        setMarkers([...markers, savedMarker]);
        setShowAddForm(false);
        setNewLocation(null);
        setSelectedLocationImages([]);
        setLocationImagePreview([]);
      } else {
        alert('儲存失敗，請重試');
      }
    } catch (error) {
      console.error('新增位置失敗:', error);
      alert('新增位置失敗，請檢查網路連線');
    }
  };

  const handleUpdateMarker = async (updatedMarker: LocationMarker) => {
    try {
      const savedMarker = await locationService.updateLocation(updatedMarker.id, updatedMarker);
      if (savedMarker) {
        setMarkers(markers.map(marker => 
          marker.id === updatedMarker.id ? savedMarker : marker
        ));
        setSelectedMarker(savedMarker);
      } else {
        alert('更新失敗，請重試');
      }
    } catch (error) {
      console.error('更新位置失敗:', error);
      alert('更新位置失敗，請檢查網路連線');
    }
  };

  const handleAddMessage = (messageData: { author: string; content: string; images?: string[] }) => {
    if (!selectedMarker) return;

    const newMessage = {
      id: Date.now().toString(),
      ...messageData,
      timestamp: new Date().toISOString(),
    };

    const updatedMarker = {
      ...selectedMarker,
      messages: [...selectedMarker.messages, newMessage],
    };

    handleUpdateMarker(updatedMarker);
  };

  const handleNavigateToGoogleMaps = (marker: LocationMarker) => {
    const [lat, lng] = marker.position;
    const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
    window.open(googleMapsUrl, '_blank');
  };

  const handleGetMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('您的瀏覽器不支援定位功能');
      return;
    }

    setIsGettingLocation(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setNewLocation({ lat: latitude, lng: longitude });
        setShowAddForm(true);
        setIsGettingLocation(false);
      },
      (error) => {
        let errorMessage = '無法取得位置資訊';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = '請允許瀏覽器存取您的位置';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = '位置資訊不可用';
            break;
          case error.TIMEOUT:
            errorMessage = '定位請求超時';
            break;
        }
        setLocationError(errorMessage);
        setIsGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  // 篩選功能
  const toggleFilter = (category: LocationCategory) => {
    setActiveFilters(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const clearAllFilters = () => {
    setActiveFilters([]);
  };

  const selectAllFilters = () => {
    setActiveFilters(['交通', '住宿', '物資', '勞力', '醫療', '通訊', '其他']);
  };

  // 篩選後的地標
  const filteredMarkers = markers.filter(marker => {
    // 分類篩選
    const categoryMatch = activeFilters.length === 0 || activeFilters.includes(marker.category);
    
    // 排除已完成的地標
    const notCompleted = marker.status !== '已完成';
    
    return categoryMatch && notCompleted;
  });

  // 搜尋結果的地標（也要排除已完成的地標）
  const searchResultsFiltered = isSearching ? searchResults.filter(marker => marker.status !== '已完成') : [];
  const displayMarkers = isSearching ? searchResultsFiltered : filteredMarkers;

  // 獲取已完成的地標
  const completedMarkers = markers.filter(marker => marker.status === '已完成');

  // 載入初始資料
  useEffect(() => {
    const loadLocations = async () => {
      try {
        setIsLoading(true);
        const locations = await locationService.getAllLocations();
        setMarkers(locations);
      } catch (error) {
        console.error('載入位置失敗:', error);
        alert('載入位置失敗，請檢查網路連線');
      } finally {
        setIsLoading(false);
      }
    };

    loadLocations();
  }, []);

  // 設定即時同步
  useEffect(() => {
    const subscription = locationService.subscribeToLocations((locations) => {
      setMarkers(locations);
    });

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="App">
        <header className="App-header">
          <h1>花蓮互助地圖</h1>
          <p>載入中...</p>
        </header>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>正在載入地圖資料...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>花蓮互助地圖</h1>
        <p>標記位置、分享需求、互相幫助</p>
        <div className="header-actions">
          <div className="search-container">
            <input
              type="text"
              placeholder="搜尋地標、分類、物資，或貼上地址..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                handleSearch(e.target.value);
              }}
              className="search-input"
            />
            {searchQuery && (
              <button onClick={clearSearch} className="clear-search-btn">
                ×
              </button>
            )}
          </div>
          <button 
            onClick={() => setShowAddressInput(true)}
            className="address-input-btn"
          >
            📍 輸入地址
          </button>
          <button 
            onClick={handleGetMyLocation}
            className="my-location-btn"
            disabled={isGettingLocation}
          >
            {isGettingLocation ? '定位中...' : '📍 發送我的位置'}
          </button>
          {locationError && (
            <div className="location-error">
              {locationError}
            </div>
          )}
        </div>
      </header>

      <div className="map-container">
        {/* 浮動的已完成清單按鈕 */}
        <button 
          onClick={() => setShowCompletedList(true)}
          className="floating-completed-btn"
          title={`已完成清單 (${completedMarkers.length})`}
        >
          📋 {completedMarkers.length}
        </button>
        
        <MapContainer
          center={HUALIEN_CENTER}
          zoom={12}
          style={{ height: '70vh', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <MapClickHandler onLocationAdd={handleLocationAdd} />
          
          {displayMarkers.map((marker) => (
            <Marker
              key={marker.id}
              position={marker.position}
              icon={createCustomIcon(marker.category)}
            >
              <Popup>
                <div className="marker-popup">
                  <div className="popup-header">
                    <span className={`popup-category-badge category-${marker.category}`}>
                      {categoryConfig[marker.category].icon} {marker.category}
                    </span>
                    <span className={`popup-status-badge status-${marker.status || '進行中'}`}>
                      {(marker.status || '進行中') === '進行中' && '🟢'}
                      {(marker.status || '進行中') === '已完成' && '✅'}
                      {marker.status || '進行中'}
                    </span>
                  </div>
                  <h3>{marker.title}</h3>
                  <p>{marker.description}</p>
                  
                  {marker.images && marker.images.length > 0 && (
                    <div className="popup-images">
                      <strong>位置圖片：</strong>
                      <div className="popup-images-list">
                        {marker.images.slice(0, 2).map((image, index) => (
                          <div key={index} className="popup-image-container">
                            <img 
                              src={image} 
                              alt={`位置圖片 ${index + 1}`}
                              className="popup-image"
                              onLoad={() => console.log('圖片載入成功:', image)}
                              onError={(e) => {
                                console.error('圖片載入失敗:', image);
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const fallback = target.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                            <div className="popup-image-fallback" style={{ display: 'none' }}>
                              <span>📷</span>
                            </div>
                          </div>
                        ))}
                        {marker.images.length > 2 && (
                          <div className="popup-more-images">
                            +{marker.images.length - 2} 更多
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {marker.supplies.length > 0 && (
                    <div className="popup-supplies">
                      <strong>需要物資：</strong>
                      <div className="supplies-tags">
                        {marker.supplies.map((supply, index) => (
                          <span key={index} className="supply-tag">{supply}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {marker.messages.length > 0 && (
                    <div className="popup-messages">
                      <strong>最新留言：</strong>
                      <div className="latest-message">
                        <span className="message-author">{marker.messages[marker.messages.length - 1].author}</span>
                        <span className="message-content">{marker.messages[marker.messages.length - 1].content}</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="popup-actions">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMarker(marker);
                      }}
                      className="popup-edit-btn"
                    >
                      ✏️ 編輯詳情
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNavigateToGoogleMaps(marker);
                      }}
                      className="popup-navigate-btn"
                    >
                      🧭 導航
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* 搜尋結果顯示 */}
      {(isSearching || isLocationSearching) && (searchResults.length > 0 || locationSearchResults.length > 0) && (
        <div className="search-results">
          <div className="search-results-header">
            <h3>搜尋結果</h3>
            <button onClick={clearSearch} className="close-search-btn">×</button>
          </div>
          <div className="search-results-list">
            {/* 現有地標結果 */}
            {searchResults.length > 0 && (
              <div className="search-section">
                <h4>現有地標 ({searchResults.length} 個)</h4>
                {searchResults.map((marker) => (
                  <div 
                    key={marker.id} 
                    className="search-result-item"
                    onClick={() => focusOnMarker(marker)}
                  >
                    <div className="search-result-info">
                      <span className={`search-category-badge category-${marker.category}`}>
                        {categoryConfig[marker.category].icon} {marker.category}
                      </span>
                      <h4>{marker.title}</h4>
                      <p>{marker.description}</p>
                      {marker.supplies.length > 0 && (
                        <div className="search-supplies">
                          <span>需要：{marker.supplies.slice(0, 3).join(', ')}</span>
                          {marker.supplies.length > 3 && <span> 等{marker.supplies.length}項</span>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 地點搜尋結果 */}
            {locationSearchResults.length > 0 && (
              <div className="search-section">
                <h4>附近地點 ({locationSearchResults.length} 個)</h4>
                {locationSearchResults.map((location, index) => (
                  <div 
                    key={index} 
                    className="search-result-item location-search-item"
                    onClick={() => handleLocationSearchSelect(location)}
                  >
                    <div className="search-result-info">
                      <span className="search-category-badge location-badge">
                        🇹🇼 台灣地點
                      </span>
                      <h4>{location.display_name.split(',')[0]}</h4>
                      <p>{location.type} - {location.class}</p>
                      <div className="search-supplies">
                        <span>點擊新增到地圖</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {(isSearching || isLocationSearching) && searchResults.length === 0 && locationSearchResults.length === 0 && searchQuery && (
        <div className="search-results">
          <div className="search-results-header">
            <h3>搜尋結果</h3>
            <button onClick={clearSearch} className="close-search-btn">×</button>
          </div>
          <div className="no-search-results">
            <p>找不到符合「{searchQuery}」的地標或地點</p>
            <p>試試其他關鍵字或檢查拼寫</p>
          </div>
        </div>
      )}

      {/* 地址輸入彈出視窗 */}
      {showAddressInput && (
        <div className="address-input-modal">
          <div className="modal-content">
            <h3>輸入地址</h3>
            <p>請輸入地址，建議格式：</p>
            <ul style={{ textAlign: 'left', margin: '10px 0', paddingLeft: '20px' }}>
              <li>花蓮火車站</li>
              <li>花蓮市公所</li>
              <li>花蓮醫院</li>
              <li>花蓮縣花蓮市中山路123號</li>
            </ul>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleAddressGeocode(addressInput);
            }}>
              <textarea
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                placeholder="例如：花蓮火車站 或 花蓮縣花蓮市中山路123號"
                required
                rows={3}
                className="address-textarea"
              />
              <div className="form-actions">
                <button 
                  type="submit" 
                  disabled={isGeocoding}
                  className="geocode-btn"
                >
                  {isGeocoding ? '轉換中...' : '📍 轉換為位置'}
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowAddressInput(false);
                    setAddressInput('');
                  }}
                  className="cancel-btn"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddForm && newLocation && (
        <div className="add-location-modal">
          <div className="modal-content">
            <h3>新增位置</h3>
            <p>座標：{newLocation.lat.toFixed(6)}, {newLocation.lng.toFixed(6)}</p>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const title = formData.get('title') as string;
              const description = formData.get('description') as string;
              const category = formData.get('category') as LocationCategory;
              handleAddMarker(title, description, category);
            }}>
              <input
                type="text"
                name="title"
                placeholder="位置標題"
                required
              />
              <textarea
                name="description"
                placeholder="位置描述"
                required
              />
              <div className="category-selection">
                <label>選擇分類：</label>
                <div className="category-options">
                  {(['交通', '住宿', '物資', '勞力', '醫療', '通訊', '其他'] as LocationCategory[]).map((cat) => (
                    <label key={cat} className="category-option">
                      <input
                        type="radio"
                        name="category"
                        value={cat}
                        required
                      />
                      <span className="category-label">{cat}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="location-images" className="image-upload-label">
                  📷 新增圖片 (可選，最多3張)
                </label>
                <input
                  id="location-images"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleLocationImageSelect}
                  className="image-upload-input"
                />
              </div>

              {locationImagePreview.length > 0 && (
                <div className="image-preview-container">
                  <p className="preview-label">預覽圖片：</p>
                  <div className="image-preview-list">
                    {locationImagePreview.map((preview, index) => (
                      <div key={index} className="image-preview-item">
                        <img src={preview} alt={`預覽 ${index + 1}`} className="preview-image" />
                        <button
                          type="button"
                          onClick={() => removeLocationImage(index)}
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
                <button type="button" onClick={() => setShowAddForm(false)}>
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedMarker && (
        <div className="marker-details">
          <div className="marker-header">
            <div className="marker-info">
              <div className="marker-badges">
                <span className={`category-badge category-${selectedMarker.category}`}>
                  {selectedMarker.category}
                </span>
                <span className={`status-badge status-${selectedMarker.status || '進行中'}`}>
                  {(selectedMarker.status || '進行中') === '進行中' && '🟢'}
                  {(selectedMarker.status || '進行中') === '已完成' && '✅'}
                  {selectedMarker.status || '進行中'}
                </span>
              </div>
              <h3>{selectedMarker.title}</h3>
              <p className="marker-description">{selectedMarker.description}</p>
            </div>
            <button onClick={() => setSelectedMarker(null)} className="close-btn">×</button>
          </div>

          {selectedMarker.images && selectedMarker.images.length > 0 && (
            <div className="marker-images">
              <div className="marker-images-list">
                {selectedMarker.images.map((image, index) => (
                  <div key={index} className="marker-image-container">
                    <img 
                      src={image} 
                      alt={`位置圖片 ${index + 1}`}
                      className="marker-image"
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
                ))}
              </div>
            </div>
          )}
          
          <div className="marker-content">
            <SupplyList
              supplies={selectedMarker.supplies}
              onSuppliesChange={(supplies) => handleUpdateMarker({...selectedMarker, supplies})}
              isEditable={true}
            />

            <MessageBoard
              messages={selectedMarker.messages}
              onMessageAdd={handleAddMessage}
            />

            <div className="status-controls">
              <h4>狀態管理</h4>
              <div className="status-buttons">
                {(['進行中', '已完成'] as LocationStatus[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => handleUpdateMarker({...selectedMarker, status})}
                    className={`status-control-btn ${
                      (selectedMarker.status || '進行中') === status ? 'active' : ''
                    } status-${status}`}
                  >
                    {status === '進行中' && '🟢'}
                    {status === '已完成' && '✅'}
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

        {/* 分類篩選按鈕 - 放在頁面底部 */}
        <div className="filter-section">
          <div className="filter-buttons">
            {(['交通', '住宿', '物資', '勞力', '醫療', '通訊', '其他'] as LocationCategory[]).map((category) => (
              <button
                key={category}
                onClick={() => toggleFilter(category)}
                className={`filter-btn category-filter ${
                  activeFilters.includes(category) ? 'active' : ''
                } category-${category}`}
              >
                {categoryConfig[category].icon} {category}
              </button>
            ))}
          </div>
          <div className="filter-controls">
            <button
              onClick={selectAllFilters}
              className="filter-btn filter-all"
            >
              全選
            </button>
            <button
              onClick={clearAllFilters}
              className="filter-btn filter-clear"
            >
              清除
            </button>
          </div>
        </div>

      {/* 已完成清單模態框 */}
      {showCompletedList && (
        <CompletedList
          completedMarkers={completedMarkers}
          onMarkerClick={(marker) => {
            setSelectedMarker(marker);
            setShowCompletedList(false);
          }}
          onClose={() => setShowCompletedList(false)}
        />
      )}
    </div>
  );
}

export default App;