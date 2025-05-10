import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import PriceChart from './PriceChart';

// Функция для генерации UUID v4
const generateUUID = () => {
    // eslint-disable-next-line
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0,
              v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const generateWidgetId = (dashboardId, widgetIndex) => `widget-${dashboardId}-${widgetIndex}`;

// Начальные размеры и позиции для виджетов
const DEFAULT_WIDGET_LAYOUT = {
    x: 0,
    y: 0,
    w: 6,
    h: 4,
    minW: 3,
    minH: 3
};

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
            id: generateWidgetId('temp', 0),
            layout: DEFAULT_WIDGET_LAYOUT
        }]
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isWidgetModalOpen, setIsWidgetModalOpen] = useState(false);
    const [currentDashboardId, setCurrentDashboardId] = useState(null);
    const [newWidget, setNewWidget] = useState({
        type: 'price_chart',
        coin: 'bitcoin',
        period: '7d',
        chartType: 'real',
        title: 'Bitcoin Price Chart',
        layout: { ...DEFAULT_WIDGET_LAYOUT }
    });

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
        
        // Сохраняем текущее состояние дашбордов в localStorage
        if (dashboards.length > 0) {
            try {
                const dashboardsForStorage = dashboards.map(dashboard => ({
                    id: dashboard.id,
                    widgets: dashboard.widgets.map(widget => ({
                        id: widget.id,
                        layout: widget.layout
                    }))
                }));
                localStorage.setItem('dashboardLayouts', JSON.stringify(dashboardsForStorage));
            } catch (error) {
                console.error('Ошибка при сохранении макетов дашбордов в localStorage:', error);
            }
        }
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

            // Попытка загрузить сохраненные макеты из localStorage
            let savedLayouts = {};
            try {
                const savedLayoutsStr = localStorage.getItem('dashboardLayouts');
                if (savedLayoutsStr) {
                    const savedDashboards = JSON.parse(savedLayoutsStr);
                    savedDashboards.forEach(dashboard => {
                        savedLayouts[dashboard.id] = {};
                        dashboard.widgets.forEach(widget => {
                            savedLayouts[dashboard.id][widget.id] = widget.layout;
                        });
                    });
                }
            } catch (error) {
                console.error('Ошибка при загрузке макетов из localStorage:', error);
            }

            const processedData = data.map(dashboard => {
                console.log('Processing dashboard:', dashboard);
                return {
                    ...dashboard,
                    widgets: dashboard.widgets && dashboard.widgets.length > 0 ? dashboard.widgets.map((widget, index) => {
                        const widgetId = widget.id || generateWidgetId(dashboard.id, index);
                        console.log('Processing widget:', widget, 'with ID:', widgetId);
                        
                        // Используем сохраненный макет, если он есть
                        const savedLayout = savedLayouts[dashboard.id] && savedLayouts[dashboard.id][widgetId];
                        
                        return {
                            ...widget,
                            id: widgetId,
                            // Приоритет: 1) макет из виджета, 2) сохраненный макет, 3) макет по умолчанию
                            layout: widget.layout || savedLayout || {
                                ...DEFAULT_WIDGET_LAYOUT,
                                x: (index % 2) * 6,
                                y: Math.floor(index / 2) * 4
                            }
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

            // Генерируем UUID для нового дашборда вместо временной метки
            const uuid = generateUUID();
            const dashboardWithId = {
                ...newDashboard,
                id: uuid,
                uuid: uuid, // Добавляем отдельное поле uuid для совместимости
                widgets: newDashboard.widgets.map((widget, index) => {
                    const widgetId = generateWidgetId(uuid, index);
                    console.log('Creating widget with ID:', widgetId);
                    return {
                        ...widget,
                        id: widgetId,
                        layout: widget.layout || {
                            ...DEFAULT_WIDGET_LAYOUT,
                            x: (index % 2) * 6,
                            y: Math.floor(index / 2) * 4
                        }
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

            // Убедимся, что UUID сохранен в данных
            const processedData = {
                ...data,
                id: data.id || uuid, // Используем UUID, если сервер не вернул ID
                uuid: data.uuid || uuid, // Сохраняем UUID
                widgets: data.widgets.map((widget, index) => {
                    const widgetId = widget.id || generateWidgetId(data.id || uuid, index);
                    console.log('Processing widget with ID:', widgetId);
                    return {
                        ...widget,
                        id: widgetId,
                        layout: widget.layout || {
                            ...DEFAULT_WIDGET_LAYOUT,
                            x: (index % 2) * 6,
                            y: Math.floor(index / 2) * 4
                        }
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
                    id: generateWidgetId('temp', 0),
                    layout: DEFAULT_WIDGET_LAYOUT
                }]
            });
        } catch (error) {
            console.error('Error creating dashboard:', error);
            setError(error.message);
        }
    };

    const handleDeleteDashboard = async (dashboardId, dashboardUuid) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                router.push('/auth/login');
                return;
            }

            // Используем UUID, если доступен, иначе используем ID
            const dashboardIdentifier = dashboardUuid || dashboardId;

            const response = await fetch(`http://localhost:8000/dashboard/${dashboardIdentifier}`, {
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

    const renderWidget = (widget, dashboardId, dashboardUuid) => {
        if (!widget || !widget.type) {
            console.error('Invalid widget:', widget);
            return null;
        }

        console.log('=== RENDER WIDGET ===');
        console.log('Dashboard ID:', dashboardId);
        console.log('Dashboard UUID:', dashboardUuid);
        console.log('Widget:', widget);

        switch (widget.type) {
            case 'price_chart':
                const widgetProps = {
                    coin: widget.coin,
                    period: widget.period,
                    chartType: widget.chartType,
                    isPrediction: widget.chartType === 'prediction',
                    title: widget.title,
                    widgetId: widget.id
                };
                
                console.log('PriceChart props:', widgetProps);
                
                return (
                    <div className="widget-content">
                        <div className="widget-header">
                        <h3>{widgetProps.title}</h3>
                            <button 
                                className="delete-widget-btn"
                                onClick={() => handleDeleteWidget(dashboardId, dashboardUuid, widget.id)}
                                title="Удалить виджет"
                            >
                                ✕
                            </button>
                        </div>
                        <PriceChart {...widgetProps} />
                    </div>
                );
            default:
                return <div>Неизвестный тип виджета: {widget.type}</div>;
        }
    };

    const handleDeleteWidget = async (dashboardId, dashboardUuid, widgetId) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                router.push('/auth/login');
                return;
            }

            const dashboard = dashboards.find(d => d.id === dashboardId);
            if (!dashboard) {
                throw new Error('Дашборд не найден');
            }

            const updatedWidgets = dashboard.widgets.filter(w => w.id !== widgetId);
            const updatedDashboard = { ...dashboard, widgets: updatedWidgets };

            // Используем UUID, если доступен, иначе используем ID
            const dashboardIdentifier = dashboardUuid || dashboardId;

            const response = await fetch(`http://localhost:8000/dashboard/${dashboardIdentifier}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ widgets: updatedWidgets })
            });

            if (response.status === 401) {
                localStorage.removeItem('token');
                router.push('/auth/login');
                return;
            }

            if (!response.ok) {
                throw new Error('Ошибка при обновлении дашборда');
            }

            // Обновляем локальный стейт
            setDashboards(dashboards.map(d => {
                if (d.id === dashboardId) {
                    return updatedDashboard;
                }
                return d;
            }));
            
        } catch (error) {
            console.error('Error deleting widget:', error);
            setError(error.message);
        }
    };

    if (isLoading) {
        return <div className="loading">Загрузка дашбордов...</div>;
    }

    if (error) {
        return <div className="error">{error}</div>;
    }

    return (
        <div className="dashboard-manager">
            <div className="dashboard-header">
                <h1>Мои дашборды</h1>
                <div className="action-buttons">
                <button 
                        className="add-dashboard-btn"
                    onClick={() => setIsModalOpen(true)}
                >
                    Добавить дашборд
                </button>
                </div>
            </div>

            {dashboards.length === 0 ? (
                <div className="no-dashboards">
                    <p>У вас пока нет дашбордов.</p>
                    <button onClick={() => setIsModalOpen(true)}>Создать первый дашборд</button>
                </div>
            ) : (
                <div className="dashboards-list">
                    {dashboards.map(dashboard => (
                            <div key={dashboard.id} className="dashboard-card">
                            <div className="dashboard-card-header">
                                <h2>{dashboard.name}</h2>
                                <div className="dashboard-card-actions">
                                    <button 
                                        className="view-dashboard-btn"
                                        onClick={() => router.push(`/dashboard/${dashboard.uuid || dashboard.id}`)}
                                    >
                                        Открыть
                                    </button>
                                    <button 
                                        className="delete-dashboard-btn"
                                        onClick={() => handleDeleteDashboard(dashboard.id, dashboard.uuid)}
                                    >
                                        Удалить
                                    </button>
                                </div>
                            </div>
                            <div className="dashboard-preview">
                                <p>{dashboard.widgets.length} виджетов</p>
                                <p>Тип: {dashboard.type === 'price' ? 'Курс валюты' : 'Прогноз курса'}</p>
                            </div>
                        </div>
                    ))}
                    </div>
                )}

            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>Добавить новый дашборд</h2>
                        <div className="form-group">
                            <label>Название</label>
                            <input
                                type="text"
                                value={newDashboard.name}
                                onChange={(e) => setNewDashboard({...newDashboard, name: e.target.value})}
                                placeholder="Название дашборда"
                            />
                        </div>
                        <div className="form-group">
                            <label>Тип</label>
                            <select 
                                value={newDashboard.type} 
                                onChange={(e) => setNewDashboard({...newDashboard, type: e.target.value})}
                            >
                                {dashboardTypes.map(type => (
                                    <option key={type.value} value={type.value}>{type.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="modal-actions">
                            <button 
                                className="cancel-btn"
                                onClick={() => setIsModalOpen(false)}
                            >
                                Отмена
                            </button>
                            <button 
                                className="confirm-btn"
                                onClick={handleAddDashboard}
                                disabled={!newDashboard.name}
                            >
                                Создать
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .dashboard-manager {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 2rem;
                }
                
                .dashboard-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                }
                
                .action-buttons {
                    display: flex;
                    gap: 1rem;
                }

                .add-dashboard-btn {
                    padding: 0.75rem 1.5rem;
                    background-color: #4a6cf7;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-weight: 600;
                }

                .add-dashboard-btn:hover {
                    background-color: #3a5bd9;
                }

                .dashboards-list {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 1.5rem;
                }
                
                .dashboard-card {
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    overflow: hidden;
                    transition: transform 0.2s, box-shadow 0.2s;
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                }

                .dashboard-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
                }

                .dashboard-card-header {
                    padding: 1.25rem;
                    background: #f8f9fa;
                    border-bottom: 1px solid #eee;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-shrink: 0;
                }

                .dashboard-card-header h2 {
                    margin: 0;
                    font-size: 1.25rem;
                    color: #333;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 60%;
                    }

                .dashboard-card-actions {
                    display: flex;
                    gap: 0.5rem;
                    flex-shrink: 0;
                }
                
                .dashboard-preview {
                    padding: 1.25rem;
                    flex-grow: 1;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                }

                .dashboard-preview p {
                    margin: 0.5rem 0;
                    color: #666;
                }

                .view-dashboard-btn,
                .delete-dashboard-btn {
                    padding: 0.5rem 0.75rem;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 500;
                    transition: background 0.2s;
                    white-space: nowrap;
                }

                .view-dashboard-btn {
                    background: #4a6cf7;
                    color: white;
                }

                .view-dashboard-btn:hover {
                    background: #3a5bd9;
                }

                .delete-dashboard-btn {
                    background: #ff5555;
                    color: white;
                }

                .delete-dashboard-btn:hover {
                    background: #e04444;
                }

                .no-dashboards {
                    text-align: center;
                    padding: 3rem;
                    background: #f9f9f9;
                    border-radius: 12px;
                }

                .no-dashboards button {
                    margin-top: 1rem;
                    padding: 0.75rem 1.5rem;
                    background-color: #4a6cf7;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                }
                
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }
                
                .modal-content {
                    background: white;
                    padding: 2rem;
                    border-radius: 12px;
                    width: 500px;
                    max-width: 90%;
                }
                
                .form-group {
                    margin-bottom: 1.5rem;
                }
                
                .form-group label {
                    display: block;
                    margin-bottom: 0.5rem;
                    font-weight: 600;
                }
                
                .form-group input,
                .form-group select {
                    width: 100%;
                    padding: 0.75rem;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    font-size: 1rem;
                }
                
                .modal-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 1rem;
                    margin-top: 2rem;
                }
                
                .cancel-btn,
                .confirm-btn {
                    padding: 0.75rem 1.5rem;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                }
                
                .cancel-btn {
                    background-color: #f2f2f2;
                    color: #333;
                }
                
                .confirm-btn {
                    background-color: #4a6cf7;
                    color: white;
                }
                
                .confirm-btn:disabled {
                    background-color: #cccccc;
                    cursor: not-allowed;
                }
                
                .loading, .error {
                    text-align: center;
                    padding: 2rem;
                }

                .error {
                    color: #ff5555;
                }
                
                .widget-content {
                    padding: 1rem;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    margin-bottom: 1rem;
                }
                
                .widget-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.5rem;
                }
                
                .widget-header h3 {
                    margin: 0;
                    font-size: 1.1rem;
                }
            `}</style>
        </div>
    );
};

export default DashboardManager; 