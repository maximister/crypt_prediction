import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function WatchlistManager() {
  const [watchlist, setWatchlist] = useState([]);
  const [availableCoins, setAvailableCoins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchWatchlist();
    fetchAvailableCoins();
  }, []);

  const fetchAvailableCoins = async () => {
    try {
      const response = await fetch('http://localhost:8000/cryptocurrencies');
      if (!response.ok) {
        throw new Error('Не удалось загрузить список доступных криптовалют');
      }
      const data = await response.json();
      setAvailableCoins(data);
    } catch (err) {
      console.error('Ошибка при загрузке списка криптовалют:', err);
      // Если API недоступен, используем предопределенный список
      setAvailableCoins([
        { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC' },
        { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
        { id: 'binancecoin', name: 'Binance Coin', symbol: 'BNB' },
        { id: 'ripple', name: 'XRP', symbol: 'XRP' },
        { id: 'cardano', name: 'Cardano', symbol: 'ADA' },
        { id: 'solana', name: 'Solana', symbol: 'SOL' },
        { id: 'polkadot', name: 'Polkadot', symbol: 'DOT' },
        { id: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE' }
      ]);
    }
  };

  const fetchWatchlist = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/');
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
          router.push('/');
          return;
        }
        throw new Error('Failed to fetch watchlist');
      }

      const data = await response.json();
      setWatchlist(data || []);
    } catch (err) {
      setError('Failed to load watchlist');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const addToWatchlist = async (coinId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/');
        return;
      }

      const response = await fetch('http://localhost:8000/watchlist', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          coin_id: coinId,
          action: 'add'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to add coin to watchlist');
      }

      await fetchWatchlist();
    } catch (err) {
      setError('Failed to add coin to watchlist');
      console.error('Error:', err);
    }
  };

  const removeFromWatchlist = async (coinId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/');
        return;
      }

      const response = await fetch('http://localhost:8000/watchlist', {
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
        throw new Error('Failed to remove coin from watchlist');
      }

      await fetchWatchlist();
    } catch (err) {
      setError('Failed to remove coin from watchlist');
      console.error('Error:', err);
    }
  };

  if (loading) {
    return <div className="loading">Загрузка списка отслеживания...</div>;
  }

  return (
    <div className="watchlist-container">
      <h2>Список отслеживания</h2>
      {error && <div className="error">{error}</div>}
      
      <div className="coins-grid">
        {availableCoins.map(coin => {
          const isInWatchlist = watchlist.includes(coin.id);
          return (
            <div key={coin.id} className="coin-card">
              <div className="coin-info">
                <h3>{coin.name}</h3>
                <span className="symbol">{coin.symbol}</span>
              </div>
              <button
                onClick={() => isInWatchlist ? removeFromWatchlist(coin.id) : addToWatchlist(coin.id)}
                className={isInWatchlist ? 'remove' : 'add'}
              >
                {isInWatchlist ? 'Удалить' : 'Добавить'}
              </button>
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .watchlist-container {
          background: white;
          border-radius: 8px;
          padding: 20px;
          margin-top: 20px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        h2 {
          margin-bottom: 20px;
        }

        .error {
          color: #dc3545;
          margin-bottom: 15px;
          padding: 10px;
          background: #ffe6e6;
          border-radius: 4px;
        }

        .coins-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 20px;
        }

        .coin-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          background: #f8f9fa;
        }

        .coin-info {
          display: flex;
          flex-direction: column;
        }

        .symbol {
          color: #666;
          font-size: 0.9em;
          margin-top: 4px;
        }

        button {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
          transition: background-color 0.2s;
        }

        button.add {
          background-color: #28a745;
          color: white;
        }

        button.remove {
          background-color: #dc3545;
          color: white;
        }

        button:hover {
          opacity: 0.9;
        }
      `}</style>
    </div>
  );
} 