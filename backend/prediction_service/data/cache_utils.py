import redis
import json
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

class RedisCache:
    def __init__(self, redis_url: str):
        """
        Инициализация подключения к Redis.
        
        Args:
            redis_url: URL для подключения к Redis
        """
        try:
            self.redis = redis.from_url(redis_url)
            self.redis.ping()  # Проверяем подключение
            logger.info("Успешное подключение к Redis")
        except Exception as e:
            logger.warning(f"Не удалось подключиться к Redis: {str(e)}")
            self.redis = None

    def get(self, key: str) -> Optional[Any]:
        """
        Получение данных из кэша.
        
        Args:
            key: Ключ для поиска
            
        Returns:
            Данные из кэша или None, если данные не найдены
        """
        try:
            if self.redis is None:
                return None
                
            data = self.redis.get(key)
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            logger.error(f"Ошибка при получении данных из кэша: {str(e)}")
            return None

    def set(self, key: str, value: Any, ttl: int = 3600) -> bool:
        """
        Сохранение данных в кэш.
        
        Args:
            key: Ключ для сохранения
            value: Данные для сохранения
            ttl: Время жизни кэша в секундах (по умолчанию 1 час)
            
        Returns:
            bool: True если данные успешно сохранены, False в случае ошибки
        """
        try:
            if self.redis is None:
                return False
                
            serialized_value = json.dumps(value)
            self.redis.setex(key, ttl, serialized_value)
            return True
        except Exception as e:
            logger.error(f"Ошибка при сохранении данных в кэш: {str(e)}")
            return False

    def delete(self, key: str) -> bool:
        """
        Удаление данных из кэша.
        
        Args:
            key: Ключ для удаления
            
        Returns:
            bool: True если данные успешно удалены, False в случае ошибки
        """
        try:
            if self.redis is None:
                return False
                
            self.redis.delete(key)
            return True
        except Exception as e:
            logger.error(f"Ошибка при удалении данных из кэша: {str(e)}")
            return False

    def get_current_price(self, currency):
        key = f"current_price:{currency}"
        data = self.get(key)
        return data
    
    def set_current_price(self, currency, price_data, ttl=300):
        key = f"current_price:{currency}"
        self.set(key, price_data, ttl)
        
    def get_forecast(self, currency, interval):
        key = f"forecast:{currency}:{interval}"
        data = self.get(key)
        return data
    
    def set_forecast(self, currency, interval, forecast_data, ttl=3600):
        key = f"forecast:{currency}:{interval}"
        self.set(key, forecast_data, ttl)
        
    def get_model(self, currency, model_type):
        key = f"model:{currency}:{model_type}"
        data = self.get(key)
        return data
    
    def set_model(self, currency, model_type, model_data, ttl=86400):
        key = f"model:{currency}:{model_type}"
        self.set(key, model_data, ttl) 