import os
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from routers import predict, current_price, historical
import asyncio
import json
import logging
from data.fetch_prices import CoinGeckoAPI
from data.cache_utils import RedisCache
import redis

# Загрузка переменных окружения
load_dotenv()

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Инициализация FastAPI
app = FastAPI()

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключаем роутеры
app.include_router(predict.router, prefix="/api/predict", tags=["predictions"])
app.include_router(current_price.router, prefix="/api/price", tags=["prices"])
app.include_router(historical.router, prefix="/api/historical", tags=["historical"])

# Инициализация сервисов
coingecko = CoinGeckoAPI()
redis_cache = RedisCache(os.getenv("REDIS_URL", "redis://localhost:6379"))

@app.on_event("startup")
async def startup_event():
    logger.info("Сервис прогнозирования запущен")

@app.on_event("shutdown")
async def shutdown_event():
    # Закрываем соединения при остановке сервиса
    await coingecko.close()
    logger.info("Сервис прогнозирования остановлен")

@app.websocket("/ws/updates")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # Получаем список отслеживаемых криптовалют
            tracked_currencies = ["bitcoin", "ethereum"]  # В реальном приложении получаем из MongoDB
            
            # Получаем актуальные цены
            prices = {}
            for currency in tracked_currencies:
                price = await coingecko.get_current_price(currency)
                if price:
                    prices[currency] = price
            
            # Отправляем обновления
            await websocket.send_json({
                "type": "price",
                "payload": prices
            })
            
            await asyncio.sleep(5)  # Обновляем каждые 5 секунд
            
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        await websocket.close()

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001) 