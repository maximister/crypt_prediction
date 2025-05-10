import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import AdminCryptoManager from '../../components/AdminCryptoManager';
import AdminUserManager from '../../components/AdminUserManager';

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('cryptocurrencies');
  const router = useRouter();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      // Проверяем роль администратора через API
      const response = await fetch('http://localhost:8000/check-admin', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        router.push('/auth/login');
        return;
      }

      if (response.status === 403) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error('Ошибка при проверке доступа');
      }

      const data = await response.json();
      setIsAdmin(data.is_admin);
      setLoading(false);
    } catch (err) {
      console.error('Ошибка при проверке прав доступа:', err);
      setIsAdmin(false);
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Проверка прав доступа...</div>;
  }

  if (!isAdmin) {
    return <div className="access-denied">
      <h2>Доступ запрещен</h2>
      <p>У вас нет прав администратора для доступа к этой странице.</p>
      <button 
        className="back-btn" 
        onClick={() => router.push('/')}
      >
        Вернуться на главную
      </button>
      <style jsx>{`
        .access-denied {
          text-align: center;
          margin: 100px auto;
          max-width: 500px;
          padding: 40px;
          background-color: #fff;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h2 {
          color: #dc3545;
          margin-bottom: 15px;
        }
        p {
          margin-bottom: 25px;
          color: #555;
        }
        .back-btn {
          padding: 10px 20px;
          background-color: #4a6cf7;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .back-btn:hover {
          background-color: #3a5ce5;
        }
      `}</style>
    </div>;
  }

  return (
    <div className="admin-dashboard">
      <Head>
        <title>Панель администратора</title>
      </Head>

      <div className="admin-header">
        <h1>Панель администратора</h1>
        <button 
          className="logout-btn" 
          onClick={() => {
            localStorage.removeItem('token');
            router.push('/auth/login');
          }}
        >
          Выйти
        </button>
      </div>

      <div className="admin-tabs">
        <div 
          className={`tab ${activeTab === 'cryptocurrencies' ? 'active' : ''}`}
          onClick={() => setActiveTab('cryptocurrencies')}
        >
          Управление криптовалютами
        </div>
        <div 
          className={`tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Пользователи
        </div>
      </div>

      <div className="admin-content">
        {activeTab === 'cryptocurrencies' && (
          <AdminCryptoManager />
        )}
        
        {activeTab === 'users' && (
          <AdminUserManager />
        )}
      </div>

      <style jsx>{`
        .admin-dashboard {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
        }

        .admin-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid #e0e0e0;
        }

        h1 {
          margin: 0;
          font-size: 2rem;
          color: #333;
        }

        .logout-btn {
          padding: 8px 16px;
          background-color: #dc3545;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .logout-btn:hover {
          background-color: #c82333;
        }

        .admin-tabs {
          display: flex;
          margin-bottom: 2rem;
          border-bottom: 1px solid #e0e0e0;
        }

        .tab {
          padding: 12px 24px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
          border-bottom: 3px solid transparent;
        }

        .tab:hover {
          background-color: #f8f9fa;
        }

        .tab.active {
          border-bottom-color: #4a6cf7;
          color: #4a6cf7;
        }

        .admin-content {
          min-height: 60vh;
        }

        .loading {
          text-align: center;
          padding: 40px;
          margin-top: 50px;
          font-size: 1.2rem;
        }
      `}</style>
    </div>
  );
} 