import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import PriceChart from './PriceChart';

const generateWidgetId = (dashboardId, widgetIndex) => `widget-${dashboardId}-${widgetIndex}`;

const DashboardManager = () => {
    const router = useRouter();
    const [dashboards, setDashboards] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newDashboard, setNewDashboard] = useState({
        name: '',
        type: 'price',
        widgets: [{
            type: 'price_chart',
            coin: 'bitcoin',
            period: '7d',
            chartType: 'real',
            title: 'Bitcoin Price Chart',
            id: generateWidgetId('temp', 0)
        }]
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const dashboardTypes = [
        { value: 'price', label: 'Курс валюты' },
        { value: 'prediction', label: 'Прогноз курса' }
    ];

    const availableCoins = [
        { value: 'bitcoin', label: 'Bitcoin (BTC)' },
        { value: 'ethereum', label: 'Ethereum (ETH)' },
        { value: 'ripple', label: 'Ripple (XRP)' },
        { value: 'cardano', label: 'Cardano (ADA)' },
        { value: 'solana', label: 'Solana (SOL)' }
    ];

    useEffect(() => {
        console.log('=== DASHBOARD MANAGER MOUNT ===');
        fetchDashboards();
    }, []);

    useEffect(() => {
        console.log('=== DASHBOARDS STATE ===');
        console.log('Current dashboards:', dashboards);
    }, [dashboards]);

    const fetchDashboards = async () => {
        try {
            console.log('=== FETCHING DASHBOARDS ===');
            const token = localStorage.getItem('token');
            if (!token) {
                console.log('No token found, redirecting to login');
                router.push('/auth/login');
                return;
            }

            console.log('Making request to fetch dashboards...');
            const response = await fetch('http://localhost:8000/dashboard', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            console.log('Response status:', response.status);
            if (response.status === 401) {
                console.log('Unauthorized, redirecting to login');
                localStorage.removeItem('token');
                router.push('/auth/login');
                return;
            }

            if (!response.ok) {
                throw new Error('Ошибка при загрузке дашбордов');
            }

            const data = await response.json();
            console.log('Raw dashboard data:', data);

            const processedData = data.map(dashboard => {
                console.log('Processing dashboard:', dashboard);
                return {
                    ...dashboard,
                    widgets: dashboard.widgets && dashboard.widgets.length > 0 ? dashboard.widgets.map((widget, index) => {
                        const widgetId = widget.id || generateWidgetId(dashboard.id, index);
                        console.log('Processing widget:', widget, 'with ID:', widgetId);
                        return {
                            ...widget,
                            id: widgetId
                        };
                    }) : []
                };
            });

            console.log('Processed dashboards:', processedData);
            setDashboards(processedData);
            setIsLoading(false);
        } catch (error) {
            console.error('Error fetching dashboards:', error);
            setError(error.message);
            setIsLoading(false);
        }
    };

    const handleAddDashboard = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                router.push('/auth/login');
                return;
            }

            // Генерируем временный ID для нового дашборда
            const tempId = `temp-${Date.now()}`;
            const dashboardWithId = {
                ...newDashboard,
                id: tempId,
                widgets: newDashboard.widgets.map((widget, index) => {
                    const widgetId = generateWidgetId(tempId, index);
                    console.log('Creating widget with ID:', widgetId);
                    return {
                        ...widget,
                        id: widgetId
                    };
                })
            };

            console.log('Creating new dashboard:', dashboardWithId);

            const response = await fetch('http://localhost:8000/dashboard', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dashboardWithId)
            });

            if (response.status === 401) {
                localStorage.removeItem('token');
                router.push('/auth/login');
                return;
            }

            if (!response.ok) {
                throw new Error('Ошибка при создании дашборда');
            }

            const data = await response.json();
            console.log('Server response:', data);

            const processedData = {
                ...data,
                widgets: data.widgets.map((widget, index) => {
                    const widgetId = widget.id || generateWidgetId(data.id, index);
                    console.log('Processing widget with ID:', widgetId);
                    return {
                        ...widget,
                        id: widgetId
                    };
                })
            };

            console.log('Processed dashboard data:', processedData);
            setDashboards([...dashboards, processedData]);
            setIsModalOpen(false);
            setNewDashboard({
                name: '',
                type: 'price',
                widgets: [{
                    type: 'price_chart',
                    coin: 'bitcoin',
                    period: '7d',
                    chartType: 'real',
                    title: 'Bitcoin Price Chart',
                    id: generateWidgetId('temp', 0)
                }]
            });
        } catch (error) {
            console.error('Error creating dashboard:', error);
            setError(error.message);
        }
    };

    const handleDeleteDashboard = async (dashboardId) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                router.push('/auth/login');
                return;
            }

            const response = await fetch(`http://localhost:8000/dashboard/${dashboardId}`, {
                method: 'DELETE',
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
                throw new Error('Ошибка при удалении дашборда');
            }

            setDashboards(dashboards.filter(d => d.id !== dashboardId));
        } catch (error) {
            setError(error.message);
        }
    };

    const renderWidget = (widget, dashboardId, widgetIndex) => {
        if (!widget || !widget.type) {
            console.error('Invalid widget:', widget);
            return null;
        }

        const widgetId = widget.id || generateWidgetId(dashboardId, widgetIndex);
        console.log('=== RENDER WIDGET ===');
        console.log('Dashboard ID:', dashboardId);
        console.log('Widget Index:', widgetIndex);
        console.log('Widget:', widget);
        console.log('Generated Widget ID:', widgetId);

        switch (widget.type) {
            case 'price_chart':
                const widgetProps = {
                    coin: widget.coin,
                    period: widget.period,
                    chartType: widget.chartType,
                    isPrediction: widget.chartType === 'prediction',
                    title: widget.title,
                    widgetId
                };
                
                console.log('PriceChart props:', widgetProps);
                
                return (
                    <div key={widgetId} className="widget">
                        <h3>{widgetProps.title}</h3>
                        <PriceChart {...widgetProps} />
                    </div>
                );
            default:
                return <div>Неподдерживаемый тип виджета</div>;
        }
    };

    if (isLoading) {
        console.log('Loading state:', isLoading);
        return <div className="loading">Загрузка дашбордов...</div>;
    }

    if (error) {
        console.log('Error state:', error);
        return <div className="error-message">{error}</div>;
    }

    console.log('=== RENDERING DASHBOARDS ===');
    console.log('Current dashboards:', dashboards);

    return (
        <div className="dashboard-manager">
            <div className="dashboard-header">
                <h2>Мои дашборды</h2>
                <button 
                    className="btn btn-primary"
                    onClick={() => setIsModalOpen(true)}
                >
                    Добавить дашборд
                </button>
            </div>

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            <div className="dashboard-grid">
                {dashboards && dashboards.length > 0 ? (
                    dashboards.map((dashboard) => {
                        console.log('=== RENDERING DASHBOARD ===');
                        console.log('Dashboard:', dashboard);
                        return (
                            <div key={dashboard.id} className="dashboard-card">
                                <h3>{dashboard.name}</h3>
                                <div className="dashboard-actions">
                                    <button 
                                        className="btn btn-primary"
                                        onClick={() => router.push(`/dashboard/${dashboard.id}`)}
                                    >
                                        Перейти
                                    </button>
                                    <button 
                                        className="btn btn-secondary"
                                        onClick={() => router.push(`/dashboard/${dashboard.id}/config`)}
                                    >
                                        Настроить
                                    </button>
                                    <button 
                                        className="btn btn-danger"
                                        onClick={() => handleDeleteDashboard(dashboard.id)}
                                    >
                                        Удалить
                                    </button>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="no-dashboards">
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className="modal">
                    <div className="modal-content">
                        <h3>Создать новый дашборд</h3>
                        <div className="form-group">
                            <label>Название</label>
                            <input
                                type="text"
                                value={newDashboard.name}
                                onChange={(e) => setNewDashboard({...newDashboard, name: e.target.value})}
                            />
                        </div>
                        <div className="modal-actions">
                            <button 
                                className="btn btn-primary"
                                onClick={handleAddDashboard}
                            >
                                Создать
                            </button>
                            <button 
                                className="btn btn-secondary"
                                onClick={() => setIsModalOpen(false)}
                            >
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .dashboard-manager {
                    background: #f8fafc;
                    border-radius: 1.1rem;
                    /* box-shadow: 0 4px 24px rgba(0,112,243,0.07), 0 1.5px 4px rgba(0,112,243,0.04); */
                    padding: 2.5rem 20px 2rem 20px;
                    margin: 2.5rem auto 0 auto;
                    width: 1202px;
                    max-width: 100vw;
                }
                
                .dashboard-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                }
                
                .dashboard-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 370px);
                    gap: 1.5rem;
                    justify-content: center;
                }
                
                .dashboard-card {
                    background: white;
                    border-radius: 0.5rem;
                    padding: 2rem 0.5rem 1.7rem 0.5rem;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    width: 100%;
                    max-width: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                }
                @media (max-width: 1240px) {
                    .dashboard-manager {
                        width: 100vw;
                        max-width: 100vw;
                        padding: 1rem 0.5rem;
                        margin: 1rem 0 0 0;
                    }
                    .dashboard-grid {
                        grid-template-columns: 1fr;
                        gap: 0.7rem;
                    }
                }
                
                .dashboard-actions {
                    display: flex;
                    gap: 1.7rem;
                    margin-top: 1rem;
                }
                
                .modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                
                .modal-content {
                    background: white;
                    padding: 2rem;
                    border-radius: 0.5rem;
                    min-width: 400px;
                }
                
                .form-group {
                    margin-bottom: 1rem;
                }
                
                .form-group label {
                    display: block;
                    margin-bottom: 0.5rem;
                }
                
                .form-group input,
                .form-group select {
                    width: 100%;
                    padding: 0.5rem;
                    border: 1px solid #ddd;
                    border-radius: 0.25rem;
                }
                
                .modal-actions {
                    display: flex;
                    gap: 1rem;
                    margin-top: 1rem;
                }
                
                .btn {
                    padding: 0.7rem 1.4rem;
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
                
                .btn-secondary {
                    background-color: #6c757d;
                    color: white;
                }
                
                .btn-secondary:hover {
                    background-color: #5a6268;
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
                
                .no-widgets {
                    padding: 2rem;
                    text-align: center;
                    background: #f8f9fa;
                    border-radius: 0.5rem;
                    margin: 1rem 0;
                }
                
                .no-widgets p {
                    margin-bottom: 1rem;
                    color: #6c757d;
                }
                
                .no-dashboards {
                    padding: 3rem;
                    text-align: center;
                    background: #f8f9fa;
                    border-radius: 0.5rem;
                    margin: 2rem 0;
                }
                
                .no-dashboards p {
                    margin-bottom: 1rem;
                    color: #6c757d;
                    font-size: 1.2rem;
                }
            `}</style>
        </div>
    );
};

export default DashboardManager; 