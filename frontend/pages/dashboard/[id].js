import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import PriceChart from '../../components/PriceChart';

const DashboardPage = () => {
    const router = useRouter();
    const { id } = router.query;
    const [dashboard, setDashboard] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (id) {
            fetchDashboard();
        }
    }, [id]);

    const fetchDashboard = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                router.push('/auth/login');
                return;
            }

            const response = await fetch('http://localhost:8000/dashboard', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 401) {
                localStorage.removeItem('token');
                router.push('/auth/login');
                return;
            }

            if (!response.ok) {
                throw new Error('Ошибка при загрузке дашборда');
            }

            const dashboards = await response.json();
            const currentDashboard = dashboards.find(d => d.id === id);
            
            if (!currentDashboard) {
                throw new Error('Дашборд не найден');
            }

            setDashboard(currentDashboard);
        } catch (error) {
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return <div className="loading">Загрузка...</div>;
    }

    if (error) {
        return <div className="error-message">{error}</div>;
    }

    if (!dashboard) {
        return <div className="error-message">Дашборд не найден</div>;
    }

    return (
        <div className="dashboard-page">
            <Head>
                <title>{dashboard.name} - Криптовалютный трекер</title>
            </Head>
            
            <div className="dashboard-header">
                <h1>{dashboard.name}</h1>
                <button 
                    className="btn btn-primary"
                    onClick={() => router.push(`/dashboard/${id}/config`)}
                >
                    Настроить
                </button>
            </div>

            <div className="widgets-grid">
                {dashboard.widgets.map((widget) => (
                    <div key={widget.id} className="widget-card">
                        <h3>{widget.title}</h3>
                        <PriceChart 
                            coin={widget.coin} 
                            period={widget.period} 
                            chartType={widget.chartType} 
                            widgetId={widget.id}
                        />
                    </div>
                ))}
            </div>

            <style jsx>{`
                .dashboard-page {
                    padding: 20px;
                    max-width: 1200px;
                    margin: 0 auto;
                }

                .dashboard-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 30px;
                }

                .widgets-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
                    gap: 20px;
                }

                .widget-card {
                    background: white;
                    border-radius: 8px;
                    padding: 20px;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }

                h1 {
                    margin: 0;
                    font-size: 2rem;
                    color: #333;
                }

                h3 {
                    margin: 0 0 15px 0;
                    color: #444;
                }

                .btn {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 500;
                    transition: all 0.2s;
                }

                .btn:hover {
                    opacity: 0.9;
                }

                .btn-primary {
                    background: #007bff;
                    color: white;
                }

                .loading {
                    text-align: center;
                    padding: 40px;
                    font-size: 1.2rem;
                    color: #666;
                }

                .error-message {
                    background: #fff3f3;
                    color: #dc3545;
                    padding: 15px;
                    border-radius: 4px;
                    margin-bottom: 20px;
                }
            `}</style>
        </div>
    );
};

export default DashboardPage; 