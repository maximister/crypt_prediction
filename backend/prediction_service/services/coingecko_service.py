from typing import List, Optional, Tuple
import aiohttp
import os
from datetime import datetime, timedelta
import logging
import asyncio
import traceback
from dotenv import load_dotenv

load_dotenv()

# Настройка логирования
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class CoinGeckoService:
    def __init__(self):
        self.api_key = os.getenv("COINGECKO_API_KEY")
        self.base_url = "https://api.coingecko.com/api/v3"
        if not self.api_key:
            logger.warning("COINGECKO_API_KEY не установлен, будут использоваться ограничения бесплатного API")
        else:
            logger.info(f"Используется API ключ: {self.api_key[:8]}...{self.api_key[-4:]}")
            logger.info(f"Используется URL: {self.base_url}")
        self.session = None
        logger.debug("CoinGeckoService инициализирован")

    async def _ensure_session(self):
        if self.session is None:
            logger.debug("Создаем новую сессию aiohttp")
            self.session = aiohttp.ClientSession()
            logger.debug("Сессия aiohttp создана")

    async def _make_request(self, url: str, params: dict, headers: dict) -> dict:
        try:
            logger.debug(f"Подготовка запроса к {url}")
            logger.debug(f"Параметры запроса: {params}")
            logger.debug(f"Заголовки запроса: {headers}")
            
            if self.api_key:
                logger.debug(f"Используется API ключ: {self.api_key[:8]}...{self.api_key[-4:]}")
            
            # Добавляем логирование полного URL с параметрами
            full_url = f"{url}?{'&'.join(f'{k}={v}' for k, v in params.items())}"
            logger.debug(f"Полный URL запроса: {full_url}")
            
            async with self.session.get(url, params=params, headers=headers) as response:
                response_text = await response.text()
                logger.debug(f"Получен ответ от API. Статус: {response.status}")
                logger.debug(f"Тело ответа: {response_text}")
                
                if response.status == 429:
                    logger.warning("Достигнут лимит запросов к CoinGecko API")
                    raise Exception("Rate limit exceeded")
                elif response.status != 200:
                    error_msg = f"Ошибка API: {response.status} - {response_text}"
                    logger.error(error_msg)
                    logger.error(f"Stack trace: {traceback.format_exc()}")
                    raise Exception(error_msg)
                
                try:
                    data = await response.json()
                    logger.debug(f"Успешно получены данные: {str(data)[:200]}...")
                    return data
                except Exception as e:
                    logger.error(f"Ошибка при разборе JSON: {str(e)}")
                    logger.error(f"Тело ответа: {response_text}")
                    raise
        except aiohttp.ClientError as e:
            logger.error(f"Ошибка сети при запросе к API: {str(e)}")
            logger.error(f"Stack trace: {traceback.format_exc()}")
            raise
        except Exception as e:
            logger.error(f"Непредвиденная ошибка при запросе к API: {str(e)}")
            logger.error(f"Stack trace: {traceback.format_exc()}")
            raise

    async def get_current_price(self, coin_id: str) -> float:
        try:
            logger.debug(f"Запрос текущей цены для {coin_id}")
            await self._ensure_session()
            headers = {}
            if self.api_key:
                headers["x-cg-api-key"] = self.api_key

            url = f"{self.base_url}/simple/price"
            params = {
                "ids": coin_id,
                "vs_currencies": "usd"
            }

            data = await self._make_request(url, params, headers)
            if not data or coin_id not in data:
                error_msg = f"Нет данных о цене для {coin_id}"
                logger.error(error_msg)
                logger.error(f"Полученные данные: {data}")
                raise Exception(error_msg)
            
            price = data[coin_id]["usd"]
            logger.debug(f"Получена цена {price} для {coin_id}")
            return price

        except Exception as e:
            logger.error(f"Ошибка при получении текущей цены: {str(e)}")
            logger.error(f"Stack trace: {traceback.format_exc()}")
            raise

    async def get_historical_prices(self, coin_id: str, days: int) -> list:
        try:
            logger.debug(f"Запрос исторических цен для {coin_id} за {days} дней")
            await self._ensure_session()
            headers = {}
            if self.api_key:
                headers["x-cg-api-key"] = self.api_key

            url = f"{self.base_url}/coins/{coin_id}/market_chart"
            params = {
                "vs_currency": "usd",
                "days": str(days),
                "interval": "daily"
            }

            data = await self._make_request(url, params, headers)
            if not data or "prices" not in data:
                error_msg = f"Нет исторических данных для {coin_id}"
                logger.error(error_msg)
                logger.error(f"Полученные данные: {data}")
                raise Exception(error_msg)
            
            prices = data["prices"]
            logger.debug(f"Получено {len(prices)} исторических цен для {coin_id}")
            return prices

        except Exception as e:
            logger.error(f"Ошибка при получении исторических цен: {str(e)}")
            logger.error(f"Stack trace: {traceback.format_exc()}")
            raise

    async def get_coin_history(self, coin_id: str, days: int) -> list:
        try:
            logger.debug(f"Запрос истории цен для {coin_id} за {days} дней")
            await self._ensure_session()
            headers = {}
            if self.api_key:
                headers["x-cg-api-key"] = self.api_key

            url = f"{self.base_url}/coins/{coin_id}/market_chart"
            params = {
                "vs_currency": "usd",
                "days": str(days),
                "interval": "daily"
            }
            
            data = await self._make_request(url, params, headers)
            if not data or "prices" not in data:
                error_msg = f"Нет данных истории цен для {coin_id}"
                logger.error(error_msg)
                logger.error(f"Полученные данные: {data}")
                raise Exception(error_msg)
            
            prices = data["prices"]
            logger.debug(f"Получено {len(prices)} записей истории цен для {coin_id}")
            return prices
            
        except Exception as e:
            logger.error(f"Ошибка при получении истории цен: {str(e)}")
            logger.error(f"Stack trace: {traceback.format_exc()}")
            raise

    async def close(self):
        if self.session:
            logger.debug("Закрытие сессии aiohttp")
            await self.session.close()
            self.session = None
            logger.debug("Сессия aiohttp закрыта") 