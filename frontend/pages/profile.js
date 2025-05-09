import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import PasswordChangeModal from '../components/PasswordChangeModal';
import DeleteAccountModal from '../components/DeleteAccountModal';

const ProfilePage = () => {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: ''
    });
    const [isSaving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        // Проверка авторизации
        const token = localStorage.getItem('token');
        if (!token) {
            router.push('/auth/login');
            return;
        }

        // Загрузка данных пользователя с сервера
        const fetchUserData = async () => {
            try {
                const response = await fetch('http://localhost:8000/profile', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (response.ok) {
                    const userData = await response.json();
                    setUser(userData);
                    setFormData({
                        first_name: userData.first_name || '',
                        last_name: userData.last_name || ''
                    });
                } else {
                    // Если токен недействителен, перенаправляем на страницу входа
                    if (response.status === 401) {
                        localStorage.removeItem('token');
                        router.push('/auth/login');
                    }
                }
            } catch (error) {
                console.error('Ошибка при загрузке данных профиля:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [router]);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const saveProfile = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;

        setSaving(true);
        setMessage(null);

        try {
            const response = await fetch('http://localhost:8000/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                const updatedUser = await response.json();
                setUser(updatedUser);
                setMessage({ type: 'success', text: 'Профиль успешно обновлен' });
                setIsEditing(false);
            } else {
                setMessage({ type: 'error', text: 'Ошибка при обновлении профиля' });
            }
        } catch (error) {
            console.error('Ошибка при обновлении профиля:', error);
            setMessage({ type: 'error', text: 'Ошибка при обновлении профиля' });
        } finally {
            setSaving(false);
        }
    };

    const cancelEdit = () => {
        // Восстанавливаем исходные данные из user
        setFormData({
            first_name: user.first_name || '',
            last_name: user.last_name || ''
        });
        setIsEditing(false);
        setMessage(null);
    };

    if (loading) {
        return (
            <div className="profile-container loading">
                <div className="loader"></div>
                <p>Загрузка данных...</p>
                <style jsx>{`
                    .profile-container.loading {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        min-height: calc(100vh - 100px);
                    }
                    .loader {
                        border: 4px solid #f3f3f3;
                        border-top: 4px solid #007bff;
                        border-radius: 50%;
                        width: 40px;
                        height: 40px;
                        animation: spin 1s linear infinite;
                        margin-bottom: 20px;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    // Формируем отображаемое имя пользователя
    const displayName = user.first_name && user.last_name 
        ? `${user.first_name} ${user.last_name}` 
        : user.first_name || user.last_name || 'Пользователь';

    // Формируем инициал для аватара
    const avatarInitial = user.first_name 
        ? user.first_name.charAt(0).toUpperCase() 
        : user.email.charAt(0).toUpperCase();

    return (
        <div className="profile-container">
            <h1>Личный кабинет</h1>
            
            <div className="profile-card">
                <div className="profile-header">
                    <div className="profile-avatar">
                        {avatarInitial}
                    </div>
                    <div className="profile-info">
                        <h2>{displayName}</h2>
                        <p>{user.email}</p>
                    </div>
                </div>
                
                <div className="profile-section">
                    <div className="section-header">
                        <h3>Настройки профиля</h3>
                        {!isEditing && (
                            <button 
                                className="edit-btn" 
                                onClick={() => setIsEditing(true)}
                            >
                                Изменить профиль
                            </button>
                        )}
                    </div>
                    
                    {message && (
                        <div className={`message ${message.type}`}>
                            {message.text}
                        </div>
                    )}
                    
                    <div className="form-group">
                        <label>Имя</label>
                        <input 
                            type="text" 
                            name="first_name"
                            value={formData.first_name} 
                            onChange={handleChange}
                            disabled={!isEditing}
                            className={isEditing ? 'editable' : ''}
                        />
                    </div>
                    
                    <div className="form-group">
                        <label>Фамилия</label>
                        <input 
                            type="text" 
                            name="last_name"
                            value={formData.last_name} 
                            onChange={handleChange}
                            disabled={!isEditing}
                            className={isEditing ? 'editable' : ''}
                        />
                    </div>
                    
                    <div className="form-group">
                        <label>Email</label>
                        <input 
                            type="email" 
                            value={user.email} 
                            disabled 
                        />
                    </div>
                    
                    {isEditing && (
                        <div className="form-actions">
                            <button 
                                className="cancel-btn" 
                                onClick={cancelEdit}
                                disabled={isSaving}
                            >
                                Отмена
                            </button>
                            <button 
                                className="save-btn" 
                                onClick={saveProfile}
                                disabled={isSaving}
                            >
                                {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
                            </button>
                        </div>
                    )}
                </div>
                
                <div className="profile-section">
                    <h3>Безопасность</h3>
                    <button 
                        className="change-password-btn"
                        onClick={() => setShowPasswordModal(true)}
                    >
                        Изменить пароль
                    </button>
                </div>

                <div className="profile-section danger-zone">
                    <h3>Опасная зона</h3>
                    <p className="danger-text">
                        Удаление аккаунта приведет к безвозвратной потере всех ваших данных.
                    </p>
                    <button 
                        className="delete-account-btn"
                        onClick={() => setShowDeleteModal(true)}
                    >
                        Удалить аккаунт
                    </button>
                </div>
            </div>
            
            {/* Модальное окно смены пароля */}
            <PasswordChangeModal 
                isOpen={showPasswordModal} 
                onClose={() => setShowPasswordModal(false)} 
            />
            
            {/* Модальное окно удаления аккаунта */}
            <DeleteAccountModal 
                isOpen={showDeleteModal} 
                onClose={() => setShowDeleteModal(false)} 
            />
            
            <style jsx>{`
                .profile-container {
                    max-width: 800px;
                    margin: 100px auto 50px;
                    padding: 0 20px;
                }
                
                h1 {
                    margin-bottom: 30px;
                    color: #333;
                }
                
                .profile-card {
                    background: white;
                    border-radius: 10px;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.1);
                    overflow: hidden;
                }
                
                .profile-header {
                    display: flex;
                    padding: 30px;
                    background: #f5f8ff;
                    border-bottom: 1px solid #e1e7f5;
                }
                
                .profile-avatar {
                    width: 80px;
                    height: 80px;
                    border-radius: 50%;
                    background: #007bff;
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 32px;
                    font-weight: bold;
                    margin-right: 20px;
                }
                
                .profile-info h2 {
                    margin: 0 0 5px 0;
                    color: #333;
                }
                
                .profile-info p {
                    margin: 0;
                    color: #666;
                }
                
                .profile-section {
                    padding: 30px;
                    border-bottom: 1px solid #eee;
                }
                
                .profile-section:last-child {
                    border-bottom: none;
                }
                
                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }
                
                .section-header h3 {
                    margin: 0;
                    color: #333;
                }
                
                .profile-section h3 {
                    margin-top: 0;
                    color: #333;
                    margin-bottom: 20px;
                }
                
                .form-group {
                    margin-bottom: 20px;
                }
                
                .form-group label {
                    display: block;
                    margin-bottom: 8px;
                    color: #555;
                }
                
                .form-group input {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-size: 16px;
                    background-color: #f9f9f9;
                }
                
                .form-group input:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }
                
                .form-group input.editable {
                    background-color: #fff;
                    border-color: #007bff;
                }
                
                .form-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                    margin-top: 20px;
                }
                
                .edit-btn {
                    background: #f0f7ff;
                    color: #007bff;
                    border: 1px solid #007bff;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }
                
                .edit-btn:hover {
                    background: #e0f0ff;
                }
                
                .cancel-btn {
                    background: #f1f1f1;
                    color: #333;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 16px;
                }
                
                .save-btn {
                    background: #007bff;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 16px;
                }
                
                .save-btn:disabled {
                    background: #cccccc;
                    cursor: not-allowed;
                }
                
                .change-password-btn {
                    background: #f8f9fa;
                    color: #333;
                    border: 1px solid #ddd;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 16px;
                }
                
                .save-btn:hover:not(:disabled) {
                    background: #0069d9;
                }
                
                .change-password-btn:hover {
                    background: #e9ecef;
                }
                
                .message {
                    padding: 10px 15px;
                    border-radius: 4px;
                    margin-bottom: 20px;
                    font-size: 14px;
                }
                
                .message.success {
                    background-color: #d4edda;
                    color: #155724;
                    border: 1px solid #c3e6cb;
                }
                
                .message.error {
                    background-color: #f8d7da;
                    color: #721c24;
                    border: 1px solid #f5c6cb;
                }
                
                .danger-zone {
                    background-color: #fff8f8;
                }
                
                .danger-text {
                    color: #721c24;
                    margin-bottom: 15px;
                    font-size: 14px;
                }
                
                .delete-account-btn {
                    background: #dc3545;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 16px;
                }
                
                .delete-account-btn:hover {
                    background: #c82333;
                }
                
                @media (max-width: 768px) {
                    .profile-header {
                        flex-direction: column;
                        align-items: center;
                        text-align: center;
                    }
                    
                    .profile-avatar {
                        margin-right: 0;
                        margin-bottom: 15px;
                    }
                    
                    .section-header {
                        flex-direction: column;
                        gap: 10px;
                    }
                    
                    .edit-btn {
                        width: 100%;
                    }
                }
            `}</style>
        </div>
    );
};

export default ProfilePage; 