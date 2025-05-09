import { useRouter } from 'next/router';
import Link from 'next/link';
import { useState, useEffect } from 'react';

const Navbar = () => {
    const router = useRouter();
    const currentPath = router.pathname;
    const [isAuth, setIsAuth] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsAuth(!!localStorage.getItem('token'));
        }
    }, [typeof window !== 'undefined' && localStorage.getItem('token')]);

    const handleLogout = async () => {
        localStorage.removeItem('token');
        try {
            await fetch('http://localhost:8000/logout', { method: 'POST', credentials: 'include' });
        } catch (e) {}
        setShowLogoutModal(false);
        setIsAuth(false);
        router.push('/');
    };

    const navItems = [
        { path: '/dashboard', label: 'Дашборды' },
        { path: '/watchlist', label: 'Избранное' }
    ];

    return (
        <nav className="navbar">
            <div className="navbar-content">
                <Link href="/" className="navbar-logo">Crypto Tracker</Link>
                <div className="navbar-links">
                    {navItems.map(item => (
                        <Link 
                            key={item.path} 
                            href={item.path}
                            className={`navbar-link ${currentPath === item.path ? 'active' : ''}`}
                        >
                            {item.label}
                        </Link>
                    ))}
                    {isAuth ? (
                        <>
                            <Link 
                                href="/profile" 
                                className={`navbar-link ${currentPath === '/profile' ? 'active' : ''}`}
                            >
                                Личный кабинет
                            </Link>
                            <button className="navbar-link navbar-logout-btn" onClick={() => setShowLogoutModal(true)}>
                                Выйти
                            </button>
                        </>
                    ) : (
                        <div className="navbar-auth-block">
                            <Link href="/auth/login" className="navbar-link">Войти</Link>
                        </div>
                    )}
                </div>
            </div>
            {showLogoutModal && (
                <div className="logout-modal-overlay">
                    <div className="logout-modal">
                        <p>Вы действительно хотите выйти из аккаунта?</p>
                        <div className="logout-modal-actions">
                            <button className="auth-btn" onClick={handleLogout}>Выйти</button>
                            <button className="auth-btn" style={{background:'#e5e7eb',color:'#222'}} onClick={() => setShowLogoutModal(false)}>Отмена</button>
                        </div>
                    </div>
                </div>
            )}
            <style jsx>{`
                .navbar {
                    background: white;
                    padding: 1rem 2rem;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    z-index: 1000;
                }

                .navbar-content {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }

                .navbar-logo {
                    font-size: 1.5rem;
                    font-weight: bold;
                    color: #007bff;
                    text-decoration: none;
                    flex-grow: 1;
                }

                .navbar-links {
                    display: flex;
                    gap: 2rem;
                    align-items: center;
                }

                .navbar-link {
                    color: #333;
                    text-decoration: none;
                    padding: 0.5rem 1rem;
                    border-radius: 4px;
                    transition: all 0.2s;
                    background: none;
                    border: none;
                    font: inherit;
                    cursor: pointer;
                }

                .navbar-link:hover {
                    background: #f8f9fa;
                }

                .navbar-link.active {
                    background: #007bff;
                    color: white;
                }

                .navbar-logout-btn {
                    color: #dc2626;
                    font-weight: 600;
                }

                .logout-modal-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.18);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 2000;
                }

                .logout-modal {
                    background: #fff;
                    border-radius: 12px;
                    box-shadow: 0 4px 24px rgba(0,0,0,0.09);
                    padding: 2rem 2.5rem 1.5rem 2.5rem;
                    min-width: 320px;
                    text-align: center;
                }

                .logout-modal-actions {
                    display: flex;
                    gap: 1rem;
                    margin-top: 1.5rem;
                    justify-content: center;
                }

                .navbar-auth-block {
                    display: flex;
                    gap: 0.5rem;
                    background: #f3f6fa;
                    border-radius: 8px;
                    padding: 0.25rem 1rem;
                    box-shadow: 0 1px 4px rgba(0,112,243,0.04);
                    align-items: center;
                    margin-left: 2rem;
                }
                .navbar-auth-block .navbar-link {
                    color: #0070f3;
                    font-weight: 500;
                    background: none;
                    border: none;
                    border-radius: 6px;
                    padding: 0.5rem 1.1rem;
                    transition: background 0.15s, color 0.15s;
                }
                .navbar-auth-block .navbar-link:hover {
                    background: #e3eefe;
                    color: #0051b3;
                }

                @media (max-width: 768px) {
                    .navbar {
                        padding: 1rem;
                    }

                    .navbar-links {
                        gap: 1rem;
                    }

                    .navbar-link {
                        padding: 0.5rem;
                    }
                }
            `}</style>
        </nav>
    );
};

export default Navbar; 