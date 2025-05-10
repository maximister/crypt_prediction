from fastapi import FastAPI, BackgroundTasks, HTTPException, Depends
import motor.motor_asyncio
import os
import asyncio
import logging
from dotenv import load_dotenv
import aiohttp
import json
import time
from datetime import datetime
from typing import Dict, List, Optional, Any
import uvicorn
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Загружаем переменные окружения
load_dotenv()

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("notification_service")

app = FastAPI(title="Notification Service")

# Подключение к MongoDB
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URL)
db = client.crypto_tracker

# Email конфигурация
EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_USER = os.getenv("EMAIL_USER", "")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD", "")
EMAIL_FROM = os.getenv("EMAIL_FROM", "noreply@cryptoapp.com")

# Настройки для API цен
PRICE_API_URL = os.getenv("PRICE_API_URL", "http://localhost:8001/api/price")

# Глобальный кэш цен
price_cache: Dict[str, float] = {}
last_price_check: Dict[str, float] = {}

async def fetch_current_prices(coin_ids: List[str]) -> Dict[str, float]:
    """Получает текущие цены для списка монет"""
    results = {}
    current_time = time.time()
    
    # Проверяем, какие монеты нужно обновить (кэш истек через 60 секунд)
    coins_to_fetch = [
        coin for coin in coin_ids 
        if coin not in last_price_check or current_time - last_price_check.get(coin, 0) > 60
    ]
    
    if not coins_to_fetch:
        return {coin: price_cache.get(coin) for coin in coin_ids if coin in price_cache}
    
    try:
        async with aiohttp.ClientSession() as session:
            for coin in coins_to_fetch:
                try:
                    async with session.get(f"{PRICE_API_URL}/{coin}") as response:
                        if response.status == 200:
                            data = await response.json()
                            price = data.get("price")
                            if price is not None:
                                price_cache[coin] = price
                                last_price_check[coin] = current_time
                except Exception as e:
                    logger.error(f"Error fetching price for {coin}: {str(e)}")
    except Exception as e:
        logger.error(f"Error in fetch_current_prices: {str(e)}")
    
    return {coin: price_cache.get(coin) for coin in coin_ids if coin in price_cache}

async def send_email_notification(user_email: str, subject: str, message: str):
    """Отправляет email уведомление пользователю"""
    if not EMAIL_USER or not EMAIL_PASSWORD:
        logger.warning("Email credentials not configured, skipping notification")
        return
    
    try:
        msg = MIMEMultipart()
        msg['From'] = EMAIL_FROM
        msg['To'] = user_email
        msg['Subject'] = subject
        
        msg.attach(MIMEText(message, 'html'))
        
        with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT) as server:
            server.starttls()
            server.login(EMAIL_USER, EMAIL_PASSWORD)
            server.send_message(msg)
            
        logger.info(f"Email notification sent to {user_email}")
    except Exception as e:
        logger.error(f"Failed to send email to {user_email}: {str(e)}")

async def check_price_alerts():
    """Проверяет все уведомления о ценах и отправляет нотификации"""
    logger.info("Checking price alerts")
    
    try:
        # Получаем всех пользователей с уведомлениями
        users = await db.users.find({"alerts": {"$exists": True, "$ne": []}}).to_list(None)
        
        for user in users:
            if not user.get("alerts"):
                continue
                
            # Получаем список монет для проверки
            coin_ids = list(set(alert["coin_id"] for alert in user["alerts"]))
            
            # Получаем текущие цены
            current_prices = await fetch_current_prices(coin_ids)
            
            # Проверяем каждое уведомление
            triggered_alerts = []
            remaining_alerts = []
            
            for alert in user["alerts"]:
                coin_id = alert["coin_id"]
                current_price = current_prices.get(coin_id)
                
                if current_price is None:
                    remaining_alerts.append(alert)
                    continue
                
                is_triggered = False
                
                if alert["type"] == "price":
                    # Проверка по абсолютной цене
                    if alert["condition"] == "above" and current_price >= alert["price"]:
                        is_triggered = True
                    elif alert["condition"] == "below" and current_price <= alert["price"]:
                        is_triggered = True
                
                elif alert["type"] == "percentage":
                    # Проверка по процентному изменению
                    # Для этого нам нужны исторические данные
                    # Пока реализуем простую проверку на основе последних известных цен
                    if coin_id in price_cache:
                        last_known_price = price_cache[coin_id]
                        if last_known_price > 0:
                            percent_change = ((current_price - last_known_price) / last_known_price) * 100
                            
                            if alert["condition"] == "above" and percent_change >= alert["percentage"]:
                                is_triggered = True
                            elif alert["condition"] == "below" and percent_change <= -alert["percentage"]:
                                is_triggered = True
                
                if is_triggered:
                    triggered_alerts.append(alert)
                else:
                    remaining_alerts.append(alert)
            
            # Если есть сработавшие уведомления
            if triggered_alerts:
                # Обновляем список уведомлений пользователя (удаляем сработавшие)
                await db.users.update_one(
                    {"_id": user["_id"]},
                    {"$set": {"alerts": remaining_alerts}}
                )
                
                # Отправляем уведомления
                for alert in triggered_alerts:
                    coin_id = alert["coin_id"]
                    current_price = current_prices.get(coin_id)
                    
                    subject = f"Уведомление о цене {coin_id.upper()}"
                    
                    if alert["type"] == "price":
                        message = f"""
                        <h2>Уведомление о цене {coin_id.upper()}</h2>
                        <p>Цена {coin_id.upper()} {alert["condition"] == "above" and "достигла" or "упала до"} ${current_price:.2f}</p>
                        <p>Ваше условие: {alert["condition"] == "above" and "выше" or "ниже"} ${alert["price"]:.2f}</p>
                        <p>Текущая цена: ${current_price:.2f}</p>
                        <p><a href="http://localhost:3000/crypto/{coin_id}">Посмотреть детали</a></p>
                        """
                    else:
                        last_known_price = price_cache.get(coin_id, 0)
                        percent_change = ((current_price - last_known_price) / last_known_price) * 100 if last_known_price > 0 else 0
                        
                        message = f"""
                        <h2>Уведомление об изменении цены {coin_id.upper()}</h2>
                        <p>Цена {coin_id.upper()} изменилась на {percent_change:.2f}%</p>
                        <p>Ваше условие: изменение {alert["condition"] == "above" and "выше" or "ниже"} {alert["percentage"]}%</p>
                        <p>Текущая цена: ${current_price:.2f}</p>
                        <p><a href="http://localhost:3000/crypto/{coin_id}">Посмотреть детали</a></p>
                        """
                    
                    await send_email_notification(user["email"], subject, message)
                    
                    # Также можно отправить уведомление через WebSocket, если он реализован
    
    except Exception as e:
        logger.error(f"Error in check_price_alerts: {str(e)}")

async def background_alert_checker():
    """Фоновая задача для периодической проверки уведомлений"""
    while True:
        await check_price_alerts()
        await asyncio.sleep(60)  # Проверяем каждую минуту

@app.on_event("startup")
async def startup_event():
    """Запускает фоновые задачи при старте сервиса"""
    asyncio.create_task(background_alert_checker())

@app.get("/")
async def root():
    return {"message": "Notification Service is running"}

@app.get("/health")
async def health_check():
    """Проверка работоспособности сервиса"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "price_cache_size": len(price_cache)
    }

@app.post("/trigger-check")
async def trigger_check(background_tasks: BackgroundTasks):
    """Ручной запуск проверки уведомлений"""
    background_tasks.add_task(check_price_alerts)
    return {"message": "Alert check triggered"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8003, reload=True) 