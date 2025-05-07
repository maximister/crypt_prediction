from fastapi import APIRouter, HTTPException
from data.fetch_prices import CoinGeckoAPI
from data.cache_utils import RedisCache
import os

router = APIRouter()

@router.get("/{currency}")
async def get_current_price(currency: str):
    try:
        # Инициализация сервисов
        coin_gecko = CoinGeckoAPI(os.getenv("COINGECKO_API_URL"))
        redis_cache = RedisCache(os.getenv("REDIS_URL"))
        
        # Проверяем кэш
        cached_price = redis_cache.get_price(currency)
        if cached_price:
            return cached_price
        
        # Получаем текущую цену
        price_data = coin_gecko.get_current_price(currency)
        if not price_data:
            raise HTTPException(status_code=404, detail="Price not found")
        
        # Кэшируем результат
        redis_cache.set_price(currency, price_data)
        
        return price_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 