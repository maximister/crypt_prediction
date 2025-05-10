import { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import websocketService from '../services/WebSocketService';
import cryptoDataService from '../services/CryptoDataService';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function CryptoCard({ 
  currency, 
  onRemove, 
  onClick,
  // Пропсы для статического режима
  staticMode = false,
  price: initialPrice = null,
  forecast: initialForecast = null,
  currencyInfo: initialCurrencyInfo = null
}) {
  const [price, setPrice] = useState(initialPrice);
  const [forecast, setForecast] = useState(initialForecast);
  const [error, setError] = useState(null);
  const [currencyInfo, setCurrencyInfo] = useState(initialCurrencyInfo);
  const [loading, setLoading] = useState(!staticMode);

  useEffect(() => {
    // Обновляем состояние, если пропсы изменились
    if (staticMode) {
      if (initialPrice !== null) setPrice(initialPrice);
      if (initialForecast !== null) setForecast(initialForecast);
      if (initialCurrencyInfo !== null) setCurrencyInfo(initialCurrencyInfo);
    }
  }, [staticMode, initialPrice, initialForecast, initialCurrencyInfo]);

  useEffect(() => {
    // Не выполняем запросы и не подключаемся к WebSocket в статическом режиме
    if (staticMode) return;
    
    // Загружаем данные
    loadData();
    
    // Подписываемся на обновления цен через WebSocket
    const unsubscribe = websocketService.subscribeToPrice(currency, (newPrice) => {
      setPrice(newPrice);
    });
    
    // Отписываемся при размонтировании компонента
    return () => {
      unsubscribe();
    };
  }, [currency, staticMode]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Загружаем все данные параллельно
      const [currencyInfoData, priceData, forecastData] = await Promise.all([
        cryptoDataService.getCurrencyInfo(currency),
        cryptoDataService.getPrice(currency),
        cryptoDataService.getForecast(currency, 7)
      ]);
      
      setCurrencyInfo(currencyInfoData);
      setPrice(priceData);
      setForecast(forecastData);
      setError(null);
    } catch (err) {
      console.error('Ошибка при загрузке данных:', err);
      setError('Ошибка при загрузке данных');
    } finally {
      setLoading(false);
    }
  };

  // Получаем отображаемое имя и символ валюты
  const displayName = currencyInfo?.name || currency.charAt(0).toUpperCase() + currency.slice(1);
  const displaySymbol = currencyInfo?.symbol || currency.substring(0, 3).toUpperCase();

  const handleCardClick = () => {
    if (onClick) {
      onClick(currency);
    }
  };

  return (
    <div 
      className="bg-white p-4 rounded-lg shadow-sm crypto-card" 
      onClick={handleCardClick}
      style={onClick ? { cursor: 'pointer' } : {}}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-lg font-medium">{displayName}</h2>
          <span className="text-sm text-gray-500">{displaySymbol}</span>
        </div>
        {onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(currency);
            }}
            style={{
              fontSize: '12px',
              padding: '4px 12px',
              backgroundColor: '#ef4444',
              color: 'white',
              borderRadius: '4px',
              border: '1px solid #dc2626',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#dc2626';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#ef4444';
              e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
            }}
          >
            Удалить
          </button>
        )}
      </div>

      {error && (
        <div className="text-red-500 mb-4">{error}</div>
      )}

      <div className="text-2xl font-bold mb-4">
        {loading ? 'Загрузка...' : price ? `$${price.toFixed(2)}` : 'Нет данных'}
      </div>

      {forecast && forecast.forecast && (
        <div className="h-40">
          <Line
            data={{
              labels: forecast.forecast.map(f => new Date(f.datetime).toLocaleDateString()),
              datasets: [{
                label: 'Прогноз',
                data: forecast.forecast.map(f => f.price),
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
              }]
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  display: false
                }
              }
            }}
          />
        </div>
      )}
    </div>
  );
} 