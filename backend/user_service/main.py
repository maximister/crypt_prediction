from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pymongo import MongoClient
from datetime import datetime, timedelta
from typing import Optional, List
from jose import JWTError, jwt
import os
from dotenv import load_dotenv
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
import motor.motor_asyncio

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

class User(BaseModel):
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    watchlist: List[str] = []
    dashboards: List[dict] = []

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

class DashboardUpdate(BaseModel):
    widgets: List[dict]

class Dashboard(BaseModel):
    id: str
    name: str
    type: str
    widgets: List[dict]

class LoginRequest(BaseModel):
    email: str
    password: str

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
    return user

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
        "first_name": user_data.first_name,
        "last_name": user_data.last_name
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
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    print(f"Login successful for user: {login_data.email}")
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/watchlist", response_model=List[str])
async def get_watchlist(current_user: User = Depends(get_current_user)):
    return current_user.watchlist

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
    dashboard_id = str(datetime.now().timestamp())
    new_dashboard = {
        "id": dashboard_id,
        "name": dashboard.name,
        "type": dashboard.type,
        "widgets": dashboard.widgets
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
    result = await db.users.update_one(
        {
            "email": current_user.email,
            "dashboards.id": dashboard_id
        },
        {
            "$set": {
                "dashboards.$.widgets": dashboard_update.widgets
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    return {"message": "Dashboard updated"}

@app.delete("/dashboard/{dashboard_id}")
async def delete_dashboard(dashboard_id: str, current_user: User = Depends(get_current_user)):
    await db.users.update_one(
        {"email": current_user.email},
        {"$pull": {"dashboards": {"id": dashboard_id}}}
    )
    return {"message": "Dashboard deleted"}

@app.get("/profile", response_model=User)
async def get_profile(current_user: User = Depends(get_current_user)):
    return current_user

@app.put("/profile", response_model=User)
async def update_profile(user_update: UserUpdate, current_user: User = Depends(get_current_user)):
    try:
        # Пробуем использовать model_dump (Pydantic v2)
        update_data = user_update.model_dump(exclude_unset=True)
    except AttributeError:
        # Если не получилось, используем dict (Pydantic v1)
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
    # Проверяем текущий пароль
    if not pwd_context.verify(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный текущий пароль"
        )
    
    # Хешируем новый пароль
    hashed_password = pwd_context.hash(password_data.new_password)
    
    # Обновляем пароль в базе данных
    await db.users.update_one(
        {"email": current_user.email},
        {"$set": {"hashed_password": hashed_password}}
    )
    
    return {"message": "Пароль успешно изменен"}

@app.delete("/account")
async def delete_account(current_user: UserInDB = Depends(get_current_user)):
    # Удаляем пользователя из базы данных
    result = await db.users.delete_one({"email": current_user.email})
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )
    
    return {"message": "Аккаунт успешно удален"}

@app.post("/logout")
async def logout():
    # Для JWT обычно logout реализуется на фронте (удаление токена). Здесь можно добавить blacklist, если потребуется.
    return {"message": "Logged out successfully"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 