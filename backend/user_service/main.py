from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pymongo import MongoClient
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from jose import JWTError, jwt
import os
from dotenv import load_dotenv
from pydantic import BaseModel, EmailStr, Field
from passlib.context import CryptContext
import motor.motor_asyncio
import uuid

load_dotenv()

app = FastAPI()

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Разрешаем только фронтенд
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Настройки MongoDB
client = motor.motor_asyncio.AsyncIOMotorClient(os.getenv("MONGODB_URL", "mongodb://localhost:27017"))
db = client.crypto_tracker

# Настройки JWT
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Настройка хэширования паролей
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str = "user"  # По умолчанию роль "user"

class User(BaseModel):
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    watchlist: List[str] = []
    dashboards: List[dict] = []
    alerts: List[dict] = []
    role: str = "user"  # Добавляем поле для роли пользователя, по умолчанию "user"
    is_active: bool = True  # По умолчанию аккаунт активен

class UserInDB(User):
    hashed_password: str

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class DashboardCreate(BaseModel):
    name: str
    type: str
    widgets: List[dict]
    id: Optional[str] = None  # Для UUID с фронтенда
    uuid: Optional[str] = None  # Дополнительное поле для явного указания UUID

class DashboardUpdate(BaseModel):
    widgets: List[dict]
    name: Optional[str] = None  # Добавляем возможность обновления имени

class Dashboard(BaseModel):
    id: str
    name: str
    type: str
    widgets: List[dict]
    uuid: Optional[str] = None  # Добавляем поле UUID для совместимости

class LoginRequest(BaseModel):
    email: str
    password: str

class PriceAlert(BaseModel):
    coin_id: str
    condition: str
    type: str
    price: Optional[float] = None
    percentage: Optional[float] = None

class PriceAlertResponse(BaseModel):
    id: str
    coin_id: str
    condition: str
    type: str
    price: Optional[float] = None
    percentage: Optional[float] = None
    created_at: datetime

class WatchlistAction(BaseModel):
    coin_id: Optional[str] = None
    currency: Optional[str] = None
    action: str

class CryptoCurrency(BaseModel):
    id: str
    name: str
    symbol: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        schema_extra = {
            "example": {
                "id": "bitcoin",
                "name": "Bitcoin",
                "symbol": "BTC",
                "description": "Bitcoin is a decentralized digital currency.",
                "logo_url": "https://assets.coincap.io/assets/icons/bitcoin@2x.png",
                "is_active": True
            }
        }

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_user(email: str):
    print(f"Looking for user in database: {email}")
    user_dict = await db.users.find_one({"email": email})
    if user_dict:
        print(f"User found in database: {email}")
        return UserInDB(**user_dict)
    print(f"User not found in database: {email}")
    return None

async def authenticate_user(email: str, password: str):
    print(f"Attempting to authenticate user: {email}")
    user = await get_user(email)
    if not user:
        print(f"User not found: {email}")
        return False
    if not pwd_context.verify(password, user.hashed_password):
        print(f"Invalid password for user: {email}")
        return False
    print(f"User authenticated successfully: {email}")
    return user

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email)
    except JWTError:
        raise credentials_exception
    
    user = await get_user(email=token_data.email)
    if user is None:
        raise credentials_exception
    
    if hasattr(user, 'is_active') and not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Аккаунт деактивирован",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user

async def check_admin_role(current_user: UserInDB = Depends(get_current_user)):
    """Проверяет, имеет ли пользователь роль администратора"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="У вас нет прав для выполнения этого действия",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return current_user

@app.get("/check-user/{email}")
async def check_user(email: str):
    user = await get_user(email)
    if user:
        return {"exists": True}
    return {"exists": False}

@app.post("/register", response_model=Token)
async def register(user_data: UserCreate):
    print(f"Registration attempt for email: {user_data.email}")
    if await db.users.find_one({"email": user_data.email}):
        print(f"Email already registered: {user_data.email}")
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = pwd_context.hash(user_data.password)
    user_dict = {
        "email": user_data.email,
        "hashed_password": hashed_password,
        "watchlist": [],
        "dashboards": [],
        "alerts": [],
        "first_name": user_data.first_name,
        "last_name": user_data.last_name,
        "role": user_data.role,
        "is_active": True
    }
    await db.users.insert_one(user_dict)
    print(f"User registered successfully: {user_data.email}")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user_data.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/login")
async def login(login_data: LoginRequest):
    print(f"Login attempt for email: {login_data.email}")
    user = await authenticate_user(login_data.email, login_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль"
        )
    
    if hasattr(user, 'is_active') and not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Аккаунт деактивирован. Обратитесь к администратору."
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    print(f"Login successful for user: {login_data.email}")
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/watchlist", response_model=List[str])
async def get_watchlist(current_user: User = Depends(get_current_user)):
    return current_user.watchlist

@app.put("/watchlist")
async def update_watchlist(action: WatchlistAction, current_user: User = Depends(get_current_user)):
    coin_id = action.coin_id or action.currency
    
    if not coin_id:
        raise HTTPException(status_code=400, detail="coin_id или currency должны быть указаны")
    
    if action.action == "add":
        if coin_id not in current_user.watchlist:
            await db.users.update_one(
                {"email": current_user.email},
                {"$push": {"watchlist": coin_id}}
            )
        return {"message": "Монета добавлена в список избранного"}
    elif action.action == "remove":
        await db.users.update_one(
            {"email": current_user.email},
            {"$pull": {"watchlist": coin_id}}
        )
        return {"message": "Монета удалена из списка избранного"}
    else:
        raise HTTPException(status_code=400, detail="Недопустимое действие. Используйте 'add' или 'remove'")

@app.put("/watchlist/{coin}")
async def add_to_watchlist(coin: str, current_user: User = Depends(get_current_user)):
    if coin not in current_user.watchlist:
        await db.users.update_one(
            {"email": current_user.email},
            {"$push": {"watchlist": coin}}
        )
    return {"message": "Coin added to watchlist"}

@app.delete("/watchlist/{coin}")
async def remove_from_watchlist(coin: str, current_user: User = Depends(get_current_user)):
    await db.users.update_one(
        {"email": current_user.email},
        {"$pull": {"watchlist": coin}}
    )
    return {"message": "Coin removed from watchlist"}

@app.get("/dashboard", response_model=List[Dashboard])
async def get_dashboards(current_user: User = Depends(get_current_user)):
    return current_user.dashboards

@app.post("/dashboard", response_model=Dashboard)
async def create_dashboard(dashboard: DashboardCreate, current_user: User = Depends(get_current_user)):
    # Используем UUID с фронтенда или генерируем новый на основе временной метки
    dashboard_id = dashboard.id or dashboard.uuid or str(datetime.now().timestamp())
    
    new_dashboard = {
        "id": dashboard_id,
        "name": dashboard.name,
        "type": dashboard.type,
        "widgets": dashboard.widgets,
        "uuid": dashboard.uuid or dashboard_id  # Сохраняем UUID для надежности
    }
    
    await db.users.update_one(
        {"email": current_user.email},
        {"$push": {"dashboards": new_dashboard}}
    )
    
    return new_dashboard

@app.put("/dashboard/{dashboard_id}")
async def update_dashboard(
    dashboard_id: str,
    dashboard_update: DashboardUpdate,
    current_user: User = Depends(get_current_user)
):
    try:
        print(f"Updating dashboard with ID: {dashboard_id}")
        print(f"Update data: {dashboard_update.dict()}")
        
        update_fields = {"dashboards.$.widgets": dashboard_update.widgets}
        
        # Если передано имя, обновляем его
        if dashboard_update.name is not None:
            update_fields["dashboards.$.name"] = dashboard_update.name
            print(f"Updating dashboard name to: {dashboard_update.name}")
        
        # Сначала ищем по ID
        print(f"Trying to find dashboard by ID: {dashboard_id}")
        result = await db.users.update_one(
            {
                "email": current_user.email,
                "dashboards.id": dashboard_id
            },
            {
                "$set": update_fields
            }
        )
        
        if result.modified_count == 0:
            # Пробуем найти по UUID, если не найдено по ID
            print(f"Dashboard not found by ID, trying to find by UUID: {dashboard_id}")
            result = await db.users.update_one(
                {
                    "email": current_user.email,
                    "dashboards.uuid": dashboard_id
                },
                {
                    "$set": update_fields
                }
            )
            
            if result.modified_count == 0:
                print(f"Dashboard not found by UUID either")
                # Получим список всех дашбордов пользователя для диагностики
                user = await db.users.find_one({"email": current_user.email})
                if user and 'dashboards' in user:
                    print(f"User has {len(user['dashboards'])} dashboards:")
                    for idx, d in enumerate(user['dashboards']):
                        print(f"Dashboard {idx+1}: ID={d.get('id')}, UUID={d.get('uuid')}, Name={d.get('name')}")
                
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Dashboard not found with ID or UUID: {dashboard_id}"
                )
        
        print(f"Dashboard updated successfully")
        return {"message": "Dashboard updated"}
    except Exception as e:
        print(f"Error updating dashboard: {str(e)}")
        raise

@app.delete("/dashboard/{dashboard_id}")
async def delete_dashboard(dashboard_id: str, current_user: User = Depends(get_current_user)):
    # Пробуем удалить по ID
    result = await db.users.update_one(
        {"email": current_user.email},
        {"$pull": {"dashboards": {"id": dashboard_id}}}
    )
    
    # Если дашборд не найден по ID, пробуем по UUID
    if result.modified_count == 0:
        result = await db.users.update_one(
            {"email": current_user.email},
            {"$pull": {"dashboards": {"uuid": dashboard_id}}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dashboard not found"
            )
    
    return {"message": "Dashboard deleted"}

@app.get("/profile", response_model=User)
async def get_profile(current_user: User = Depends(get_current_user)):
    return current_user

@app.put("/profile", response_model=User)
async def update_profile(user_update: UserUpdate, current_user: User = Depends(get_current_user)):
    try:
        update_data = user_update.model_dump(exclude_unset=True)
    except AttributeError:
        update_data = user_update.dict(exclude_unset=True)
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    await db.users.update_one(
        {"email": current_user.email},
        {"$set": update_data}
    )
    
    updated_user = await get_user(current_user.email)
    return updated_user

@app.post("/change-password")
async def change_password(password_data: PasswordChange, current_user: UserInDB = Depends(get_current_user)):
    if not pwd_context.verify(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный текущий пароль"
        )
    
    hashed_password = pwd_context.hash(password_data.new_password)
    
    await db.users.update_one(
        {"email": current_user.email},
        {"$set": {"hashed_password": hashed_password}}
    )
    
    return {"message": "Пароль успешно изменен"}

@app.delete("/account")
async def delete_account(current_user: UserInDB = Depends(get_current_user)):
    result = await db.users.delete_one({"email": current_user.email})
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )
    
    return {"message": "Аккаунт успешно удален"}

@app.post("/logout")
async def logout():
    return {"message": "Logged out successfully"}

@app.get("/alerts", response_model=List[PriceAlertResponse])
async def get_alerts(current_user: User = Depends(get_current_user)):
    """Получить все уведомления пользователя"""
    if not hasattr(current_user, 'alerts'):
        return []
    return current_user.alerts

@app.post("/alerts", response_model=PriceAlertResponse)
async def create_alert(alert: PriceAlert, current_user: User = Depends(get_current_user)):
    """Создать новое уведомление о цене"""
    if alert.coin_id not in current_user.watchlist:
        raise HTTPException(status_code=400, detail="Монета должна быть в списке избранного")
    
    if alert.type == "price" and alert.price is None:
        raise HTTPException(status_code=400, detail="Для уведомления по цене необходимо указать цену")
    
    if alert.type == "percentage" and alert.percentage is None:
        raise HTTPException(status_code=400, detail="Для уведомления по проценту необходимо указать процент")
    
    new_alert = {
        "id": str(uuid.uuid4()),
        "coin_id": alert.coin_id,
        "condition": alert.condition,
        "type": alert.type,
        "price": alert.price,
        "percentage": alert.percentage,
        "created_at": datetime.now()
    }
    
    await db.users.update_one(
        {"email": current_user.email},
        {"$push": {"alerts": new_alert}}
    )
    
    return new_alert

@app.delete("/alerts/{alert_id}")
async def delete_alert(alert_id: str, current_user: User = Depends(get_current_user)):
    """Удалить уведомление о цене"""
    result = await db.users.update_one(
        {"email": current_user.email},
        {"$pull": {"alerts": {"id": alert_id}}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Уведомление не найдено")
    
    return {"message": "Уведомление удалено"}


@app.get("/cryptocurrencies", response_model=List[CryptoCurrency])
async def get_cryptocurrencies(active_only: bool = True):
    """Получить список всех доступных криптовалют"""
    query = {"is_active": True} if active_only else {}
    cursor = db.cryptocurrencies.find(query)
    currencies = await cursor.to_list(length=100)
    return currencies

@app.get("/cryptocurrencies/{currency_id}", response_model=CryptoCurrency)
async def get_cryptocurrency(currency_id: str):
    """Получить информацию о конкретной криптовалюте"""
    currency = await db.cryptocurrencies.find_one({"id": currency_id})
    if not currency:
        raise HTTPException(status_code=404, detail="Криптовалюта не найдена")
    return currency

@app.post("/cryptocurrencies", response_model=CryptoCurrency)
async def create_cryptocurrency(currency: CryptoCurrency, current_user: UserInDB = Depends(check_admin_role)):
    """Добавить новую криптовалюту (только для администраторов)"""
    # Проверка прав администратора выполняется через check_admin_role
    
    # Проверяем, существует ли уже такая валюта
    existing = await db.cryptocurrencies.find_one({"id": currency.id})
    if existing:
        raise HTTPException(status_code=400, detail="Криптовалюта с таким ID уже существует")
    
    # Добавляем валюту в базу
    currency_dict = currency.dict()
    currency_dict["created_at"] = datetime.now()
    currency_dict["updated_at"] = datetime.now()
    
    result = await db.cryptocurrencies.insert_one(currency_dict)
    
    # Получаем и возвращаем созданную валюту
    created_currency = await db.cryptocurrencies.find_one({"_id": result.inserted_id})
    return created_currency

@app.put("/cryptocurrencies/{currency_id}", response_model=CryptoCurrency)
async def update_cryptocurrency(
    currency_id: str, 
    currency_update: dict, 
    current_user: UserInDB = Depends(check_admin_role)
):
    """Обновить информацию о криптовалюте (только для администраторов)"""
    # Проверка прав администратора выполняется через check_admin_role
    
    # Проверяем, существует ли валюта
    existing = await db.cryptocurrencies.find_one({"id": currency_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Криптовалюта не найдена")
    
    # Обновляем данные
    currency_update["updated_at"] = datetime.now()
    
    await db.cryptocurrencies.update_one(
        {"id": currency_id},
        {"$set": currency_update}
    )
    
    # Возвращаем обновленную валюту
    updated_currency = await db.cryptocurrencies.find_one({"id": currency_id})
    return updated_currency

@app.delete("/cryptocurrencies/{currency_id}")
async def delete_cryptocurrency(currency_id: str, current_user: UserInDB = Depends(check_admin_role)):
    """Удалить криптовалюту (только для администраторов)"""
    # Проверка прав администратора выполняется через check_admin_role
    
    # Проверяем, существует ли валюта
    existing = await db.cryptocurrencies.find_one({"id": currency_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Криптовалюта не найдена")
    
    # Удаляем валюту
    await db.cryptocurrencies.delete_one({"id": currency_id})
    
    return {"message": "Криптовалюта успешно удалена"}

# Эндпоинт для проверки роли администратора
@app.get("/check-admin")
async def check_admin(current_user: UserInDB = Depends(get_current_user)):
    """Проверяет, является ли текущий пользователь администратором"""
    if current_user.role == "admin":
        return {"is_admin": True}
    return {"is_admin": False}

# API эндпоинты для управления пользователями (только для админов)
@app.get("/users", response_model=List[User])
async def get_users(current_user: UserInDB = Depends(check_admin_role)):
    """Получить список всех пользователей (только для администраторов)"""
    cursor = db.users.find({})
    users = await cursor.to_list(length=100)
    # Удаляем поле hashed_password для безопасности
    for user in users:
        if "hashed_password" in user:
            del user["hashed_password"]
    return users

@app.put("/users/{email}/role")
async def update_user_role(email: str, role: str, current_user: UserInDB = Depends(check_admin_role)):
    """Обновить роль пользователя (только для администраторов)"""
    # Проверяем существование пользователя
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Проверяем, что админ не пытается изменить свою роль
    if email == current_user.email:
        raise HTTPException(status_code=400, detail="Нельзя изменить собственную роль")
    
    # Проверяем валидность роли
    if role not in ["user", "admin"]:
        raise HTTPException(status_code=400, detail="Недопустимая роль. Используйте 'user' или 'admin'")
    
    # Обновляем роль
    await db.users.update_one(
        {"email": email},
        {"$set": {"role": role}}
    )
    
    return {"message": f"Роль пользователя {email} изменена на {role}"}

@app.put("/users/{email}/status")
async def update_user_status(email: str, is_active: bool, current_user: UserInDB = Depends(check_admin_role)):
    """Активировать/деактивировать пользователя (только для администраторов)"""
    # Проверяем существование пользователя
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Проверяем, что админ не пытается деактивировать себя
    if email == current_user.email:
        raise HTTPException(status_code=400, detail="Нельзя деактивировать собственный аккаунт")
    
    # Обновляем статус пользователя
    await db.users.update_one(
        {"email": email},
        {"$set": {"is_active": is_active}}
    )
    
    status_message = "активирован" if is_active else "деактивирован"
    return {"message": f"Аккаунт пользователя {email} {status_message}"}

# Инициализация базы данных при запуске
@app.on_event("startup")
async def startup_db_client():
    # Создаем пользователя-администратора, если его еще нет
    admin_user = await db.users.find_one({"email": "admin@admin.com"})
    if not admin_user:
        print("Creating admin user")
        hashed_password = pwd_context.hash("admin")
        admin_dict = {
            "email": "admin@admin.com",
            "hashed_password": hashed_password,
            "watchlist": [],
            "dashboards": [],
            "alerts": [],
            "first_name": "Admin",
            "last_name": "User",
            "role": "admin",  # Устанавливаем роль админа
            "is_active": True  # Аккаунт активен
        }
        await db.users.insert_one(admin_dict)
        print("Admin user created successfully")
    
    # Проверяем наличие коллекции криптовалют и создаем её, если она отсутствует
    if "cryptocurrencies" not in await db.list_collection_names():
        # Создаем коллекцию
        await db.create_collection("cryptocurrencies")
        
        # Добавляем базовые криптовалюты
        default_currencies = [
            {
                "id": "bitcoin",
                "name": "Bitcoin",
                "symbol": "BTC",
                "description": "Bitcoin is a decentralized digital currency.",
                "logo_url": "https://assets.coincap.io/assets/icons/bitcoin@2x.png",
                "is_active": True,
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            },
            {
                "id": "ethereum",
                "name": "Ethereum",
                "symbol": "ETH",
                "description": "Ethereum is a decentralized computing platform.",
                "logo_url": "https://assets.coincap.io/assets/icons/ethereum@2x.png",
                "is_active": True,
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            },
            {
                "id": "binancecoin",
                "name": "Binance Coin",
                "symbol": "BNB",
                "description": "Binance Coin is the cryptocurrency issued by Binance exchange.",
                "logo_url": "https://assets.coincap.io/assets/icons/binancecoin@2x.png",
                "is_active": True,
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            },
            {
                "id": "ripple",
                "name": "XRP",
                "symbol": "XRP",
                "description": "XRP is the cryptocurrency used by the Ripple payment network.",
                "logo_url": "https://assets.coincap.io/assets/icons/ripple@2x.png",
                "is_active": True,
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            },
            {
                "id": "cardano",
                "name": "Cardano",
                "symbol": "ADA",
                "description": "Cardano is a proof-of-stake blockchain platform.",
                "logo_url": "https://assets.coincap.io/assets/icons/cardano@2x.png",
                "is_active": True,
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            },
            {
                "id": "solana",
                "name": "Solana",
                "symbol": "SOL",
                "description": "Solana is a high-performance blockchain supporting smart contracts and decentralized applications.",
                "logo_url": "https://assets.coincap.io/assets/icons/solana@2x.png",
                "is_active": True,
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            },
            {
                "id": "polkadot",
                "name": "Polkadot",
                "symbol": "DOT",
                "description": "Polkadot is a platform that allows diverse blockchains to transfer messages and value.",
                "logo_url": "https://assets.coincap.io/assets/icons/polkadot@2x.png",
                "is_active": True,
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            },
            {
                "id": "dogecoin",
                "name": "Dogecoin",
                "symbol": "DOGE",
                "description": "Dogecoin is a cryptocurrency featuring the Shiba Inu dog from the 'Doge' meme.",
                "logo_url": "https://assets.coincap.io/assets/icons/dogecoin@2x.png",
                "is_active": True,
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
        ]
        
        await db.cryptocurrencies.insert_many(default_currencies)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 