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

  useEffect(() => {
    fetchData();
    const ws = new WebSocket('ws://localhost:8001/ws/updates');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'price' && data.payload[currency]) {
        setPrice(data.payload[currency]);
      }
    };

    return () => ws.close();
  }, [currency]);

  const fetchData = async () => {
    try {
      // Получаем текущую цену
      const priceResponse = await fetch(`http://localhost:8001/api/current/${currency}`);
      const priceData = await priceResponse.json();
      setPrice(priceData.price);

      // Получаем прогноз
      const forecastResponse = await fetch(`http://localhost:8001/api/predict/${currency}/day`);
      const forecastData = await forecastResponse.json();
      setForecast(forecastData);
    } catch (err) {
      setError('Ошибка при загрузке данных');
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-xl font-semibold">{currency.toUpperCase()}</h2>
        {onRemove && (
          <button
            onClick={() => onRemove(currency)}
            className="text-red-500 hover:text-red-700"
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

      {forecast && (
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