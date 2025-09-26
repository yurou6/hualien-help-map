import React from 'react';
import { LocationMarker } from '../lib/supabase';

interface CompletedListProps {
  completedMarkers: LocationMarker[];
  onMarkerClick: (marker: LocationMarker) => void;
  onClose: () => void;
}

const CompletedList: React.FC<CompletedListProps> = ({ 
  completedMarkers, 
  onMarkerClick, 
  onClose 
}) => {
  return (
    <div className="completed-list-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h3>已完成的地標清單</h3>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
        
        <div className="completed-list">
          {completedMarkers.length === 0 ? (
            <div className="empty-state">
              <p>目前沒有已完成的地標</p>
            </div>
          ) : (
            <div className="list-items">
              {completedMarkers.map((marker) => (
                <div 
                  key={marker.id} 
                  className="list-item"
                  onClick={() => onMarkerClick(marker)}
                >
                  <div className="item-header">
                    <div className="item-badges">
                      <span className={`category-badge category-${marker.category}`}>
                        {marker.category}
                      </span>
                      <span className="status-badge status-已完成">
                        ✅ 已完成
                      </span>
                    </div>
                    <div className="item-date">
                      {new Date(marker.updated_at).toLocaleDateString('zh-TW')}
                    </div>
                  </div>
                  
                  <h4 className="item-title">{marker.title}</h4>
                  <p className="item-description">{marker.description}</p>
                  
                  {marker.supplies && marker.supplies.length > 0 && (
                    <div className="item-supplies">
                      <strong>已提供物資：</strong>
                      <div className="supplies-tags">
                        {marker.supplies.map((supply, index) => (
                          <span key={index} className="supply-tag completed">
                            {supply}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {marker.messages && marker.messages.length > 0 && (
                    <div className="item-messages">
                      <strong>最新留言：</strong>
                      <div className="latest-message">
                        <span className="message-author">
                          {marker.messages[marker.messages.length - 1].author}
                        </span>
                        <span className="message-content">
                          {marker.messages[marker.messages.length - 1].content}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompletedList;
