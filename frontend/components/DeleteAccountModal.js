import { useState } from 'react';
import { useRouter } from 'next/router';

const DeleteAccountModal = ({ isOpen, onClose }) => {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [confirmText, setConfirmText] = useState('');

    const handleDelete = async () => {
        if (confirmText !== 'УДАЛИТЬ') {
            setError('Для подтверждения введите слово УДАЛИТЬ');
            return;
        }
        
        setIsLoading(true);
        setError('');
        
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setError('Вы не авторизованы');
                setIsLoading(false);
                return;
            }
            
            const response = await fetch('http://localhost:8000/account', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || 'Ошибка при удалении аккаунта');
            }
            
            // Удаляем токен авторизации
            localStorage.removeItem('token');
            
            // Перенаправляем на главную страницу
            router.push('/');
            
        } catch (error) {
            setError(error.message);
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h3>Удаление аккаунта</h3>
                    <button className="close-button" onClick={onClose}>&times;</button>
                </div>
                
                <div className="modal-body">
                    <div className="warning-icon">⚠️</div>
                    <p className="warning-text">
                        Вы собираетесь удалить свой аккаунт. Это действие необратимо.
                    </p>
                    <p>
                        Все ваши данные будут удалены, включая:
                    </p>
                    <ul>
                        <li>Личную информацию</li>
                        <li>Список избранных криптовалют</li>
                        <li>Настроенные дашборды</li>
                    </ul>
                    
                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}
                    
                    <div className="confirm-group">
                        <label>Для подтверждения введите слово <strong>УДАЛИТЬ</strong></label>
                        <input
                            type="text"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="УДАЛИТЬ"
                        />
                    </div>
                </div>
                
                <div className="modal-footer">
                    <button 
                        className="cancel-btn" 
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        Отмена
                    </button>
                    <button 
                        className="delete-btn" 
                        onClick={handleDelete}
                        disabled={isLoading || confirmText !== 'УДАЛИТЬ'}
                    >
                        {isLoading ? 'Удаление...' : 'Удалить аккаунт'}
                    </button>
                </div>
            </div>
            
            <style jsx>{`
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }
                
                .modal-content {
                    background: white;
                    border-radius: 8px;
                    width: 90%;
                    max-width: 500px;
                    padding: 20px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                }
                
                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    padding-bottom: 10px;
                    border-bottom: 1px solid #eee;
                }
                
                .modal-header h3 {
                    margin: 0;
                    color: #333;
                }
                
                .close-button {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #999;
                }
                
                .close-button:hover {
                    color: #333;
                }
                
                .modal-body {
                    margin-bottom: 20px;
                }
                
                .warning-icon {
                    font-size: 48px;
                    text-align: center;
                    margin-bottom: 15px;
                }
                
                .warning-text {
                    color: #dc3545;
                    font-weight: bold;
                    margin-bottom: 15px;
                }
                
                ul {
                    margin: 10px 0;
                    padding-left: 20px;
                }
                
                li {
                    margin-bottom: 5px;
                }
                
                .confirm-group {
                    margin-top: 20px;
                }
                
                .confirm-group label {
                    display: block;
                    margin-bottom: 8px;
                }
                
                .confirm-group input {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-size: 16px;
                }
                
                .modal-footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                    padding-top: 15px;
                    border-top: 1px solid #eee;
                }
                
                .cancel-btn {
                    padding: 10px 15px;
                    background: #f1f1f1;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    color: #333;
                }
                
                .delete-btn {
                    padding: 10px 15px;
                    background: #dc3545;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    color: white;
                }
                
                .delete-btn:hover:not(:disabled) {
                    background: #c82333;
                }
                
                .delete-btn:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }
                
                .error-message {
                    background-color: #f8d7da;
                    color: #721c24;
                    padding: 10px;
                    border-radius: 4px;
                    margin: 15px 0;
                    font-size: 14px;
                }
            `}</style>
        </div>
    );
};

export default DeleteAccountModal; 