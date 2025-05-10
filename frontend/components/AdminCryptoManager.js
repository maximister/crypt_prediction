import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function AdminCryptoManager() {
  const [cryptocurrencies, setCryptocurrencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    symbol: '',
    description: '',
    logo_url: '',
    is_active: true
  });
  
  const router = useRouter();

  useEffect(() => {
    fetchCryptocurrencies();
  }, []);

  const fetchCryptocurrencies = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const response = await fetch('http://localhost:8000/cryptocurrencies?active_only=false', {
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
        
        if (response.status === 403) {
          // Если нет прав администратора
          router.push('/');
          return;
        }
        
        throw new Error('Не удалось загрузить список криптовалют');
      }

      const data = await response.json();
      setCryptocurrencies(data || []);
    } catch (err) {
      setError('Ошибка загрузки списка криптовалют');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const resetForm = () => {
    setFormData({
      id: '',
      name: '',
      symbol: '',
      description: '',
      logo_url: '',
      is_active: true
    });
    setEditMode(false);
    setShowForm(false);
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      // Валидация формы
      if (!formData.id || !formData.name || !formData.symbol) {
        setError('ID, название и символ обязательны для заполнения');
        return;
      }
      
      // Различная логика для добавления и редактирования
      let url, method;
      
      if (editMode) {
        url = `http://localhost:8000/cryptocurrencies/${formData.id}`;
        method = 'PUT';
      } else {
        url = 'http://localhost:8000/cryptocurrencies';
        method = 'POST';
      }
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('token');
          router.push('/auth/login');
          return;
        }
        
        if (response.status === 403) {
          // Если нет прав администратора
          router.push('/');
          return;
        }
        
        throw new Error(`Ошибка ${editMode ? 'обновления' : 'добавления'} криптовалюты`);
      }

      const data = await response.json();
      
      // Обновляем список
      fetchCryptocurrencies();
      
      // Показываем сообщение об успехе
      setSuccess(`Криптовалюта ${data.name} успешно ${editMode ? 'обновлена' : 'добавлена'}`);
      
      // Сбрасываем форму
      resetForm();
    } catch (err) {
      setError(err.message);
      console.error('Error:', err);
    }
  };

  const handleEdit = (currency) => {
    setFormData({
      id: currency.id,
      name: currency.name,
      symbol: currency.symbol,
      description: currency.description || '',
      logo_url: currency.logo_url || '',
      is_active: currency.is_active !== false // по умолчанию true, если не указано иное
    });
    setEditMode(true);
    setShowForm(true);
    setError('');
    setSuccess('');
  };
  
  const handleToggleActive = async (currency) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const response = await fetch(`http://localhost:8000/cryptocurrencies/${currency.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          is_active: !currency.is_active
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('token');
          router.push('/auth/login');
          return;
        }
        
        if (response.status === 403) {
          // Если нет прав администратора
          router.push('/');
          return;
        }
        
        throw new Error('Не удалось обновить статус криптовалюты');
      }

      // Обновляем список
      fetchCryptocurrencies();
      
      // Показываем сообщение об успехе
      setSuccess(`Статус криптовалюты ${currency.name} успешно изменен`);
    } catch (err) {
      setError(err.message);
      console.error('Error:', err);
    }
  };

  const handleDelete = async (currency) => {
    // Просим подтверждение перед удалением
    if (!window.confirm(`Вы действительно хотите удалить криптовалюту ${currency.name}?`)) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const response = await fetch(`http://localhost:8000/cryptocurrencies/${currency.id}`, {
        method: 'DELETE',
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
        
        if (response.status === 403) {
          // Если нет прав администратора
          router.push('/');
          return;
        }
        
        throw new Error('Не удалось удалить криптовалюту');
      }

      // Обновляем список
      fetchCryptocurrencies();
      
      // Показываем сообщение об успехе
      setSuccess(`Криптовалюта ${currency.name} успешно удалена`);
    } catch (err) {
      setError(err.message);
      console.error('Error:', err);
    }
  };

  if (loading) {
    return <div className="loading">Загрузка списка криптовалют...</div>;
  }

  return (
    <div className="admin-crypto-container">
      <h2>Управление криптовалютами</h2>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
      <div className="action-bar">
        <button 
          className="add-btn" 
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
        >
          {showForm ? 'Отменить' : 'Добавить новую криптовалюту'}
        </button>
        
        <button 
          className="refresh-btn" 
          onClick={fetchCryptocurrencies}
        >
          Обновить список
        </button>
      </div>
      
      {showForm && (
        <form className="crypto-form" onSubmit={handleSubmit}>
          <h3>{editMode ? 'Редактировать криптовалюту' : 'Добавить новую криптовалюту'}</h3>
          
          <div className="form-group">
            <label htmlFor="id">ID:</label>
            <input 
              type="text" 
              id="id" 
              name="id" 
              value={formData.id} 
              onChange={handleChange} 
              required
              disabled={editMode} // ID нельзя изменять при редактировании
              placeholder="bitcoin"
            />
            <span className="hint">Используйте строчные буквы без пробелов (например, "bitcoin")</span>
          </div>
          
          <div className="form-group">
            <label htmlFor="name">Название:</label>
            <input 
              type="text" 
              id="name" 
              name="name" 
              value={formData.name} 
              onChange={handleChange} 
              required 
              placeholder="Bitcoin"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="symbol">Символ:</label>
            <input 
              type="text" 
              id="symbol" 
              name="symbol" 
              value={formData.symbol} 
              onChange={handleChange} 
              required 
              placeholder="BTC"
            />
            <span className="hint">Обычно 3-4 буквы прописными (например, "BTC")</span>
          </div>
          
          <div className="form-group">
            <label htmlFor="description">Описание:</label>
            <textarea 
              id="description" 
              name="description" 
              value={formData.description} 
              onChange={handleChange} 
              placeholder="Краткое описание криптовалюты..."
              rows="4"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="logo_url">URL логотипа:</label>
            <input 
              type="text" 
              id="logo_url" 
              name="logo_url" 
              value={formData.logo_url} 
              onChange={handleChange} 
              placeholder="https://example.com/logo.png"
            />
            <span className="hint">Ссылка на изображение логотипа (рекомендуемый размер 64x64)</span>
          </div>
          
          <div className="form-group checkbox">
            <label htmlFor="is_active">
              <input 
                type="checkbox" 
                id="is_active" 
                name="is_active" 
                checked={formData.is_active} 
                onChange={handleChange} 
              />
              Активна
            </label>
            <span className="hint">Включите, чтобы сделать валюту доступной пользователям</span>
          </div>
          
          <div className="form-actions">
            <button type="submit" className="submit-btn">
              {editMode ? 'Сохранить изменения' : 'Добавить криптовалюту'}
            </button>
            <button type="button" className="cancel-btn" onClick={resetForm}>
              Отмена
            </button>
          </div>
        </form>
      )}
      
      <div className="crypto-list">
        <h3>Список криптовалют ({cryptocurrencies.length})</h3>
        
        {cryptocurrencies.length === 0 ? (
          <div className="empty-list">Нет доступных криптовалют</div>
        ) : (
          <table className="crypto-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Название</th>
                <th>Символ</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {cryptocurrencies.map(currency => (
                <tr key={currency.id} className={!currency.is_active ? 'inactive' : ''}>
                  <td>{currency.id}</td>
                  <td>{currency.name}</td>
                  <td>{currency.symbol}</td>
                  <td>
                    <span className={`status-badge ${currency.is_active ? 'active' : 'inactive'}`}>
                      {currency.is_active ? 'Активна' : 'Неактивна'}
                    </span>
                  </td>
                  <td className="actions">
                    <button 
                      className="edit-btn" 
                      onClick={() => handleEdit(currency)}
                      title="Редактировать"
                    >
                      ✏️
                    </button>
                    <button 
                      className="toggle-btn" 
                      onClick={() => handleToggleActive(currency)}
                      title={currency.is_active ? 'Деактивировать' : 'Активировать'}
                    >
                      {currency.is_active ? '🔴' : '🟢'}
                    </button>
                    <button 
                      className="delete-btn" 
                      onClick={() => handleDelete(currency)}
                      title="Удалить"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style jsx>{`
        .admin-crypto-container {
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

        .error-message {
          background-color: #ffe6e6;
          color: #dc3545;
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 15px;
        }

        .success-message {
          background-color: #e6ffe6;
          color: #28a745;
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 15px;
        }

        .action-bar {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .add-btn, .refresh-btn, .submit-btn, .cancel-btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
          transition: background-color 0.2s;
        }

        .add-btn {
          background-color: #4a6cf7;
          color: white;
        }

        .refresh-btn {
          background-color: #f8f9fa;
          border: 1px solid #ddd;
        }

        .add-btn:hover {
          background-color: #3a5ce5;
        }

        .refresh-btn:hover {
          background-color: #e9ecef;
        }

        .crypto-form {
          background-color: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
          border: 1px solid #e9ecef;
        }

        .form-group {
          margin-bottom: 15px;
        }

        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
        }

        .form-group input,
        .form-group textarea {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        .form-group textarea {
          resize: vertical;
        }

        .form-group.checkbox {
          display: flex;
          align-items: center;
        }

        .form-group.checkbox label {
          display: flex;
          align-items: center;
          margin-bottom: 0;
        }

        .form-group.checkbox input {
          width: auto;
          margin-right: 8px;
        }

        .hint {
          display: block;
          font-size: 12px;
          color: #666;
          margin-top: 4px;
        }

        .form-actions {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }

        .submit-btn {
          background-color: #28a745;
          color: white;
        }

        .cancel-btn {
          background-color: #dc3545;
          color: white;
        }

        .submit-btn:hover {
          background-color: #218838;
        }

        .cancel-btn:hover {
          background-color: #c82333;
        }

        .crypto-list {
          margin-top: 30px;
        }

        .empty-list {
          text-align: center;
          padding: 20px;
          background-color: #f8f9fa;
          border-radius: 4px;
          color: #666;
          border: 1px dashed #ddd;
        }

        .crypto-table {
          width: 100%;
          border-collapse: collapse;
        }

        .crypto-table th,
        .crypto-table td {
          padding: 12px 15px;
          text-align: left;
          border-bottom: 1px solid #e9ecef;
        }

        .crypto-table th {
          background-color: #f8f9fa;
          font-weight: 500;
          color: #333;
        }

        .crypto-table tr.inactive {
          background-color: #f9f9f9;
          color: #888;
        }

        .crypto-table tr:hover {
          background-color: #f1f3f5;
        }

        .status-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
        }

        .status-badge.active {
          background-color: #e6ffe6;
          color: #28a745;
        }

        .status-badge.inactive {
          background-color: #ffe6e6;
          color: #dc3545;
        }

        .actions {
          display: flex;
          gap: 10px;
        }

        .edit-btn, .toggle-btn, .delete-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 16px;
          padding: 4px;
          border-radius: 4px;
          transition: background-color 0.2s;
        }

        .edit-btn:hover, .toggle-btn:hover, .delete-btn:hover {
          background-color: #e9ecef;
        }

        .loading {
          text-align: center;
          padding: 20px;
          color: #666;
        }
      `}</style>
    </div>
  );
} 