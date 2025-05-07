from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from models.lstm_model import LSTMModel
from models.arima_model import ArimaModel
from data.fetch_prices import CoinGeckoAPI
from data.cache_utils import RedisCache
import os
import numpy as np
import logging
import json
import asyncio

logger = logging.getLogger(__name__)
router = APIRouter()

# Инициализация моделей и API
lstm_model = LSTMModel()
arima_model = ArimaModel()
coingecko = CoinGeckoAPI()
redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
cache = RedisCache(redis_url)

class PredictionRequest(BaseModel):
    coin_id: str
    days: int = 7
    model: str = "arima"
    interval: str = "daily"

@router.post("")
async def predict_price(request: PredictionRequest):
    try:
        # Проверяем кэш
        cache_key = f"prediction_{request.coin_id}_{request.days}_{request.model}_{request.interval}"
        cached_result = cache.get(cache_key)
        if cached_result:
            logger.info(f"Возвращаем результат из кэша для {request.coin_id}")
            return cached_result

        # Получаем исторические данные
        training_days = request.days * 3 if request.interval == "daily" else request.days * 7
        historical_data = await coingecko.get_historical_prices(request.coin_id, training_days)
        
        if not historical_data:
            raise HTTPException(status_code=404, detail="Не удалось получить исторические данные")

        # Извлекаем только цены
        prices = [price for _, price in historical_data]

        # Выбираем модель и делаем прогноз
        if request.model.lower() == "lstm":
            predictions = lstm_model.forecast(prices)
        else:  # arima по умолчанию
            predictions = arima_model.forecast(prices)

        # Получаем последнюю известную дату и создаем будущие даты
        last_date = historical_data[-1][0]
        
        # Форматируем ответ
        time_step = 3600000 if request.interval == "hourly" else 86400000  # миллисекунды в часе или дне
        prediction_data = [
            [
                last_date + (i + 1) * time_step,
                float(pred)  # преобразуем в float для безопасности
            ]
            for i, pred in enumerate(predictions)
        ]

        result = {
            "historical": historical_data,
            "predictions": prediction_data
        }

        # Кэшируем результат
        cache.set(cache_key, result, ttl=1800)  # кэшируем на 30 минут

        return result

    except Exception as e:
        logger.error(f"Ошибка при создании прогноза: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{coin_id}")
async def get_prediction(
    coin_id: str, 
    days: int = 7, 
    model: str = "arima",
    interval: str = "daily"
):
    request = PredictionRequest(
        coin_id=coin_id,
        days=days,
        model=model,
        interval=interval
    )
    return await predict_price(request)

@router.get("/{coin_id}/{interval}")
async def get_prediction_with_interval(
    coin_id: str,
    interval: str,
    days: Optional[int] = None
):
    if interval == "1d":
        days = 1
        interval_type = "hourly"
    elif interval == "7d":
        days = 7
        interval_type = "daily"
    elif interval == "30d":
        days = 30
        interval_type = "daily"
    else:
        raise HTTPException(status_code=400, detail="Неподдерживаемый интервал. Используйте '1d', '7d' или '30d'")

    request = PredictionRequest(
        coin_id=coin_id,
        days=days,
        interval=interval_type
    )
    return await predict_price(request)

def simple_forecast(historical_prices, days_forward):
    """
    Простой прогноз на основе линейной экстраполяции
    """
    try:
        # Используем последние 30 точек для прогноза
        last_points = historical_prices[-30:]
        x = np.arange(len(last_points))
        y = last_points
        
        # Линейная регрессия
        coeffs = np.polyfit(x, y, deg=1)
        poly = np.poly1d(coeffs)
        
        # Прогнозируем следующие точки
        future_x = np.arange(len(last_points), len(last_points) + days_forward)
        forecast = poly(future_x)
        
        return forecast.tolist()
    except Exception as e:
        logger.error(f"Ошибка при создании прогноза: {str(e)}")
        raise 