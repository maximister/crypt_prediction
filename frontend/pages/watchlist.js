import { useState, useEffect } from 'react';
import WatchlistManager from '../components/WatchlistManager';

const WatchlistPage = () => {
    return (
        <div className="watchlist-page">
            <h1>Избранные криптовалюты</h1>
            <WatchlistManager />
            <style jsx>{`
                .watchlist-page {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 2rem;
                }

                h1 {
                    margin-bottom: 2rem;
                    color: #333;
                }
            `}</style>
        </div>
    );
};

export default WatchlistPage; 