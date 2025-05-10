import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import CryptoCard from './CryptoCard';

export default function WatchlistDashboard() {
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('name'); // 'name', 'price', 'change'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc', 'desc'
  const [prices, setPrices] = useState({});
  const [priceChanges, setPriceChanges] = useState({});
  const [currenciesInfo, setCurrenciesInfo] = useState({});
  const router = useRouter();

  useEffect(() => {
    fetchWatchlist();
  }, []);

  // Подключаемся к WebSocket для получения обновлений цен в реальном времени
  useEffect(() => {
    if (watchlist.length === 0) return;

    let ws = null;
    let reconnectInterval = null;
    
    const connectWebSocket = () => {
      try {
        // Используем прямое соединение с WebSocket
        const wsUrl = 'ws://localhost:8001/ws/updates';
        
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          console.log('WebSocket connected');
          if (reconnectInterval) {
            clearInterval(reconnectInterval);
            reconnectInterval = null;
          }
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'price') {
              // Обновляем цены
              setPrices(prevPrices => {
                const newPrices = { ...prevPrices };
                
                // Вычисляем изменения цен
                const newChanges = { ...priceChanges };
                
                Object.keys(data.payload).forEach(coin => {
                  if (prevPrices[coin]) {
                    const change = ((data.payload[coin] - prevPrices[coin]) / prevPrices[coin]) * 100;
                    newChanges[coin] = change;
                  }
                  newPrices[coin] = data.payload[coin];
                });
                
                setPriceChanges(newChanges);
                return newPrices;
              });
            }
          } catch (err) {
            console.error('Error parsing WebSocket message:', err);
          }
        };
        
        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };
        
        ws.onclose = () => {
          console.log('WebSocket connection closed. Trying to reconnect...');
          // Пытаемся переподключиться через интервал
          if (reconnectInterval === null) {
            reconnectInterval = setInterval(() => {
              connectWebSocket();
            }, 5000); // Пытаемся подключиться каждые 5 секунд
          }
        };
      } catch (err) {
        console.error('Error setting up WebSocket:', err);
      }
    };
    
    connectWebSocket();
    
    return () => {
      if (ws) {
        ws.close();
      }
      if (reconnectInterval) {
        clearInterval(reconnectInterval);
      }
    };
  }, [watchlist]);

  const fetchWatchlist = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const response = await fetch('http://localhost:8000/watchlist', {
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
        throw new Error('Не удалось загрузить список избранного');
      }

      const data = await response.json();
      setWatchlist(data || []);
      
      // Загружаем информацию о криптовалютах
      if (data && data.length > 0) {
        fetchCurrenciesInfo(data);
        fetchPrices(data);
      }
    } catch (err) {
      setError('Ошибка загрузки списка избранного');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrenciesInfo = async (coins) => {
    try {
      const infoPromises = coins.map(coin => 
        fetch(`http://localhost:8000/cryptocurrencies/${coin}`)
          .then(res => {
            if (!res.ok) {
              console.log(`Не удалось получить информацию о ${coin}, используем базовые данные`);
              return { 
                id: coin, 
                name: coin.charAt(0).toUpperCase() + coin.slice(1), 
                symbol: coin.substring(0, 3).toUpperCase() 
              };
            }
            return res.json();
          })
          .catch(() => {
            console.log(`Ошибка при получении информации для ${coin}, используем базовые данные`);
            return { 
              id: coin, 
              name: coin.charAt(0).toUpperCase() + coin.slice(1), 
              symbol: coin.substring(0, 3).toUpperCase() 
            };
          })
      );
      
      const results = await Promise.all(infoPromises);
      
      const newCurrenciesInfo = {};
      results.forEach(result => {
        if (result && result.id) {
          newCurrenciesInfo[result.id] = result;
        }
      });
      
      setCurrenciesInfo(newCurrenciesInfo);
    } catch (err) {
      console.error('Error fetching currencies info:', err);
    }
  };

  const fetchPrices = async (coins) => {
    try {
      const pricePromises = coins.map(coin => 
        fetch(`http://localhost:8001/api/price/${coin}`)
          .then(res => {
            if (!res.ok) {
              // Если API недоступен, генерируем фейковые данные
              return { coin, price: Math.random() * 50000 + 1000 };
            }
            return res.json().then(data => ({ coin, price: data.price }));
          })
          .catch(() => {
            console.log(`Ошибка при получении данных для ${coin}, используем случайные данные`);
            // Если произошла ошибка, генерируем фейковые данные
            return { coin, price: Math.random() * 50000 + 1000 };
          })
      );
      
      const results = await Promise.all(pricePromises);
      
      const newPrices = {};
      results.forEach(result => {
        if (result && result.price !== null) {
          newPrices[result.coin] = result.price;
        }
      });
      
      setPrices(newPrices);
      
      // Генерируем случайные изменения цен для демонстрации
      const newPriceChanges = {};
      coins.forEach(coin => {
        newPriceChanges[coin] = (Math.random() * 10) - 5; // случайное изменение от -5% до +5%
      });
      setPriceChanges(newPriceChanges);
      
    } catch (err) {
      console.error('Error fetching prices:', err);
      
      // В случае общей ошибки, генерируем фейковые данные для всех монет
      const newPrices = {};
      const newPriceChanges = {};
      
      coins.forEach(coin => {
        newPrices[coin] = Math.random() * 50000 + 1000;
        newPriceChanges[coin] = (Math.random() * 10) - 5;
      });
      
      setPrices(newPrices);
      setPriceChanges(newPriceChanges);
    }
  };

  const removeFromWatchlist = async (coinId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const response = await fetch('/api/user-proxy/watchlist', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          coin_id: coinId,
          action: 'remove'
        })
      });

      if (!response.ok) {
        throw new Error('Не удалось удалить монету из списка избранного');
      }

      // Обновляем локальный список
      setWatchlist(prev => prev.filter(coin => coin !== coinId));
    } catch (err) {
      setError('Ошибка при удалении монеты');
      console.error('Error:', err);
    }
  };

  const handleSortChange = (criteria) => {
    if (sortBy === criteria) {
      // Если критерий тот же, меняем порядок сортировки
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Если критерий новый, устанавливаем его и сбрасываем порядок на 'asc'
      setSortBy(criteria);
      setSortOrder('asc');
    }
  };

  const getSortedWatchlist = () => {
    if (!watchlist.length) return [];
    
    return [...watchlist].sort((a, b) => {
      if (sortBy === 'name') {
        const nameA = currenciesInfo[a]?.name || a;
        const nameB = currenciesInfo[b]?.name || b;
        return sortOrder === 'asc' 
          ? nameA.localeCompare(nameB) 
          : nameB.localeCompare(nameA);
      } else if (sortBy === 'price') {
        const priceA = prices[a] || 0;
        const priceB = prices[b] || 0;
        return sortOrder === 'asc' 
          ? priceA - priceB 
          : priceB - priceA;
      } else if (sortBy === 'change') {
        const changeA = priceChanges[a] || 0;
        const changeB = priceChanges[b] || 0;
        return sortOrder === 'asc' 
          ? changeA - changeB 
          : changeB - changeA;
      }
      return 0;
    });
  };

  const viewCryptoDetails = (coin) => {
    router.push(`/crypto/${coin}`);
  };

  if (loading) {
    return <div className="loading">Загрузка списка избранного...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  if (!watchlist.length) {
    return (
      <div className="empty-watchlist">
        <h2>Ваш список избранного пуст</h2>
        <p>Добавьте криптовалюты в список отслеживания, чтобы видеть их здесь</p>
        <button 
          onClick={() => router.push('/watchlist?tab=manage')}
          className="add-coins-btn"
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            backgroundColor: '#4a6cf7',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '500',
            fontSize: '1rem',
            transition: 'background-color 0.2s',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            display: 'inline-flex',
            alignItems: 'center'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3a5ce5'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#4a6cf7'}
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            style={{marginRight: '8px'}}
          >
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Добавить криптовалюты
        </button>
      </div>
    );
  }

  return (
    <div className="watchlist-dashboard">
      <div className="sort-controls">
        <span>Сортировать по:</span>
        <button 
          className={`sort-btn ${sortBy === 'name' ? 'active' : ''}`}
          onClick={() => handleSortChange('name')}
        >
          Названию {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
        <button 
          className={`sort-btn ${sortBy === 'price' ? 'active' : ''}`}
          onClick={() => handleSortChange('price')}
        >
          Цене {sortBy === 'price' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
        <button 
          className={`sort-btn ${sortBy === 'change' ? 'active' : ''}`}
          onClick={() => handleSortChange('change')}
        >
          Изменению {sortBy === 'change' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
      </div>

      <div className="crypto-cards-grid">
        {getSortedWatchlist().map(coin => (
          <div key={coin} className="crypto-card-wrapper" onClick={() => viewCryptoDetails(coin)}>
            <div className="card-highlight"></div>
            <CryptoCard 
              currency={coin} 
              onRemove={() => removeFromWatchlist(coin)} 
            />
            {priceChanges[coin] && (
              <div className={`price-change ${priceChanges[coin] > 0 ? 'positive' : 'negative'}`}>
                {priceChanges[coin] > 0 ? '+' : ''}{priceChanges[coin].toFixed(2)}%
              </div>
            )}
          </div>
        ))}
      </div>

      <style jsx>{`
        .watchlist-dashboard {
          width: 100%;
        }

        .sort-controls {
          display: flex;
          align-items: center;
          margin-bottom: 20px;
          gap: 10px;
        }

        .sort-btn {
          padding: 8px 12px;
          background: #f5f5f5;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: pointer;
        }

        .sort-btn.active {
          background: #e0e0e0;
          font-weight: bold;
        }

        .crypto-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }

        .crypto-card-wrapper {
          position: relative;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          border-radius: 4px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
          overflow: hidden;
          border: 1px solid #f0f0f0;
        }

        .crypto-card-wrapper:hover {
          transform: translateY(-2px);
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
          border-color: #e0e0e0;
        }
        
        .card-highlight {
          display: none;
        }

        .price-change {
          position: absolute;
          top: 10px;
          right: 10px;
          padding: 4px 8px;
          border-radius: 4px;
          font-weight: bold;
        }

        .price-change.positive {
          background-color: rgba(0, 255, 0, 0.1);
          color: green;
        }

        .price-change.negative {
          background-color: rgba(255, 0, 0, 0.1);
          color: red;
        }

        .empty-watchlist {
          text-align: center;
          padding: 40px;
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
          margin: 20px 0;
        }

        .empty-watchlist h2 {
          font-size: 1.5rem;
          margin-bottom: 10px;
          color: #333;
        }

        .empty-watchlist p {
          color: #666;
          margin-bottom: 20px;
        }

        .add-coins-btn {
          margin-top: 20px;
          padding: 10px 20px;
          background-color: #4a6cf7;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
          font-size: 1rem;
          transition: background-color 0.2s;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .add-coins-btn:hover {
          background-color: #3a5ce5;
        }

        .add-icon {
          margin-right: 8px;
        }

        .loading, .error {
          text-align: center;
          padding: 20px;
        }

        .error {
          color: red;
        }
      `}</style>
    </div>
  );
} 