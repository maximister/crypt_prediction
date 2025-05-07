import React from 'react';
import Head from 'next/head';
import DashboardManager from '../components/DashboardManager';
import WatchlistManager from '../components/WatchlistManager';

export default function DashboardPage() {
    return (
        <>
            <Head>
                <title>Дашборд - Crypto Analytics</title>
                <meta name="description" content="Управление дашбордами и списком отслеживания криптовалют" />
            </Head>
            <div className="dashboard-container">
                <h1>Дашборд</h1>
                <DashboardManager />
                <WatchlistManager />
            </div>
            <style jsx global>{`
                body {
                    background-color: #f5f5f5;
                    margin: 0;
                    padding: 0;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                }
                h1 {
                    color: #333;
                    margin-bottom: 30px;
                    font-size: 2.5rem;
                    font-weight: 600;
                }
                .loading {
                    text-align: center;
                    padding: 20px;
                    color: #666;
                    font-size: 1.1rem;
                }
                .dashboard-container {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 20px;
                }
            `}</style>
        </>
    );
} 