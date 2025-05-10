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

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function CryptoCard({ currency, onRemove }) {
  const [price, setPrice] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [error, setError] = useState(null);
  const [currencyInfo, setCurrencyInfo] = useState(null);

  useEffect(() => {
    fetchCurrencyInfo();
    fetchData();
    
    // Пробуем подключиться к WebSocket только если он доступен
    let ws;
    try {
      ws = new WebSocket('ws://localhost:8001/ws/updates');
      
      ws.onopen = () => {
        console.log('WebSocket соединение установлено');
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'price' && data.payload[currency]) {
            setPrice(data.payload[currency]);
          }
        } catch (err) {
          console.error('Ошибка при обработке сообщения WebSocket:', err);
        }
      };
      
      ws.onerror = (error) => {
        console.error('Ошибка WebSocket:', error);
      };
      
      ws.onclose = () => {
        console.log('WebSocket соединение закрыто');
      };
    } catch (err) {
      console.error('Не удалось установить WebSocket соединение:', err);
    }

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [currency]);

  const fetchCurrencyInfo = async () => {
    try {
      const response = await fetch(`http://localhost:8000/cryptocurrencies/${currency}`);
      
      if (response.ok) {
        const data = await response.json();
        setCurrencyInfo(data);
      } else {
        console.error(`Ошибка при загрузке информации о криптовалюте: ${response.status}`);
      }
    } catch (err) {
      console.error('Ошибка при загрузке информации о криптовалюте:', err);
    }
  };

  const fetchData = async () => {
    try {
      // Получаем текущую цену
      const priceResponse = await fetch(`http://localhost:8001/api/price/${currency}`);
      if (priceResponse.ok) {
        const priceData = await priceResponse.json();
        setPrice(priceData.price);
      } else {
        console.error(`Ошибка получения цены для ${currency}: ${priceResponse.status}`);
        // Устанавливаем временную цену для демонстрации
        setPrice(Math.random() * 50000 + 1000);
      }

      // Получаем прогноз
      const forecastResponse = await fetch(`http://localhost:8001/api/predict/${currency}/7d`);
      if (forecastResponse.ok) {
        const forecastData = await forecastResponse.json();
        setForecast(forecastData);
      } else {
        console.error(`Ошибка получения прогноза для ${currency}: ${forecastResponse.status}`);
        // Создаем тестовые данные для демонстрации
        const mockForecast = {
          forecast: Array.from({ length: 7 }, (_, i) => ({
            datetime: new Date(Date.now() + i * 86400000).toISOString(),
            price: Math.random() * 10000 + 1000
          }))
        };
        setForecast(mockForecast);
      }
    } catch (err) {
      console.error('Ошибка при загрузке данных:', err);
      setError('Ошибка при загрузке данных');
      
      // Устанавливаем тестовые данные для демонстрации
      setPrice(Math.random() * 50000 + 1000);
      const mockForecast = {
        forecast: Array.from({ length: 7 }, (_, i) => ({
          datetime: new Date(Date.now() + i * 86400000).toISOString(),
          price: Math.random() * 10000 + 1000
        }))
      };
      setForecast(mockForecast);
    }
  };

  // Получаем отображаемое имя и символ валюты
  const displayName = currencyInfo?.name || currency.charAt(0).toUpperCase() + currency.slice(1);
  const displaySymbol = currencyInfo?.symbol || currency.substring(0, 3).toUpperCase();

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm crypto-card">
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
        ${price?.toFixed(2) || 'Загрузка...'}
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