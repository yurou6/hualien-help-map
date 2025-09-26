import React, { useState } from 'react';

interface SupplyListProps {
  supplies: string[];
  onSuppliesChange: (supplies: string[]) => void;
  isEditable?: boolean;
}

const SupplyList: React.FC<SupplyListProps> = ({ supplies, onSuppliesChange, isEditable = false }) => {
  const [newSupply, setNewSupply] = useState('');

  const handleAddSupply = () => {
    if (newSupply.trim() && !supplies.includes(newSupply.trim())) {
      onSuppliesChange([...supplies, newSupply.trim()]);
      setNewSupply('');
    }
  };

  const handleRemoveSupply = (index: number) => {
    if (isEditable) {
      const newSupplies = supplies.filter((_, i) => i !== index);
      onSuppliesChange(newSupplies);
    }
  };

  const commonSupplies = [
    '飲用水', '食物', '毛毯', '手電筒', '電池', '急救包',
    '充電器', '行動電源', '口罩', '消毒用品', '雨衣', '雨鞋'
  ];

  const handleAddCommonSupply = (supply: string) => {
    if (!supplies.includes(supply)) {
      onSuppliesChange([...supplies, supply]);
    }
  };

  return (
    <div className="supply-list">
      <h4>物資需求清單</h4>
      
      {supplies.length > 0 ? (
        <div className="supplies-display">
          {supplies.map((supply, index) => (
            <div key={index} className="supply-item">
              <span>{supply}</span>
              {isEditable && (
                <button 
                  onClick={() => handleRemoveSupply(index)}
                  className="remove-supply-btn"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="no-supplies">目前沒有物資需求</p>
      )}

      {isEditable && (
        <div className="add-supply-section">
          <div className="add-supply-input">
            <input
              type="text"
              value={newSupply}
              onChange={(e) => setNewSupply(e.target.value)}
              placeholder="輸入需要的物資..."
              onKeyPress={(e) => e.key === 'Enter' && handleAddSupply()}
            />
            <button onClick={handleAddSupply} className="add-supply-btn">
              新增
            </button>
          </div>
          
          <div className="common-supplies">
            <p>常用物資：</p>
            <div className="common-supplies-list">
              {commonSupplies.map((supply) => (
                <button
                  key={supply}
                  onClick={() => handleAddCommonSupply(supply)}
                  className="common-supply-btn"
                  disabled={supplies.includes(supply)}
                >
                  {supply}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplyList;
