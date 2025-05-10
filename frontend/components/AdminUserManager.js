import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function AdminUserManager() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const router = useRouter();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const response = await fetch('http://localhost:8000/users', {
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
        
        throw new Error('Не удалось загрузить список пользователей');
      }

      const data = await response.json();
      setUsers(data || []);
    } catch (err) {
      setError('Ошибка загрузки списка пользователей');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRole = async (user) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      // Если текущая роль admin, меняем на user, иначе на admin
      const newRole = user.role === 'admin' ? 'user' : 'admin';

      const response = await fetch(`http://localhost:8000/users/${user.email}/role?role=${newRole}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('token');
          router.push('/auth/login');
          return;
        }
        
        if (response.status === 403) {
          router.push('/');
          return;
        }
        
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Не удалось обновить роль пользователя');
      }

      // Обновляем список
      fetchUsers();
      
      // Показываем сообщение об успехе
      setSuccess(`Роль пользователя ${user.email} изменена на ${newRole}`);
      setTimeout(() => setSuccess(''), 3000); // Скрываем сообщение через 3 секунды
    } catch (err) {
      setError(err.message);
      console.error('Error:', err);
      setTimeout(() => setError(''), 3000); // Скрываем сообщение через 3 секунды
    }
  };

  const handleToggleActive = async (user) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      // Инвертируем статус активности
      const newStatus = !user.is_active;

      const response = await fetch(`http://localhost:8000/users/${user.email}/status?is_active=${newStatus}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('token');
          router.push('/auth/login');
          return;
        }
        
        if (response.status === 403) {
          router.push('/');
          return;
        }
        
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Не удалось обновить статус пользователя');
      }

      // Обновляем список
      fetchUsers();
      
      // Показываем сообщение об успехе
      const statusText = newStatus ? 'активирован' : 'деактивирован';
      setSuccess(`Аккаунт пользователя ${user.email} ${statusText}`);
      setTimeout(() => setSuccess(''), 3000); // Скрываем сообщение через 3 секунды
    } catch (err) {
      setError(err.message);
      console.error('Error:', err);
      setTimeout(() => setError(''), 3000); // Скрываем сообщение через 3 секунды
    }
  };

  if (loading) {
    return <div className="loading">Загрузка списка пользователей...</div>;
  }

  return (
    <div className="admin-user-container">
      <h2>Управление пользователями</h2>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
      <div className="action-bar">
        <button 
          className="refresh-btn" 
          onClick={fetchUsers}
        >
          Обновить список
        </button>
      </div>
      
      <div className="user-list">
        <h3>Список пользователей ({users.length})</h3>
        
        {users.length === 0 ? (
          <div className="empty-list">Нет зарегистрированных пользователей</div>
        ) : (
          <table className="user-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Имя</th>
                <th>Роль</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.email} className={!user.is_active ? 'inactive' : ''}>
                  <td>{user.email}</td>
                  <td>
                    {user.first_name && user.last_name 
                      ? `${user.first_name} ${user.last_name}`
                      : (user.first_name || user.last_name || '-')}
                  </td>
                  <td>
                    <span className={`role-badge ${user.role}`}>
                      {user.role === 'admin' ? 'Администратор' : 'Пользователь'}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                      {user.is_active ? 'Активен' : 'Деактивирован'}
                    </span>
                  </td>
                  <td className="actions">
                    <button 
                      className="role-btn" 
                      onClick={() => handleToggleRole(user)}
                      title={user.role === 'admin' ? 'Понизить до пользователя' : 'Повысить до администратора'}
                      disabled={user.email === 'admin@admin.com'} // Нельзя менять роль главного админа
                    >
                      {user.role === 'admin' ? '👤' : '👑'}
                    </button>
                    <button 
                      className="toggle-btn" 
                      onClick={() => handleToggleActive(user)}
                      title={user.is_active ? 'Деактивировать' : 'Активировать'}
                      disabled={user.email === 'admin@admin.com'} // Нельзя деактивировать главного админа
                    >
                      {user.is_active ? '🔴' : '🟢'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style jsx>{`
        .admin-user-container {
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
          justify-content: flex-end;
          margin-bottom: 20px;
        }

        .refresh-btn {
          padding: 8px 16px;
          background-color: #f8f9fa;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
          transition: background-color 0.2s;
        }

        .refresh-btn:hover {
          background-color: #e9ecef;
        }

        .user-list {
          margin-top: 20px;
        }

        .empty-list {
          text-align: center;
          padding: 20px;
          background-color: #f8f9fa;
          border-radius: 4px;
          color: #666;
          border: 1px dashed #ddd;
        }

        .user-table {
          width: 100%;
          border-collapse: collapse;
        }

        .user-table th,
        .user-table td {
          padding: 12px 15px;
          text-align: left;
          border-bottom: 1px solid #e9ecef;
        }

        .user-table th {
          background-color: #f8f9fa;
          font-weight: 500;
          color: #333;
        }

        .user-table tr.inactive {
          background-color: #f9f9f9;
          color: #888;
        }

        .user-table tr:hover {
          background-color: #f1f3f5;
        }

        .role-badge, .status-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
        }

        .role-badge.admin {
          background-color: #cff4fc;
          color: #055160;
        }

        .role-badge.user {
          background-color: #e2e3e5;
          color: #41464b;
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

        .role-btn, .toggle-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 16px;
          padding: 4px;
          border-radius: 4px;
          transition: background-color 0.2s;
        }

        .role-btn:hover, .toggle-btn:hover {
          background-color: #e9ecef;
        }

        .role-btn:disabled, .toggle-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
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