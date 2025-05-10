import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function PriceAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [newAlert, setNewAlert] = useState({
    coin: '',
    condition: 'above', // 'above' или 'below'
    price: '',
    percentage: '',
    type: 'price' // 'price' или 'percentage'
  });
  const [availableCoins, setAvailableCoins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchAlerts();
    fetchWatchlist();
  }, []);

  const fetchAlerts = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const response = await fetch('http://localhost:8000/alerts', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('token');
          router.push('/auth/login');
          return;
        }
        throw new Error('Не удалось загрузить уведомления');
      }

      const data = await response.json();
      setAlerts(data || []);
    } catch (err) {
      setError('Ошибка загрузки уведомлений');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchWatchlist = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('http://localhost:8000/watchlist', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) return;

      const data = await response.json();
      setAvailableCoins(data || []);
      
      // Устанавливаем первую монету по умолчанию для нового уведомления
      if (data && data.length > 0 && !newAlert.coin) {
        setNewAlert(prev => ({ ...prev, coin: data[0] }));
      }
    } catch (err) {
      console.error('Error fetching watchlist:', err);
    }
  };

  const createAlert = async () => {
    try {
      // Валидация
      if (!newAlert.coin) {
        setError('Выберите криптовалюту');
        return;
      }

      if (newAlert.type === 'price' && (!newAlert.price || isNaN(parseFloat(newAlert.price)))) {
        setError('Введите корректную цену');
        return;
      }

      if (newAlert.type === 'percentage' && (!newAlert.percentage || isNaN(parseFloat(newAlert.percentage)))) {
        setError('Введите корректный процент');
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const alertData = {
        coin_id: newAlert.coin,
        condition: newAlert.condition,
        type: newAlert.type
      };

      if (newAlert.type === 'price') {
        alertData.price = parseFloat(newAlert.price);
      } else {
        alertData.percentage = parseFloat(newAlert.percentage);
      }

      const response = await fetch('http://localhost:8000/alerts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(alertData)
      });

      if (!response.ok) {
        throw new Error('Не удалось создать уведомление');
      }

      // Сбрасываем форму и обновляем список уведомлений
      setNewAlert({
        coin: availableCoins[0] || '',
        condition: 'above',
        price: '',
        percentage: '',
        type: 'price'
      });
      
      setError('');
      fetchAlerts();
    } catch (err) {
      setError('Ошибка при создании уведомления');
      console.error('Error:', err);
    }
  };

  const deleteAlert = async (alertId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const response = await fetch(`http://localhost:8000/alerts/${alertId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Не удалось удалить уведомление');
      }

      // Обновляем список уведомлений
      setAlerts(alerts.filter(alert => alert.id !== alertId));
    } catch (err) {
      setError('Ошибка при удалении уведомления');
      console.error('Error:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewAlert(prev => ({ ...prev, [name]: value }));
  };

  if (loading) {
    return <div className="loading">Загрузка уведомлений...</div>;
  }

  return (
    <div className="price-alerts">
      <h2>Уведомления о ценах</h2>
      
      {error && <div className="error">{error}</div>}

      <div className="create-alert">
        <h3>Создать новое уведомление</h3>
        
        <div className="form-group">
          <label>Криптовалюта:</label>
          <select 
            name="coin" 
            value={newAlert.coin} 
            onChange={handleInputChange}
            className="select-input"
          >
            {availableCoins.length === 0 ? (
              <option value="">Добавьте монеты в список избранного</option>
            ) : (
              availableCoins.map(coin => (
                <option key={coin} value={coin}>
                  {coin.toUpperCase()}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="form-group">
          <label>Тип уведомления:</label>
          <div className="radio-group">
            <label>
              <input
                type="radio"
                name="type"
                value="price"
                checked={newAlert.type === 'price'}
                onChange={handleInputChange}
              />
              По цене
            </label>
            <label>
              <input
                type="radio"
                name="type"
                value="percentage"
                checked={newAlert.type === 'percentage'}
                onChange={handleInputChange}
              />
              По изменению в %
            </label>
          </div>
        </div>

        <div className="form-group">
          <label>Условие:</label>
          <select 
            name="condition" 
            value={newAlert.condition} 
            onChange={handleInputChange}
            className="select-input"
          >
            <option value="above">Выше</option>
            <option value="below">Ниже</option>
          </select>
          
          {newAlert.type === 'price' ? (
            <input
              type="number"
              name="price"
              value={newAlert.price}
              onChange={handleInputChange}
              placeholder="Цена в USD"
              className="number-input"
              step="0.01"
              min="0"
            />
          ) : (
            <div className="percentage-input-wrapper">
              <input
                type="number"
                name="percentage"
                value={newAlert.percentage}
                onChange={handleInputChange}
                placeholder="Процент изменения"
                className="number-input"
                step="0.1"
              />
              <span className="percentage-symbol">%</span>
            </div>
          )}
        </div>

        <button 
          onClick={createAlert}
          className="create-btn"
          disabled={availableCoins.length === 0}
        >
          Создать уведомление
        </button>
      </div>

      <div className="alerts-list">
        <h3>Активные уведомления</h3>
        
        {alerts.length === 0 ? (
          <p className="no-alerts">У вас нет активных уведомлений</p>
        ) : (
          <ul>
            {alerts.map(alert => (
              <li key={alert.id} className="alert-item">
                <div className="alert-info">
                  <span className="coin-name">{alert.coin_id.toUpperCase()}</span>
                  <span className="alert-condition">
                    {alert.condition === 'above' ? 'выше' : 'ниже'} 
                    {alert.type === 'price' 
                      ? ` $${alert.price.toFixed(2)}` 
                      : ` ${alert.percentage.toFixed(1)}%`
                    }
                  </span>
                </div>
                <button 
                  onClick={() => deleteAlert(alert.id)}
                  className="delete-btn"
                >
                  Удалить
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <style jsx>{`
        .price-alerts {
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        h2 {
          margin-bottom: 20px;
          color: #333;
        }

        h3 {
          margin-bottom: 15px;
          color: #444;
        }

        .error {
          color: #dc3545;
          margin-bottom: 15px;
          padding: 10px;
          background: #ffe6e6;
          border-radius: 4px;
        }

        .create-alert {
          margin-bottom: 30px;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 8px;
          border: 1px solid #e0e0e0;
        }

        .form-group {
          margin-bottom: 15px;
        }

        label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
        }

        .select-input, .number-input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 1rem;
          margin-top: 5px;
        }

        .radio-group {
          display: flex;
          gap: 20px;
          margin-top: 5px;
        }

        .radio-group label {
          display: flex;
          align-items: center;
          gap: 5px;
          font-weight: normal;
        }

        .percentage-input-wrapper {
          position: relative;
        }

        .percentage-symbol {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #666;
        }

        .create-btn {
          padding: 10px 20px;
          background-color: #4a6cf7;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
          margin-top: 10px;
        }

        .create-btn:disabled {
          background-color: #cccccc;
          cursor: not-allowed;
        }

        .alerts-list {
          margin-top: 20px;
        }

        .no-alerts {
          color: #666;
          font-style: italic;
        }

        ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .alert-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          margin-bottom: 10px;
          background: #f8f9fa;
        }

        .coin-name {
          font-weight: bold;
          margin-right: 10px;
        }

        .delete-btn {
          padding: 6px 12px;
          background-color: #dc3545;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .loading {
          text-align: center;
          padding: 20px;
        }
      `}</style>
    </div>
  );
} 