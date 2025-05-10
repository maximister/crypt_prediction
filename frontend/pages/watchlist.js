import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import WatchlistManager from '../components/WatchlistManager';
import WatchlistDashboard from '../components/WatchlistDashboard';
import PriceAlerts from '../components/PriceAlerts';

const WatchlistPage = () => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const router = useRouter();
    
    // Обработка параметра tab в URL
    useEffect(() => {
        if (router.query.tab) {
            const tab = router.query.tab;
            if (['dashboard', 'manage', 'alerts'].includes(tab)) {
                setActiveTab(tab);
            }
        }
    }, [router.query]);

    // Обновление URL при переключении вкладки
    const handleTabChange = (tab) => {
        setActiveTab(tab);
        router.push(`/watchlist?tab=${tab}`, undefined, { shallow: true });
    };

    return (
        <div className="watchlist-page">
            <Head>
                <title>Избранные криптовалюты</title>
            </Head>
            
            <h1>Избранные криптовалюты</h1>
            
            <div className="tabs">
                <button 
                    className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
                    onClick={() => handleTabChange('dashboard')}
                >
                    Дашборд
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'manage' ? 'active' : ''}`}
                    onClick={() => handleTabChange('manage')}
                >
                    Управление списком
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'alerts' ? 'active' : ''}`}
                    onClick={() => handleTabChange('alerts')}
                >
                    Уведомления
                </button>
            </div>
            
            {activeTab === 'dashboard' && <WatchlistDashboard />}
            {activeTab === 'manage' && <WatchlistManager />}
            {activeTab === 'alerts' && <PriceAlerts />}
            
            <style jsx>{`
                .watchlist-page {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 2rem;
                }

                h1 {
                    margin-bottom: 1.5rem;
                    color: #333;
                }
                
                .tabs {
                    display: flex;
                    margin-bottom: 2rem;
                    border-bottom: 1px solid #ddd;
                }
                
                .tab-btn {
                    padding: 10px 20px;
                    background: none;
                    border: none;
                    border-bottom: 3px solid transparent;
                    margin-right: 20px;
                    cursor: pointer;
                    font-size: 1rem;
                    color: #666;
                    transition: all 0.2s;
                }
                
                .tab-btn:hover {
                    color: #333;
                }
                
                .tab-btn.active {
                    color: #4a6cf7;
                    border-bottom-color: #4a6cf7;
                    font-weight: bold;
                }
            `}</style>
        </div>
    );
};

export default WatchlistPage; 