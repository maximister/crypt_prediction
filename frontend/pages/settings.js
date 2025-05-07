import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Settings() {
  const router = useRouter();
  const [watchlist, setWatchlist] = useState([]);
  const [newCurrency, setNewCurrency] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth/login');
      return;
    }

    fetchWatchlist();
  }, []);

  const fetchWatchlist = async () => {
    try {
      const response = await fetch('http://localhost:8000/watchlist', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setWatchlist(data.watchlist);
    } catch (error) {
      console.error('Error fetching watchlist:', error);
    }
  };

  const handleAddCurrency = async () => {
    if (!newCurrency) return;

    try {
      const response = await fetch('http://localhost:8000/watchlist', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currency: newCurrency.toUpperCase(),
          action: 'add'
        }),
      });

      if (!response.ok) {
        throw new Error('Ошибка при добавлении валюты');
      }

      setNewCurrency('');
      fetchWatchlist();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemoveCurrency = async (currency) => {
    try {
      const response = await fetch('http://localhost:8000/watchlist', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currency,
          action: 'remove'
        }),
      });

      if (!response.ok) {
        throw new Error('Ошибка при удалении валюты');
      }

      fetchWatchlist();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <Head>
        <title>Настройки - Crypto Tracker</title>
      </Head>

      <div className="container mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">Настройки</h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Список отслеживаемых криптовалют</h2>

          <div className="mb-4">
            <div className="flex">
              <input
                type="text"
                value={newCurrency}
                onChange={(e) => setNewCurrency(e.target.value)}
                placeholder="Введите код криптовалюты (например, BTC)"
                className="flex-1 shadow appearance-none border rounded-l py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
              <button
                onClick={handleAddCurrency}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-r focus:outline-none focus:shadow-outline"
              >
                Добавить
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {watchlist.map((currency) => (
              <div
                key={currency}
                className="flex items-center justify-between bg-gray-50 p-3 rounded"
              >
                <span className="font-medium">{currency}</span>
                <button
                  onClick={() => handleRemoveCurrency(currency)}
                  className="text-red-500 hover:text-red-700"
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 