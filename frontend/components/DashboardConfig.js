import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

const DashboardConfig = ({ dashboardId }) => {
    const router = useRouter();
    const [dashboard, setDashboard] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [widgets, setWidgets] = useState([]);

    useEffect(() => {
        fetchDashboard();
    }, [dashboardId]);

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
            const currentDashboard = dashboards.find(d => d.id === dashboardId);
            
            if (!currentDashboard) {
                throw new Error('Дашборд не найден');
            }

            setDashboard(currentDashboard);
            setWidgets(currentDashboard.widgets || []);
        } catch (error) {
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddWidget = () => {
        const newWidget = {
            id: Date.now().toString(),
            type: dashboard.type === 'price' ? 'price_chart' : 'prediction_chart',
            title: 'Новый виджет',
            coin: 'bitcoin',
            period: '7d'
        };
        setWidgets([...widgets, newWidget]);
    };

    const handleUpdateWidget = (widgetId, updates) => {
        setWidgets(widgets.map(widget => 
            widget.id === widgetId ? { ...widget, ...updates } : widget
        ));
    };

    const handleRemoveWidget = (widgetId) => {
        setWidgets(widgets.filter(widget => widget.id !== widgetId));
    };

    const handleSave = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                router.push('/auth/login');
                return;
            }

            const response = await fetch(`http://localhost:8000/dashboard/${dashboardId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    widgets: widgets
                })
            });

            if (response.status === 401) {
                localStorage.removeItem('token');
                router.push('/auth/login');
                return;
            }

            if (!response.ok) {
                throw new Error('Ошибка при сохранении дашборда');
            }

            router.push('/dashboard');
        } catch (error) {
            setError(error.message);
        }
    };

    if (isLoading) {
        return <div className="loading">Загрузка...</div>;
    }

    if (error) {
        return <div className="error-message">{error}</div>;
    }

    return (
        <div className="dashboard-config">
            <div className="config-header">
                <h2>Настройка дашборда: {dashboard.name}</h2>
                <div className="config-actions">
                    <button className="btn btn-primary" onClick={handleAddWidget}>
                        Добавить виджет
                    </button>
                    <button className="btn btn-success" onClick={handleSave}>
                        Сохранить
                    </button>
                </div>
            </div>

            <div className="widgets-grid">
                {widgets.map((widget) => (
                    <div key={widget.id} className="widget-card">
                        <div className="widget-header">
                            <input
                                type="text"
                                value={widget.title}
                                onChange={(e) => handleUpdateWidget(widget.id, { title: e.target.value })}
                                className="widget-title"
                            />
                            <button
                                className="btn btn-danger"
                                onClick={() => handleRemoveWidget(widget.id)}
                            >
                                Удалить
                            </button>
                        </div>
                        <div className="widget-settings">
                            <div className="form-group">
                                <label>Криптовалюта</label>
                                <select
                                    value={widget.coin}
                                    onChange={(e) => handleUpdateWidget(widget.id, { coin: e.target.value })}
                                >
                                    <option value="bitcoin">Bitcoin (BTC)</option>
                                    <option value="ethereum">Ethereum (ETH)</option>
                                    <option value="binancecoin">Binance Coin (BNB)</option>
                                    <option value="cardano">Cardano (ADA)</option>
                                    <option value="solana">Solana (SOL)</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Период</label>
                                <select
                                    value={widget.period}
                                    onChange={(e) => handleUpdateWidget(widget.id, { period: e.target.value })}
                                >
                                    <option value="1d">1 день</option>
                                    <option value="7d">7 дней</option>
                                    <option value="30d">30 дней</option>
                                    <option value="90d">90 дней</option>
                                </select>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <style>{`
                .dashboard-config {
                    padding: 2rem;
                }
                
                .config-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                }
                
                .config-actions {
                    display: flex;
                    gap: 1rem;
                }
                
                .widgets-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 1.5rem;
                }
                
                .widget-card {
                    background: white;
                    border-radius: 0.5rem;
                    padding: 1.5rem;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                
                .widget-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }
                
                .widget-title {
                    flex: 1;
                    padding: 0.5rem;
                    border: 1px solid #ddd;
                    border-radius: 0.25rem;
                    margin-right: 1rem;
                }
                
                .widget-settings {
                    display: grid;
                    gap: 1rem;
                }
                
                .form-group {
                    margin-bottom: 1rem;
                }
                
                .form-group label {
                    display: block;
                    margin-bottom: 0.5rem;
                }
                
                .form-group select {
                    width: 100%;
                    padding: 0.5rem;
                    border: 1px solid #ddd;
                    border-radius: 0.25rem;
                }
                
                .btn {
                    padding: 0.5rem 1rem;
                    border-radius: 0.25rem;
                    border: none;
                    cursor: pointer;
                    font-weight: 500;
                    transition: background-color 0.2s;
                }
                
                .btn-primary {
                    background-color: #0070f3;
                    color: white;
                }
                
                .btn-primary:hover {
                    background-color: #0051b3;
                }
                
                .btn-success {
                    background-color: #28a745;
                    color: white;
                }
                
                .btn-success:hover {
                    background-color: #218838;
                }
                
                .btn-danger {
                    background-color: #dc3545;
                    color: white;
                }
                
                .btn-danger:hover {
                    background-color: #c82333;
                }
                
                .loading {
                    text-align: center;
                    padding: 2rem;
                    color: #666;
                }
                
                .error-message {
                    background-color: #fee2e2;
                    color: #dc2626;
                    padding: 1rem;
                    border-radius: 0.25rem;
                    margin-bottom: 1rem;
                }
            `}</style>
        </div>
    );
};

export default DashboardConfig; 