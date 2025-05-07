from typing import List, Optional, Tuple
import aiohttp
import os
from datetime import datetime, timedelta
import logging
import asyncio

logger = logging.getLogger(__name__)

class CoinGeckoService:
    def __init__(self):
        self.base_urls = [
            "https://api.coingecko.com/api/v3",
            "https://pro-api.coingecko.com/api/v3",  # Альтернативный URL
        ]
        self.current_url_index = 0
        self.api_key = os.getenv("COINGECKO_API_KEY")
        self.timeout = aiohttp.ClientTimeout(total=10)  # 10 секунд таймаут

    async def _make_request(self, endpoint: str, params: dict) -> Optional[dict]:
        headers = {"x-cg-pro-api-key": self.api_key} if self.api_key else {}
        
        for _ in range(len(self.base_urls)):
            base_url = self.base_urls[self.current_url_index]
            url = f"{base_url}{endpoint}"
            
            try:
                logger.info(f"[CoinGecko][REQUEST] url={url} params={params} headers={headers}")
                async with aiohttp.ClientSession(timeout=self.timeout) as session:
                    async with session.get(url, params=params, headers=headers, ssl=False) as response:
                        logger.info(f"[CoinGecko][RESPONSE STATUS] {response.status} for url={url}")
                        resp_text = await response.text()
                        if response.status == 200:
                            logger.info(f"[CoinGecko][RESPONSE DATA] {resp_text}")
                            return await response.json()
                        elif response.status == 429:  # Rate limit
                            logger.warning("Достигнут лимит запросов к CoinGecko API")
                            await asyncio.sleep(1)  # Ждем секунду перед следующей попыткой
                        else:
                            logger.error(f"[CoinGecko][RESPONSE ERROR] {resp_text}")
                            logger.error(f"Ошибка API CoinGecko: {response.status}")
            
            except Exception as e:
                logger.error(f"Ошибка при запросе к {url}: {str(e)}")
                
            # Пробуем следующий URL
            self.current_url_index = (self.current_url_index + 1) % len(self.base_urls)
            
        return None

    async def get_coin_history(self, coin_id: str, days: int) -> List[Tuple[int, float]]:
        """
        Получает исторические данные о цене криптовалюты.
        
        Args:
            coin_id: ID криптовалюты
            days: Количество дней
            
        Returns:
            List[Tuple[int, float]]: Список кортежей (timestamp, price)
        """
        try:
            params = {
                "vs_currency": "usd",
                "days": str(days),
                "interval": "daily"
            }
            
            data = await self._make_request(f"/coins/{coin_id}/market_chart", params)
            if data:
                return data.get("prices", [])
            
            return None
            
        except Exception as e:
            logger.error(f"Ошибка при получении истории цены: {e}")
            return None 