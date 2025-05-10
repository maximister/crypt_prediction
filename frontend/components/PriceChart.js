import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateWidgetSettings } from '../store/widgetSettingsSlice';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale,
    Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import { ru } from 'date-fns/locale';
import { format, subDays, startOfDay, endOfDay, parseISO, isValid } from 'date-fns';
import cryptoDataService from '../services/CryptoDataService';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale,
    Filler
);

const PERIODS = [
    { value: '1d', label: '1 день', allowPrediction: false },
    { value: '7d', label: '7 дней', allowPrediction: true },
    { value: '30d', label: '30 дней', allowPrediction: true },
    { value: '90d', label: '90 дней', allowPrediction: true },
    { value: '365d', label: '1 год', allowPrediction: true }
];

const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
        mode: 'index',
        intersect: false,
    },
    plugins: {
        legend: {
            position: 'top',
            labels: {
                font: {
                    size: 14
                }
            }
        },
        title: {
            display: true,
            text: 'Цена криптовалюты',
            font: {
                size: 16
            }
        }
    },
    scales: {
        x: {
            type: 'time',
            time: {
                unit: 'day',
                tooltipFormat: 'dd.MM.yyyy HH:mm',
                displayFormats: {
                    hour: 'HH:mm',
                    day: 'dd.MM',
                    week: 'dd.MM',
                    month: 'MM.yyyy'
                }
            },
            adapters: {
                date: {
                    locale: ru
                }
            }
        },
        y: {
            beginAtZero: false,
            title: {
                display: true,
                text: 'Цена (USD)'
            }
        }
    }
};

const PriceChart = ({ 
    coin = 'bitcoin', 
    period: initialPeriod = '7d', 
    isPrediction = false, 
    title = '', 
    chartType = 'real',
    widgetId
}) => {
    console.log('=== PRICECHART MOUNT ===');
    console.log('Props:', { coin, initialPeriod, isPrediction, title, chartType, widgetId });

    const dispatch = useDispatch();
    const widgetSettings = useSelector(state => {
        console.log('=== REDUX STATE ===');
        console.log('Full state:', state);
        console.log('Widget ID:', widgetId);
        console.log('Widget settings:', state.widgetSettings.widgets[widgetId]);
        return state.widgetSettings.widgets[widgetId] || {};
    });
    
    console.log('=== PRICECHART STATE ===');
    console.log('Widget ID:', widgetId);
    console.log('Widget settings:', widgetSettings);
    
    const [chartData, setChartData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [period, setPeriod] = useState(widgetSettings.period || initialPeriod);
    const [customDates, setCustomDates] = useState(widgetSettings.customDates || false);
    const [startDate, setStartDate] = useState(widgetSettings.startDate || '');
    const [endDate, setEndDate] = useState(widgetSettings.endDate || '');
    const [draftStartDate, setDraftStartDate] = useState(startDate);
    const [draftEndDate, setDraftEndDate] = useState(endDate);
    const [applyClicked, setApplyClicked] = useState(false);

    useEffect(() => {
        if (!widgetId) {
            console.error('=== PRICECHART ERROR ===');
            console.error('widgetId is undefined');
            return;
        }

        console.log('=== PRICECHART SETTINGS UPDATE ===');
        console.log('Widget ID:', widgetId);
        console.log('Settings:', {
            period,
            customDates,
            startDate,
            endDate
        });
        
        dispatch(updateWidgetSettings({
            widgetId,
            settings: {
                period,
                customDates,
                startDate,
                endDate
            }
        }));
    }, [period, customDates, startDate, endDate, dispatch, widgetId]);

    useEffect(() => {
        console.log('PriceChart mounted/updated with props:', {
            coin,
            period,
            isPrediction,
            title,
            chartType,
            customDates,
            startDate,
            endDate
        });

        if (customDates && !applyClicked) return;
        fetchPriceData();
        setApplyClicked(false);
    }, [coin, period, isPrediction, chartType, customDates, startDate, endDate, applyClicked, widgetId]);

    const handlePeriodChange = (newPeriod) => {
        const selectedPeriod = PERIODS.find(p => p.value === newPeriod);
        if (chartType !== 'real' && !selectedPeriod.allowPrediction) {
            setError('Прогнозирование недоступно для выбранного периода');
            return;
        }
        setCustomDates(false);
        setPeriod(newPeriod);
        setError(null);
    };

    const handleCustomDatesToggle = () => {
        setCustomDates(!customDates);
        setError(null);
        setDraftStartDate(startDate);
        setDraftEndDate(endDate);
    };

    const handleDraftDateChange = (type, value) => {
        setError(null);
        if (type === 'start') {
            if (new Date(value) > new Date(draftEndDate)) {
                setError('Дата начала не может быть позже даты окончания');
                return;
            }
            setDraftStartDate(value);
        } else {
            if (new Date(value) < new Date(draftStartDate)) {
                setError('Дата окончания не может быть раньше даты начала');
                return;
            }
            setDraftEndDate(value);
        }
    };

    const handleApplyCustomDates = () => {
        setStartDate(draftStartDate);
        setEndDate(draftEndDate);
        setApplyClicked(true);
    };

    const fetchPriceData = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const isRealData = chartType === 'real';
            
            let data;
            if (isRealData) {
                // Получаем исторические данные
                const days = periodToDays(period);
                data = await cryptoDataService.getHistoricalData(coin, days);
            } else {
                // Получаем прогнозные данные
                const days = periodToDays(period);
                data = await cryptoDataService.getForecast(coin, days);
            }
            
            if (!data || (!data.prices && !data.forecast && !data.predictions)) {
                throw new Error('Нет данных за указанный период');
            }

            // Преобразуем данные в формат для графика
            let priceData;
            if (isRealData) {
                priceData = data.prices;
            } else {
                // Для прогнозов преобразуем данные в нужный формат
                priceData = data.predictions || data.forecast || [];
                if (!Array.isArray(priceData)) {
                    // Если данные пришли в другом формате, преобразуем их
                    priceData = Object.entries(priceData).map(([timestamp, value]) => [
                        parseInt(timestamp),
                        value
                    ]);
                }
            }
            
            if (!priceData || priceData.length === 0) {
                throw new Error('Нет данных за указанный период');
            }

            const chartData = {
                labels: priceData.map(item => {
                    const timestamp = typeof item[0] === 'string' ? parseInt(item[0]) : item[0];
                    return new Date(timestamp);
                }),
                datasets: [
                    {
                        label: title || `${isRealData ? 'Цена' : 'Прогноз'} ${coin.toUpperCase()}`,
                        data: priceData.map(item => typeof item[1] === 'string' ? parseFloat(item[1]) : item[1]),
                        borderColor: isRealData ? 'rgba(75, 192, 192, 1)' : 'rgba(255, 99, 132, 1)',
                        backgroundColor: isRealData ? 'rgba(75, 192, 192, 0.2)' : 'rgba(255, 99, 132, 0.2)',
                        tension: 0.1
                    }
                ]
            };

            setChartData(chartData);
        } catch (err) {
            console.error('Ошибка при загрузке данных:', err);
            setError(err.message || 'Произошла ошибка при загрузке данных');
            setChartData(null);
        } finally {
            setLoading(false);
        }
    };

    // Вспомогательная функция для преобразования периода в количество дней
    const periodToDays = (period) => {
        switch(period) {
            case '1d': return '1d';
            case '7d': return '7d';
            case '30d': return '30d';
            case '90d': return '90d';
            case '180d': return '180d';
            case '365d': return '365d';
            case 'max': return 'max';
            default: return '7d';
        }
    };

    const renderControls = () => (
        <div className="price-chart-controls">
            <div className="controls-container">
                <div className="period-buttons">
                    {PERIODS.map(p => {
                        const isDisabled = chartType !== 'real' && !p.allowPrediction;
                        return (
                            <button
                                key={p.value}
                                onClick={() => handlePeriodChange(p.value)}
                                className={`period-button ${p.value === period && !customDates ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
                                disabled={loading || isDisabled}
                                title={isDisabled ? 'Прогнозирование недоступно для этого периода' : ''}
                            >
                                {p.label}
                            </button>
                        );
                    })}
                    <button
                        onClick={handleCustomDatesToggle}
                        className={`period-button ${customDates ? 'active' : ''}`}
                        disabled={loading}
                    >
                        Свой период
                    </button>
                </div>
                {customDates && (
                    <div className="date-inputs">
                        <div className="date-input-group">
                            <label>Начало:</label>
                            <input
                                type="date"
                                value={draftStartDate}
                                onChange={(e) => handleDraftDateChange('start', e.target.value)}
                                disabled={loading}
                            />
                        </div>
                        <div className="date-input-group">
                            <label>Конец:</label>
                            <input
                                type="date"
                                value={draftEndDate}
                                onChange={(e) => handleDraftDateChange('end', e.target.value)}
                                disabled={loading}
                            />
                        </div>
                        <button
                            className="period-button apply-btn"
                            style={{marginLeft: '1rem', marginTop: '1.5rem'}}
                            onClick={handleApplyCustomDates}
                            disabled={loading || !draftStartDate || !draftEndDate || new Date(draftStartDate) > new Date(draftEndDate)}
                        >
                            Применить
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="price-chart-container">
                {renderControls()}
                <div className="chart-loading">Загрузка...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="price-chart-container">
                {renderControls()}
                <div className="chart-error">{error}</div>
            </div>
        );
    }

    if (!chartData) {
        return (
            <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                Нет данных для отображения
            </div>
        );
    }

    // Обновляем опции с учетом заголовка
    const chartOptions = {
        ...options,
        plugins: {
            ...options.plugins,
            title: {
                ...options.plugins.title,
                text: title || `Цена ${coin.toUpperCase()}`
            }
        }
    };

    return (
        <div className="price-chart-container">
            {renderControls()}
            <div className="chart-container">
                {loading && (
                    <div className="loading-overlay">
                        <div className="loading-spinner"></div>
                        <p>Загрузка данных...</p>
                    </div>
                )}
                
                {error && (
                    <div className="error-message">
                        <p>{error}</p>
                        <button onClick={fetchPriceData} disabled={loading}>
                            Попробовать снова
                        </button>
                    </div>
                )}

                {chartData && !error && (
                    <Line data={chartData} options={chartOptions} />
                )}
            </div>

            <style jsx>{`
                .price-chart-container {
                    width: 100%;
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 1rem;
                }

                .chart-controls {
                    margin-bottom: 1rem;
                }

                .period-buttons {
                    display: flex;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                    margin-bottom: 1rem;
                }

                .period-button {
                    padding: 12px 28px;
                    margin-right: 0;
                    border: none;
                    border-radius: 10px;
                    background: #f3f4f6;
                    color: #1a237e;
                    font-weight: 700;
                    font-size: 1.12rem;
                    cursor: pointer;
                    transition: background 0.18s, color 0.18s, box-shadow 0.18s, transform 0.12s;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.04);
                    outline: none;
                    position: relative;
                    letter-spacing: 0.02em;
                }

                .period-button:not(:last-child) {
                    margin-right: 10px;
                }

                .period-button.active {
                    background: linear-gradient(90deg, #0070f3 60%, #00c6fb 100%);
                    color: #fff;
                    box-shadow: 0 4px 16px rgba(0,112,243,0.18);
                    transform: scale(1.06);
                    border: 1.5px solid #0070f3;
                }

                .period-button:hover:not(.active):not(:disabled) {
                    background: #e0e7ef;
                    color: #0070f3;
                    box-shadow: 0 2px 8px rgba(0,112,243,0.10);
                    transform: scale(1.03);
                }

                .period-button:active {
                    transform: scale(0.97);
                }

                .period-button.disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    background: #f5f5f5;
                    color: #aaa;
                }

                .date-inputs {
                    display: flex;
                    gap: 1rem;
                    flex-wrap: wrap;
                }

                .date-input-group {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .date-input-group input {
                    padding: 0.5rem;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                }

                .chart-container {
                    position: relative;
                    height: 400px;
                    background: white;
                    border-radius: 8px;
                    padding: 1rem;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }

                .loading-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    background: rgba(255,255,255,0.9);
                    z-index: 1;
                }

                .loading-spinner {
                    width: 40px;
                    height: 40px;
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #007bff;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin-bottom: 1rem;
                }

                .error-message {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    text-align: center;
                    color: #dc3545;
                }

                .error-message button {
                    margin-top: 1rem;
                    padding: 0.5rem 1rem;
                    border: none;
                    border-radius: 4px;
                    background: #dc3545;
                    color: white;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .error-message button:hover:not(:disabled) {
                    background: #c82333;
                }

                .error-message button:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                .widget-card {
                    background: #fff;
                    border-radius: 12px;
                    box-shadow: 0 4px 16px rgba(0,0,0,0.08), 0 1.5px 4px rgba(0,112,243,0.04);
                    padding: 2rem 1.5rem;
                    margin-bottom: 2rem;
                    transition: box-shadow 0.2s, transform 0.2s;
                    border: 1px solid #f0f0f0;
                }
                .widget-card:hover {
                    box-shadow: 0 8px 32px rgba(0,112,243,0.10), 0 2px 8px rgba(0,0,0,0.06);
                    transform: translateY(-2px) scale(1.01);
                }
            `}</style>
        </div>
    );
};

export default PriceChart; 