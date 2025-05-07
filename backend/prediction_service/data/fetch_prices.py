import requests
import pandas as pd
from datetime import datetime, timedelta
import time
import logging
import aiohttp
import asyncio
import os
from dotenv import load_dotenv

# Загружаем переменные окружения
load_dotenv()

logger = logging.getLogger(__name__)

class CoinGeckoAPI:
    def __init__(self):
        self.base_url = "https://api.coingecko.com/api/v3"
        self.session = None
        self.api_key = os.getenv("COINGECKO_API_KEY")

    async def _ensure_session(self):
        if self.session is None:
            self.session = aiohttp.ClientSession()

    async def close(self):
        if self.session:
            await self.session.close()
            self.session = None

    async def get_historical_prices(self, coin_id: str, days: int = 30):
        """
        Получает исторические данные о ценах криптовалюты.
        
        Args:
            coin_id: ID криптовалюты на CoinGecko
            days: Количество дней истории
            
        Returns:
            List of [timestamp, price] pairs
        """
        try:
            await self._ensure_session()
            url = f"{self.base_url}/coins/{coin_id}/market_chart"
            params = {
                "vs_currency": "usd",
                "days": str(days),
                "interval": "daily"
            }
            headers = {"x-cg-pro-api-key": self.api_key} if self.api_key else {}

            async with self.session.get(url, params=params, headers=headers) as response:
                if response.status == 429:  # Rate limit
                    logger.warning("Rate limit hit, waiting before retry...")
                    await asyncio.sleep(60)
                    return await self.get_historical_prices(coin_id, days)
                
                if response.status != 200:
                    logger.error(f"Error fetching data: {response.status}")
                    return None
                
                data = await response.json()
                return data.get("prices", [])

        except Exception as e:
            logger.error(f"Error in get_historical_prices: {str(e)}")
            return None

    async def get_current_price(self, coin_id: str):
        """
        Получает текущую цену криптовалюты.
        
        Args:
            coin_id: ID криптовалюты на CoinGecko
            
        Returns:
            Current price in USD
        """
        try:
            await self._ensure_session()
            url = f"{self.base_url}/simple/price"
            params = {
                "ids": coin_id,
                "vs_currencies": "usd"
            }
            headers = {"x-cg-pro-api-key": self.api_key} if self.api_key else {}

            async with self.session.get(url, params=params, headers=headers) as response:
                if response.status == 429:  # Rate limit
                    logger.warning("Rate limit hit, waiting before retry...")
                    await asyncio.sleep(60)
                    return await self.get_current_price(coin_id)
                
                if response.status != 200:
                    logger.error(f"Error fetching current price: {response.status}")
                    return None
                
                data = await response.json()
                return data.get(coin_id, {}).get("usd")

        except Exception as e:
            logger.error(f"Error in get_current_price: {str(e)}")
            return None

    def get_timestamps(self, days):
        """Генерирует список временных меток для указанного периода"""
        try:
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=days)
            
            # Создаем временные метки с интервалом в 1 час для 1 дня
            # и с интервалом в 1 день для более длительных периодов
            if days == 1:
                freq = 'H'
            else:
                freq = 'D'
                
            timestamps = pd.date_range(start=start_date, end=end_date, freq=freq)
            return timestamps.tolist()
            
        except Exception as e:
            logger.error(f"Ошибка при генерации временных меток: {str(e)}")
            raise 