from fastapi import APIRouter, HTTPException
from services.coingecko_service import CoinGeckoService
from data.cache_utils import RedisCache
import os
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/{currency}")
async def get_current_price(currency: str):
    try:
        # Инициализация сервисов
        coin_gecko = CoinGeckoService()
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        redis_cache = RedisCache(redis_url)
        
        # Проверяем кэш
        cached_price = redis_cache.get_current_price(currency)
        if cached_price:
            logger.info(f"Возвращаем цену из кэша для {currency}")
            return {"price": cached_price}
        
        # Получаем текущую цену
        price_data = await coin_gecko.get_current_price(currency)
        if not price_data:
            logger.error(f"Не удалось получить цену для {currency}")
            raise HTTPException(status_code=404, detail="Price not found")
        
        # Кэшируем результат
        redis_cache.set_current_price(currency, price_data)
        
        return {"price": price_data}
        
    except Exception as e:
        logger.error(f"Ошибка при получении цены для {currency}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'coin_gecko' in locals():
            await coin_gecko.close() 