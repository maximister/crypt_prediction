import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import PriceChart from '../../components/PriceChart';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

// Функция для генерации UUID v4
const generateUUID = () => {
    // eslint-disable-next-line
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0,
              v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// Начальные размеры и позиции для виджетов
const DEFAULT_WIDGET_LAYOUT = {
    x: 0,
    y: 0,
    w: 6,
    h: 4,
    minW: 2,
    minH: 2
};

const generateWidgetId = (dashboardId, widgetIndex) => `widget-${String(dashboardId)}-${widgetIndex}`;

const DashboardPage = () => {
    const router = useRouter();
    const { id } = router.query;
    const [dashboard, setDashboard] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [isWidgetModalOpen, setIsWidgetModalOpen] = useState(false);
    const [editingTitleId, setEditingTitleId] = useState(null);
    const [newTitle, setNewTitle] = useState('');
    const titleInputRef = useRef(null);
    const [newWidget, setNewWidget] = useState({
        type: 'price_chart',
        coin: 'bitcoin',
        period: '7d',
        chartType: 'real',
        title: 'Bitcoin Price Chart'
    });
    const [editingDashboardTitle, setEditingDashboardTitle] = useState(false);
    const [newDashboardTitle, setNewDashboardTitle] = useState('');
    const dashboardTitleInputRef = useRef(null);

    const availableCoins = [
        { value: 'bitcoin', label: 'Bitcoin (BTC)' },
        { value: 'ethereum', label: 'Ethereum (ETH)' },
        { value: 'ripple', label: 'Ripple (XRP)' },
        { value: 'cardano', label: 'Cardano (ADA)' },
        { value: 'solana', label: 'Solana (SOL)' }
    ];

    useEffect(() => {
        if (id) {
            fetchDashboard();
        }
    }, [id]);

    const fetchDashboard = async () => {
        try {
            console.log('Fetching dashboard with ID:', id);
            
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
            console.log('All dashboards:', dashboards);
            
            // Ищем дашборд по ID или UUID, преобразуя строки для корректного сравнения
            let currentDashboard = dashboards.find(d => 
                String(d.id) === String(id) || 
                (d.uuid && String(d.uuid) === String(id))
            );
            
            console.log('Found dashboard:', currentDashboard);
            
            if (!currentDashboard) {
                console.error('Dashboard not found with ID or UUID:', id);
                console.log('Available dashboards:');
                dashboards.forEach((d, index) => {
                    console.log(`Dashboard ${index + 1}:`, { id: d.id, uuid: d.uuid, name: d.name });
                });
                throw new Error('Дашборд не найден');
            }
            
            // Убедимся, что UUID есть в дашборде
            if (!currentDashboard.uuid) {
                console.log('Adding missing UUID to dashboard');
                currentDashboard.uuid = currentDashboard.id;
            }
            
            // Проверяем и обновляем layout для каждого виджета, если нужно
            if (currentDashboard.widgets) {
                currentDashboard.widgets = currentDashboard.widgets.map((widget, index) => {
                    return {
                        ...widget,
                        layout: widget.layout || {
                            ...DEFAULT_WIDGET_LAYOUT,
                            x: (index % 2) * 6,  // Размещаем в две колонки
                            y: Math.floor(index / 2) * 4  // Новый ряд каждые два виджета
                        }
                    };
                });
            }

            setDashboard(currentDashboard);
            console.log('Dashboard loaded successfully');
        } catch (error) {
            console.error('Error fetching dashboard:', error);
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleLayoutChange = async (layout) => {
        if (!editMode || !dashboard) return;
        
        try {
            // Обновляем локальный стейт с новым расположением виджетов
            const updatedWidgets = dashboard.widgets.map(widget => {
                const layoutItem = layout.find(item => item.i === widget.id);
                if (layoutItem) {
                    return {
                        ...widget,
                        layout: {
                            x: layoutItem.x,
                            y: layoutItem.y,
                            w: layoutItem.w,
                            h: layoutItem.h,
                            minW: layoutItem.minW || 3,
                            minH: layoutItem.minH || 3
                        }
                    };
                }
                return widget;
            });

            const updatedDashboard = {
                ...dashboard,
                widgets: updatedWidgets
            };

            // Debounce для предотвращения слишком частых обновлений
            if (window.layoutChangeTimeout) {
                clearTimeout(window.layoutChangeTimeout);
            }

            // Обновляем локальный стейт немедленно для отзывчивого UI
            setDashboard(updatedDashboard);

            // Задержка перед отправкой на сервер
            window.layoutChangeTimeout = setTimeout(async () => {
                const token = localStorage.getItem('token');
                if (!token) {
                    router.push('/auth/login');
                    return;
                }

                // Используем UUID для идентификации дашборда
                const dashboardId = dashboard.uuid || dashboard.id;

                const response = await fetch(`http://localhost:8000/dashboard/${dashboardId}`, {
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
                    throw new Error('Ошибка при сохранении расположения виджетов');
                }
            }, 500); // Ждем 500 мс перед отправкой на сервер
        } catch (error) {
            setError(error.message);
        }
    };

    const handleAddWidget = () => {
        setIsWidgetModalOpen(true);
    };

    const handleDeleteWidget = async (widgetId) => {
        try {
            if (!dashboard) return;
            
            const updatedWidgets = dashboard.widgets.filter(w => w.id !== widgetId);
            const updatedDashboard = {
                ...dashboard,
                widgets: updatedWidgets
            };
            
            // Обновляем локальный стейт
            setDashboard(updatedDashboard);
            
            // Отправляем изменения на сервер
            const token = localStorage.getItem('token');
            if (!token) {
                router.push('/auth/login');
                return;
            }
            
            // Используем UUID для идентификации дашборда
            const dashboardId = dashboard.uuid || dashboard.id;
            
            const response = await fetch(`http://localhost:8000/dashboard/${dashboardId}`, {
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
                throw new Error('Ошибка при удалении виджета');
            }
        } catch (error) {
            setError(error.message);
        }
    };

    const handleAddWidgetConfirm = async () => {
        try {
            if (!dashboard) return;
            
            // Создаем ID для нового виджета, используя UUID дашборда если доступен
            const dashboardIdentifier = dashboard.uuid || dashboard.id;
            const newWidgetId = generateWidgetId(dashboardIdentifier, dashboard.widgets.length);
            
            // Определяем начальную позицию (после последнего виджета или внизу)
            const layoutY = dashboard.widgets.length > 0 
                ? Math.max(...dashboard.widgets.map(w => w.layout.y + w.layout.h)) + 1 
                : 0;
                
            const widgetToAdd = {
                ...newWidget,
                id: newWidgetId,
                layout: {
                    ...DEFAULT_WIDGET_LAYOUT,
                    x: 0,
                    y: layoutY
                }
            };
            
            const updatedDashboard = {
                ...dashboard,
                widgets: [...dashboard.widgets, widgetToAdd]
            };
            
            // Обновляем локальный стейт
            setDashboard(updatedDashboard);
            
            // Отправляем изменения на сервер
            const token = localStorage.getItem('token');
            if (!token) {
                router.push('/auth/login');
                return;
            }
            
            // Используем UUID для идентификации дашборда
            const dashboardId = dashboard.uuid || dashboard.id;
            
            const response = await fetch(`http://localhost:8000/dashboard/${dashboardId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ widgets: updatedDashboard.widgets })
            });
            
            if (response.status === 401) {
                localStorage.removeItem('token');
                router.push('/auth/login');
                return;
            }
            
            if (!response.ok) {
                throw new Error('Ошибка при добавлении виджета');
            }
            
            setIsWidgetModalOpen(false);
        } catch (error) {
            setError(error.message);
        }
    };

    const handleResizeWidget = (widgetId, size) => {
        if (!dashboard) return;

        // Определяем размеры в зависимости от выбранного варианта
        let newWidth, newHeight;
        switch (size) {
            case 'small':
                newWidth = 4;
                newHeight = 3;
                break;
            case 'medium':
                newWidth = 6;
                newHeight = 4;
                break;
            case 'large':
                newWidth = 8;
                newHeight = 5;
                break;
            default:
                return;
        }

        // Находим виджет и обновляем его размеры
        const updatedWidgets = dashboard.widgets.map(widget => {
            if (widget.id === widgetId) {
                return {
                    ...widget,
                    layout: {
                        ...widget.layout,
                        w: newWidth,
                        h: newHeight
                    }
                };
            }
            return widget;
        });

        // Создаем обновленный дашборд с новыми размерами виджета
        const updatedDashboard = {
            ...dashboard,
            widgets: updatedWidgets
        };

        // Обновляем локальный стейт
        setDashboard(updatedDashboard);

        // Сохраняем изменения на сервере с debounce
        if (window.resizeWidgetTimeout) {
            clearTimeout(window.resizeWidgetTimeout);
        }

        window.resizeWidgetTimeout = setTimeout(async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    router.push('/auth/login');
                    return;
                }

                const response = await fetch(`http://localhost:8000/dashboard/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(updatedDashboard)
                });

                if (response.status === 401) {
                    localStorage.removeItem('token');
                    router.push('/auth/login');
                    return;
                }

                if (!response.ok) {
                    throw new Error('Ошибка при изменении размера виджета');
                }
            } catch (error) {
                setError(error.message);
            }
        }, 300);
    };

    const handleEditTitle = (widgetId, currentTitle) => {
        if (!editMode) return;
        setEditingTitleId(widgetId);
        setNewTitle(currentTitle);
        // Фокус на инпуте в следующем цикле рендеринга
        setTimeout(() => {
            if (titleInputRef.current) {
                titleInputRef.current.focus();
                titleInputRef.current.select();
            }
        }, 10);
    };

    const handleTitleChange = (event) => {
        setNewTitle(event.target.value);
    };

    const saveTitleChange = async () => {
        if (!editingTitleId || !dashboard) return;
        
        try {
            // Обновляем заголовок локально
            const updatedWidgets = dashboard.widgets.map(widget => {
                if (widget.id === editingTitleId) {
                    return {
                        ...widget,
                        title: newTitle.trim() || 'Виджет' // Если пустой, устанавливаем дефолтное значение
                    };
                }
                return widget;
            });
            
            const updatedDashboard = {
                ...dashboard,
                widgets: updatedWidgets
            };
            
            // Обновляем состояние
            setDashboard(updatedDashboard);
            setEditingTitleId(null);
            
            // Отправляем на сервер
            const token = localStorage.getItem('token');
            if (!token) {
                router.push('/auth/login');
                return;
            }
            
            // Используем UUID для идентификации дашборда
            const dashboardId = dashboard.uuid || dashboard.id;
            
            const response = await fetch(`http://localhost:8000/dashboard/${dashboardId}`, {
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
                throw new Error('Ошибка при обновлении заголовка виджета');
            }
        } catch (error) {
            setError(error.message);
        }
    };

    const handleTitleKeyDown = (event) => {
        if (event.key === 'Enter') {
            saveTitleChange();
        } else if (event.key === 'Escape') {
            setEditingTitleId(null);
        }
    };

    const handleClickOutside = (event) => {
        if (titleInputRef.current && !titleInputRef.current.contains(event.target)) {
            saveTitleChange();
        }
    };

    useEffect(() => {
        // Добавляем обработчик клика для закрытия редактирования при клике вне поля ввода
        if (editingTitleId) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [editingTitleId]);

    const handleEditDashboardTitle = () => {
        if (!editMode || !dashboard) return;
        
        try {
            setEditingDashboardTitle(true);
            setNewDashboardTitle(dashboard.name || '');
            
            // Фокус на инпуте в следующем цикле рендеринга
            setTimeout(() => {
                if (dashboardTitleInputRef.current) {
                    dashboardTitleInputRef.current.focus();
                    dashboardTitleInputRef.current.select();
                }
            }, 10);
        } catch (error) {
            console.error('Error starting dashboard title edit:', error);
            setEditingDashboardTitle(false);
        }
    };

    const handleDashboardTitleChange = (event) => {
        setNewDashboardTitle(event.target.value);
    };

    const handleDashboardTitleKeyDown = (event) => {
        if (event.key === 'Enter') {
            saveDashboardTitle();
        } else if (event.key === 'Escape') {
            setEditingDashboardTitle(false);
        }
    };

    const handleDashboardTitleClickOutside = (event) => {
        if (dashboardTitleInputRef.current && !dashboardTitleInputRef.current.contains(event.target)) {
            saveDashboardTitle();
        }
    };

    useEffect(() => {
        // Обработчик клика вне поля ввода для заголовка дашборда
        if (editingDashboardTitle) {
            document.addEventListener('mousedown', handleDashboardTitleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleDashboardTitleClickOutside);
        }
        
        return () => {
            document.removeEventListener('mousedown', handleDashboardTitleClickOutside);
        };
    }, [editingDashboardTitle]);

    const saveDashboardTitle = async () => {
        if (!editingDashboardTitle || !dashboard) return;
        
        try {
            console.log('Saving dashboard title...');
            console.log('Dashboard ID:', dashboard.id);
            console.log('Dashboard UUID:', dashboard.uuid);
            
            const trimmedTitle = (newDashboardTitle || '').trim();
            // Если заголовок пустой, устанавливаем дефолтное значение
            const updatedTitle = trimmedTitle || 'Мой дашборд';
            
            console.log('New title:', updatedTitle);
            
            // Если название не изменилось, просто закрываем режим редактирования
            if (updatedTitle === dashboard.name) {
                console.log('Title not changed, exiting edit mode');
                setEditingDashboardTitle(false);
                return;
            }
            
            // Обновляем данные локально, сохраняя оригинальный ID дашборда
            const updatedDashboard = {
                ...dashboard,
                name: updatedTitle,
                id: dashboard.id, // Явно сохраняем оригинальный ID дашборда
                uuid: dashboard.uuid || dashboard.id // Убедимся, что UUID сохранен
            };
            
            // Обновляем состояние
            setDashboard(updatedDashboard);
            setEditingDashboardTitle(false);
            
            // Отправляем на сервер
            const token = localStorage.getItem('token');
            if (!token) {
                router.push('/auth/login');
                return;
            }
            
            // Используем оригинальный ID дашборда для запроса
            const dashboardId = dashboard.uuid || dashboard.id;
            console.log('Using dashboard identifier for API request:', dashboardId);
            
            // Отправляем только необходимые данные для обновления
            const requestBody = {
                widgets: dashboard.widgets,
                name: updatedTitle
            };
            
            console.log('Sending PUT request to update dashboard');
            console.log('Request body:', JSON.stringify(requestBody));
            
            const response = await fetch(`http://localhost:8000/dashboard/${dashboardId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            console.log('Response status:', response.status);
            
            if (response.status === 401) {
                localStorage.removeItem('token');
                router.push('/auth/login');
                return;
            }
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Error response:', errorData);
                throw new Error(`Ошибка при обновлении названия дашборда: ${response.status} ${errorData.detail || ''}`);
            }
            
            console.log('Dashboard title updated successfully');
        } catch (error) {
            console.error('Error saving dashboard title:', error);
            setError(error.message);
            setEditingDashboardTitle(false);
            
            // Показать ошибку пользователю в дополнительном уведомлении
            alert(`Ошибка при сохранении названия дашборда: ${error.message}`);
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

    // Защищенный render дашборда
    const renderDashboardHeader = () => {
        if (!dashboard) return null;
        
        return (
            <div className="dashboard-header">
                {editingDashboardTitle ? (
                    <div className="dashboard-title-edit-container">
                        <input
                            ref={dashboardTitleInputRef}
                            type="text"
                            className="dashboard-title-input"
                            value={newDashboardTitle}
                            onChange={handleDashboardTitleChange}
                            onKeyDown={handleDashboardTitleKeyDown}
                            onBlur={saveDashboardTitle}
                        />
                    </div>
                ) : (
                    <h1 
                        onClick={handleEditDashboardTitle}
                        className={editMode ? 'editable' : ''}
                        title={editMode ? 'Нажмите, чтобы изменить название дашборда' : ''}
                    >
                        {dashboard.name || 'Мой дашборд'}
                        {editMode && (
                            <span className="edit-indicator">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M3 17.25V21H6.75L17.81 9.94L14.06 6.19L3 17.25ZM20.71 7.04C21.1 6.65 21.1 6.02 20.71 5.63L18.37 3.29C17.98 2.9 17.35 2.9 16.96 3.29L15.13 5.12L18.88 8.87L20.71 7.04Z" fill="currentColor"/>
                                </svg>
                            </span>
                        )}
                    </h1>
                )}
                <div className="dashboard-actions">
                    <button 
                        className={`btn btn-edit ${editMode ? 'active' : ''}`}
                        onClick={() => setEditMode(!editMode)}
                    >
                        {editMode ? 'Готово' : 'Редактировать'}
                    </button>
                    {editMode && (
                        <button 
                            className="btn btn-add-widget"
                            onClick={handleAddWidget}
                        >
                            Добавить виджет
                        </button>
                    )}
                    <button 
                        className="btn btn-primary"
                        onClick={() => router.push(`/dashboard/${dashboard.uuid || dashboard.id}/config`)}
                    >
                        Настроить
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="dashboard-page">
            <Head>
                <title>{dashboard?.name || 'Дашборд'} - Криптовалютный трекер</title>
            </Head>
            
            {renderDashboardHeader()}

            {editMode && (
                <div className="edit-mode-banner">
                    <div className="edit-mode-info">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM11 7H13V9H11V7ZM11 11H13V17H11V11Z" fill="currentColor"/>
                        </svg>
                        <p>Режим редактирования: перетаскивайте виджеты и меняйте их размер. Перетаскивание - за заголовок, изменение размера - за нижний правый угол.</p>
                    </div>
                </div>
            )}

            <ResponsiveGridLayout
                className={`layout ${editMode ? 'edit-mode' : ''}`}
                layouts={{
                    lg: dashboard.widgets.map(widget => ({
                        i: widget.id,
                        x: widget.layout?.x || 0,
                        y: widget.layout?.y || 0,
                        w: widget.layout?.w || 6,
                        h: widget.layout?.h || 4,
                        minW: 4,
                        minH: 3,
                        maxW: 12
                    }))
                }}
                breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                rowHeight={100}
                margin={[16, 16]}
                containerPadding={[16, 16]}
                isDraggable={editMode}
                isResizable={editMode}
                onLayoutChange={(layout) => handleLayoutChange(layout)}
                useCSSTransforms={true}
                compactType="vertical"
                preventCollision={false}
                draggableHandle=".widget-header"
                transformScale={1}
                resizeHandles={['se']}
            >
                {dashboard.widgets.map((widget) => (
                    <div key={widget.id} className="widget-container">
                        <div className="widget-content">
                            <div className="widget-header">
                                {editingTitleId === widget.id ? (
                                    <input
                                        ref={titleInputRef}
                                        type="text"
                                        className="widget-title-input"
                                        value={newTitle}
                                        onChange={handleTitleChange}
                                        onKeyDown={handleTitleKeyDown}
                                        onBlur={saveTitleChange}
                                    />
                                ) : (
                                    <h3 
                                        onClick={() => handleEditTitle(widget.id, widget.title)}
                                        className={editMode ? 'editable' : ''}
                                        title={editMode ? 'Нажмите, чтобы изменить заголовок' : ''}
                                    >
                                        {widget.title}
                                        {editMode && (
                                            <span className="edit-indicator">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M3 17.25V21H6.75L17.81 9.94L14.06 6.19L3 17.25ZM20.71 7.04C21.1 6.65 21.1 6.02 20.71 5.63L18.37 3.29C17.98 2.9 17.35 2.9 16.96 3.29L15.13 5.12L18.88 8.87L20.71 7.04Z" fill="currentColor"/>
                                                </svg>
                                            </span>
                                        )}
                                    </h3>
                                )}
                                <div className="widget-controls">
                                    <button 
                                        className="view-crypto-btn"
                                        onClick={() => router.push(`/crypto/${widget.coin}`)}
                                        title="Перейти на страницу валюты"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M12 4.5C7 4.5 2.73 7.61 1 12C2.73 16.39 7 19.5 12 19.5C17 19.5 21.27 16.39 23 12C21.27 7.61 17 4.5 12 4.5ZM12 17C9.24 17 7 14.76 7 12C7 9.24 9.24 7 12 7C14.76 7 17 9.24 17 12C17 14.76 14.76 17 12 17ZM12 9C10.34 9 9 10.34 9 12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12C15 10.34 13.66 9 12 9Z" fill="#4a6cf7"/>
                                        </svg>
                                    </button>
                                    {editMode && (
                                        <>
                                            <button 
                                                className="delete-widget-btn"
                                                onClick={() => handleDeleteWidget(widget.id)}
                                                title="Удалить виджет"
                                            >
                                                ✕
                                            </button>
                                            <div className="drag-handle">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M8 18H10V22H14V18H16L12 14L8 18ZM16 6H14V2H10V6H8L12 10L16 6Z" fill="currentColor"/>
                                                </svg>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                            <PriceChart 
                                coin={widget.coin} 
                                period={widget.period} 
                                chartType={widget.chartType} 
                                widgetId={widget.id}
                            />
                        </div>
                    </div>
                ))}
            </ResponsiveGridLayout>

            {isWidgetModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>Добавить новый виджет</h2>
                        <div className="form-group">
                            <label>Заголовок</label>
                            <input 
                                type="text" 
                                value={newWidget.title} 
                                onChange={(e) => setNewWidget({...newWidget, title: e.target.value})}
                                placeholder="Название виджета"
                            />
                        </div>
                        <div className="form-group">
                            <label>Монета</label>
                            <select 
                                value={newWidget.coin} 
                                onChange={(e) => setNewWidget({...newWidget, coin: e.target.value})}
                            >
                                {availableCoins.map(coin => (
                                    <option key={coin.value} value={coin.value}>{coin.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Период</label>
                            <select 
                                value={newWidget.period} 
                                onChange={(e) => setNewWidget({...newWidget, period: e.target.value})}
                            >
                                <option value="1d">1 день</option>
                                <option value="7d">7 дней</option>
                                <option value="30d">30 дней</option>
                                <option value="90d">90 дней</option>
                                <option value="365d">1 год</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Тип графика</label>
                            <select 
                                value={newWidget.chartType} 
                                onChange={(e) => setNewWidget({...newWidget, chartType: e.target.value})}
                            >
                                <option value="real">Реальные данные</option>
                                <option value="prediction">Прогноз</option>
                            </select>
                        </div>
                        <div className="modal-actions">
                            <button 
                                className="cancel-btn"
                                onClick={() => setIsWidgetModalOpen(false)}
                            >
                                Отмена
                            </button>
                            <button 
                                className="confirm-btn"
                                onClick={handleAddWidgetConfirm}
                                disabled={!newWidget.title}
                            >
                                Добавить
                            </button>
                        </div>
                    </div>
                </div>
            )}

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

                .dashboard-actions {
                    display: flex;
                    gap: 10px;
                }

                h1 {
                    margin: 0;
                    font-size: 2rem;
                    color: #333;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                h1.editable {
                    cursor: pointer;
                    padding: 8px 12px;
                    margin: -8px -12px;
                    border-radius: 6px;
                    transition: background-color 0.2s;
                }
                
                h1.editable:hover {
                    background-color: rgba(74, 108, 247, 0.1);
                }
                
                h1 .edit-indicator {
                    opacity: 0;
                    transition: opacity 0.2s;
                    color: #4a6cf7;
                }
                
                h1.editable:hover .edit-indicator {
                    opacity: 1;
                }
                
                .dashboard-title-edit-container {
                    flex-grow: 1;
                    max-width: 60%;
                }
                
                .dashboard-title-input {
                    font-size: 2rem;
                    font-weight: bold;
                    padding: 8px 12px;
                    border: 1px solid #4a6cf7;
                    border-radius: 6px;
                    background-color: white;
                    color: #333;
                    width: 100%;
                    outline: none;
                    box-shadow: 0 0 0 2px rgba(74, 108, 247, 0.2);
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
                
                .btn-edit {
                    background: #f8f9fa;
                    color: #495057;
                    border: 1px solid #ddd;
                }
                
                .btn-edit.active {
                    background: #4a6cf7;
                    color: white;
                    border-color: #4a6cf7;
                }

                .btn-add-widget {
                    background: #28a745;
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
                
                .edit-mode-banner {
                    margin-bottom: 20px;
                    padding: 12px;
                    background: rgba(74, 108, 247, 0.1);
                    border-radius: 8px;
                    border-left: 4px solid #4a6cf7;
                }
                
                .edit-mode-info {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    color: #4a6cf7;
                }
                
                .edit-mode-info p {
                    margin: 0;
                    font-size: 0.95rem;
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
            `}</style>

            <style jsx global>{`
                .widget-container {
                    background: white;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    transition: all 0.2s;
                    height: 100%;
                }

                .layout.edit-mode .widget-container {
                    border: 2px dashed transparent;
                    transition: border-color 0.2s;
                }
                
                .layout.edit-mode .widget-container:hover {
                    border-color: #4a6cf7;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
                }

                .widget-content {
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    padding: 16px;
                    box-sizing: border-box;
                    min-height: 280px;
                }

                .widget-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                    flex-shrink: 0;
                }

                .widget-header h3 {
                    margin: 0;
                    font-size: 1.1rem;
                    color: #444;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 80%;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                
                .widget-header h3.editable {
                    cursor: pointer;
                    padding: 4px 8px;
                    margin: -4px -8px;
                    border-radius: 4px;
                    transition: background-color 0.2s;
                }
                
                .widget-header h3.editable:hover {
                    background-color: rgba(74, 108, 247, 0.1);
                }
                
                .widget-header h3 .edit-indicator {
                    opacity: 0;
                    transition: opacity 0.2s;
                    color: #4a6cf7;
                }
                
                .widget-header h3.editable:hover .edit-indicator {
                    opacity: 1;
                }
                
                .widget-title-input {
                    font-size: 1.1rem;
                    font-weight: bold;
                    padding: 4px 8px;
                    border: 1px solid #4a6cf7;
                    border-radius: 4px;
                    background-color: white;
                    color: #444;
                    width: 70%;
                    outline: none;
                    box-shadow: 0 0 0 2px rgba(74, 108, 247, 0.2);
                }
                
                .widget-controls {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .view-crypto-btn {
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background-color 0.2s;
                }
                
                .view-crypto-btn:hover {
                    background-color: rgba(74, 108, 247, 0.1);
                }
                
                .delete-widget-btn {
                    background: none;
                    border: none;
                    font-size: 16px;
                    line-height: 1;
                    color: #ff5555;
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .delete-widget-btn:hover {
                    background: rgba(255, 85, 85, 0.1);
                }

                .drag-handle {
                    cursor: move;
                    color: #888;
                    width: 16px;
                    height: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .drag-handle:hover {
                    color: #333;
                }

                .react-grid-item > .react-resizable-handle {
                    position: absolute;
                    width: 40px;
                    height: 40px;
                    bottom: 0;
                    right: 0;
                    background-color: rgba(255, 255, 255, 0.7);
                    border-top-left-radius: 8px;
                    cursor: se-resize;
                    z-index: 10;
                }

                .react-grid-item > .react-resizable-handle::after {
                    content: "";
                    position: absolute;
                    right: 12px;
                    bottom: 12px;
                    width: 16px;
                    height: 16px;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%234a6cf7'%3E%3Cpath d='M21,15.5C21,16.33 20.33,17 19.5,17C18.67,17 18,16.33 18,15.5C18,14.67 18.67,14 19.5,14C20.33,14 21,14.67 21,15.5M14.5,17C13.67,17 13,16.33 13,15.5C13,14.67 13.67,14 14.5,14C15.33,14 16,14.67 16,15.5C16,16.33 15.33,17 14.5,17M18,11.5C18,12.33 17.33,13 16.5,13C15.67,13 15,12.33 15,11.5C15,10.67 15.67,10 16.5,10C17.33,10 18,10.67 18,11.5M21,7.5C21,8.33 20.33,9 19.5,9C18.67,9 18,8.33 18,7.5C18,6.67 18.67,6 19.5,6C20.33,6 21,6.67 21,7.5M19.5,3C20.33,3 21,3.67 21,4.5C21,5.33 20.33,6 19.5,6C18.67,6 18,5.33 18,4.5C18,3.67 18.67,3 19.5,3M14.5,3C15.33,3 16,3.67 16,4.5C16,5.33 15.33,6 14.5,6C13.67,6 13,5.33 13,4.5C13,3.67 13.67,3 14.5,3M9.5,3C10.33,3 11,3.67 11,4.5C11,5.33 10.33,6 9.5,6C8.67,6 8,5.33 8,4.5C8,3.67 8.67,3 9.5,3M9.5,9C10.33,9 11,9.67 11,10.5C11,11.33 10.33,12 9.5,12C8.67,12 8,11.33 8,10.5C8,9.67 8.67,9 9.5,9M9.5,13C10.33,13 11,13.67 11,14.5C11,15.33 10.33,16 9.5,16C8.67,16 8,15.33 8,14.5C8,13.67 8.67,13 9.5,13M9.5,19C10.33,19 11,19.67 11,20.5C11,21.33 10.33,22 9.5,22C8.67,22 8,21.33 8,20.5C8,19.67 8.67,19 9.5,19M14.5,19C15.33,19 16,19.67 16,20.5C16,21.33 15.33,22 14.5,22C13.67,22 13,21.33 13,20.5C13,19.67 13.67,19 14.5,19M19.5,19C20.33,19 21,19.67 21,20.5C21,21.33 20.33,22 19.5,22C18.67,22 18,21.33 18,20.5C18,19.67 18.67,19 19.5,19M7,4.5C7,5.33 6.33,6 5.5,6C4.67,6 4,5.33 4,4.5C4,3.67 4.67,3 5.5,3C6.33,3 7,3.67 7,4.5M5.5,9C6.33,9 7,9.67 7,10.5C7,11.33 6.33,12 5.5,12C4.67,12 4,11.33 4,10.5C4,9.67 4.67,9 5.5,9M5.5,13C6.33,13 7,13.67 7,14.5C7,15.33 6.33,16 5.5,16C4.67,16 4,15.33 4,14.5C4,13.67 4.67,13 5.5,13M5.5,19C6.33,19 7,19.67 7,20.5C7,21.33 6.33,22 5.5,22C4.67,22 4,21.33 4,20.5C4,19.67 4.67,19 5.5,19M3,7.5C3,6.67 3.67,6 4.5,6C5.33,6 6,6.67 6,7.5C6,8.33 5.33,9 4.5,9C3.67,9 3,8.33 3,7.5Z' /%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    background-position: center;
                    background-size: contain;
                }
                
                .react-grid-item.react-grid-placeholder {
                    background: rgba(0, 112, 243, 0.2);
                    border: 2px dashed #0070f3;
                    border-radius: 8px;
                    transition-duration: 100ms;
                    z-index: 2;
                    user-select: none;
                }
                
                .react-grid-item.cssTransforms {
                    transition-property: transform, width, height;
                    transition-duration: 200ms;
                    transition-timing-function: ease;
                }
                
                .react-grid-item.resizing {
                    z-index: 1;
                    will-change: width, height;
                }
                
                .react-grid-item.react-draggable-dragging {
                    z-index: 3;
                    will-change: transform;
                    opacity: 0.8;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
                }
                
                /* Стили для адаптации графиков внутри виджетов */
                .widget-content > div {
                    flex-grow: 1;
                    min-height: 0;
                    display: flex;
                    flex-direction: column;
                }
                
                .widget-content canvas {
                    width: 100% !important;
                    height: auto !important;
                    max-height: 100%;
                    min-height: 220px;
                }
            `}</style>
        </div>
    );
};

export default DashboardPage; 