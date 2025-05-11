from fastapi import APIRouter, HTTPException, Query, Path
from typing import List, Optional
import os
import logging
import json
from datetime import datetime, timedelta
import numpy as np
from models.arima_model import ArimaModel
from services.coingecko_service import CoinGeckoService
from data.cache_utils import RedisCache
import traceback

# Настройка логирования
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

router = APIRouter()

# Инициализация сервисов
coingecko = CoinGeckoService()
redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
cache = RedisCache(redis_url)

PERIOD_TO_DAYS = {
    "1d": 2,  # Берем 2 дня для почасовых данных
    "7d": 7,
    "30d": 30,
    "90d": 90,
    "365d": 365
}

@router.get("/by-dates")
async def get_historical_prices_by_dates(
    coin_id: str = Query(..., description="ID криптовалюты"),
    start: str = Query(..., description="Начальная дата в формате YYYY-MM-DD"),
    end: str = Query(..., description="Конечная дата в формате YYYY-MM-DD")
):
    """
    Получение исторических данных о ценах криптовалюты за пользовательский период.
    
    Args:
        coin_id: ID криптовалюты
        start: Начальная дата
        end: Конечная дата
    """
    try:
        logger.info(f"Получен запрос на исторические данные по диапазону: валюта={coin_id}, start={start}, end={end}")

        # Парсим даты
        try:
            start_date = datetime.strptime(start, "%Y-%m-%d")
            end_date = datetime.strptime(end, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Неверный формат даты. Используйте YYYY-MM-DD"
            )

        # Проверяем валидность дат
        if end_date < start_date:
            raise HTTPException(
                status_code=400,
                detail="Конечная дата не может быть раньше начальной"
            )

        if end_date > datetime.now():
            raise HTTPException(
                status_code=400,
                detail="Конечная дата не может быть в будущем"
            )

        # Проверяем кэш
        cache_key = f"historical_dates_{coin_id}_{start}_{end}"
        cached_result = cache.get(cache_key)
        if cached_result:
            logger.info(f"Возвращаем исторические данные из кэша для {coin_id}")
            return cached_result

        # Вычисляем количество дней
        days = (end_date - start_date).days + 1

        # Получаем данные
        historical_data = await coingecko.get_coin_history(coin_id, days)
        
        if not historical_data:
            raise HTTPException(status_code=404, detail="Не удалось получить исторические данные")

        # Фильтруем данные по датам
        filtered_data = [
            price for price in historical_data
            if start_date <= datetime.fromtimestamp(price[0]/1000) <= end_date
        ]

        # Форматируем ответ
        formatted_data = {
            "currency": coin_id,
            "start_date": start,
            "end_date": end,
            "prices": filtered_data
        }

        # Кэшируем результат
        cache.set(cache_key, formatted_data, ttl=3600)  # кэшируем на 1 час
        
        return formatted_data

    except Exception as e:
        logger.error(f"Ошибка при получении исторических данных: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'coingecko' in locals():
            await coingecko.close()

@router.get("/{coin_id}/{period}")
async def get_prediction(
    coin_id: str = Path(..., description="ID криптовалюты"),
    period: str = Path(..., description="Период предсказания (1d, 7d, 30d, 90d, 365d)"),
    chart_type: str = Query("real", description="Тип графика (real/prediction)"),
    is_prediction: bool = Query(None, description="Флаг предсказания (true/false), альтернатива chart_type")
):
    try:
        # Если передан параметр is_prediction, используем его вместо chart_type
        if is_prediction is not None:
            chart_type = "prediction" if is_prediction else "real"
        
        logger.info(f"Получен запрос на исторические данные: coin_id={coin_id}, period={period}, chart_type={chart_type}")
        
        cache_key = f"historical_{coin_id}_{period}_{chart_type}"
        cached_result = cache.get(cache_key)
        if cached_result:
            logger.info(f"Возвращаем исторические данные из кэша для {coin_id} {period} {chart_type}")
            return cached_result

        if period not in PERIOD_TO_DAYS:
            error_msg = f"Неподдерживаемый интервал: {period}. Используйте {', '.join([f'{k}' for k in PERIOD_TO_DAYS.keys()])}"
            logger.error(error_msg)
            raise HTTPException(status_code=400, detail=error_msg)

        days = PERIOD_TO_DAYS[period]

        if chart_type == "real":
            logger.info(f"Запрашиваем реальные данные для {coin_id} за {days} дней")
            try:
                historical_data = await coingecko.get_coin_history(coin_id, days)
                if not historical_data:
                    error_msg = f"Не удалось получить исторические данные для {coin_id}"
                    logger.error(error_msg)
                    raise HTTPException(status_code=404, detail=error_msg)
                
                result = {
                    "prices": historical_data,
                    "coin_id": coin_id,
                    "period": period,
                    "chart_type": chart_type
                }
                cache.set(cache_key, result, ttl=3600)
                return result
            except Exception as e:
                error_msg = f"Ошибка при получении исторических данных от CoinGecko: {str(e)}\n{traceback.format_exc()}"
                logger.error(error_msg)
                raise HTTPException(status_code=500, detail=error_msg)
        else:
            logger.info(f"Генерируем прогноз для {coin_id} на {days} дней")
            try:
                training_days = days * 3
                historical_data = await coingecko.get_coin_history(coin_id, training_days)
                if not historical_data:
                    error_msg = f"Не удалось получить исторические данные для прогноза {coin_id}"
                    logger.error(error_msg)
                    raise HTTPException(status_code=404, detail=error_msg)
                
                prices = np.array([price[1] for price in historical_data])
                timestamps = [price[0] for price in historical_data]
                
                model = ArimaModel()
                logger.info(f"Обучаем модель ARIMA: period={period}, days={days}, prices_len={len(prices)}")
                model.train(prices)
                
                predictions = model.forecast(prices, steps=days)
                logger.info(f"Сгенерирован прогноз: predictions_len={len(predictions)} (ожидалось {days})")
                
                last_timestamp = timestamps[-1]
                prediction_timestamps = [
                    last_timestamp + (i + 1) * 24 * 60 * 60 * 1000
                    for i in range(len(predictions))
                ]
                prediction_data = list(zip(prediction_timestamps, predictions.tolist()))
                
                result = {
                    "predictions": prediction_data,
                    "coin_id": coin_id,
                    "period": period,
                    "chart_type": chart_type
                }
                cache.set(cache_key, result, ttl=3600)
                return result
            except Exception as e:
                error_msg = f"Ошибка при генерации прогноза: {str(e)}\n{traceback.format_exc()}"
                logger.error(error_msg)
                raise HTTPException(status_code=500, detail=error_msg)
                
    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Непредвиденная ошибка: {str(e)}\n{traceback.format_exc()}"
        logger.error(error_msg)
        raise HTTPException(status_code=500, detail=error_msg)
    finally:
        if 'coingecko' in locals():
            await coingecko.close()

@router.get("/predict/by-dates")
async def predict_by_dates(
    coin_id: str = Query(..., description="ID криптовалюты"),
    start: str = Query(..., description="Начальная дата в формате YYYY-MM-DD"),
    end: str = Query(..., description="Конечная дата в формате YYYY-MM-DD"),
    model: str = Query("arima", description="Модель прогнозирования (arima/lstm)"),
    interval: str = Query("daily", description="Интервал (daily/hourly)")
):
    """
    Прогнозирование цен по диапазону дат.
    """
    try:
        logger.info(f"Получен запрос на прогноз по диапазону: валюта={coin_id}, start={start}, end={end}, model={model}, interval={interval}")
        # Парсим даты
        try:
            start_date = datetime.strptime(start, "%Y-%m-%d")
            end_date = datetime.strptime(end, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Неверный формат даты. Используйте YYYY-MM-DD"
            )
        if end_date < start_date:
            raise HTTPException(
                status_code=400,
                detail="Конечная дата не может быть раньше начальной"
            )
        if end_date > datetime.now():
            raise HTTPException(
                status_code=400,
                detail="Конечная дата не может быть в будущем"
            )
        days_to_predict = (end_date - start_date).days + 1
        # Для обучения берём в 3 раза больше дней до start_date
        training_days = days_to_predict * 3
        training_end = start_date - timedelta(days=1)
        training_start = training_end - timedelta(days=training_days-1)
        # Получаем исторические данные для обучения
        historical_data = await coingecko.get_coin_history(coin_id, (training_end - training_start).days + 1)
        # Фильтруем только до start_date
        historical_data = [p for p in historical_data if datetime.fromtimestamp(p[0]/1000) <= training_end]
        if not historical_data or len(historical_data) < days_to_predict:
            raise HTTPException(status_code=404, detail="Недостаточно исторических данных для прогноза")
        prices = np.array([price[1] for price in historical_data])
        timestamps = [price[0] for price in historical_data]
        # Выбираем модель
        if model.lower() == "lstm":
            from models.lstm_model import LSTMModel
            m = LSTMModel()
        else:
            m = ArimaModel()
        m.train(prices)
        predictions = m.forecast(prices, steps=days_to_predict)
        # Формируем даты для прогноза
        last_known = int(datetime.combine(training_end, datetime.min.time()).timestamp() * 1000)
        prediction_timestamps = [
            last_known + (i + 1) * 24 * 60 * 60 * 1000 for i in range(days_to_predict)
        ]
        prediction_data = list(zip(prediction_timestamps, predictions.tolist()))
        return {
            "predictions": prediction_data,
            "coin_id": coin_id,
            "start": start,
            "end": end,
            "model": model,
            "interval": interval
        }
    except Exception as e:
        logger.error(f"Ошибка при прогнозе по диапазону дат: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) 