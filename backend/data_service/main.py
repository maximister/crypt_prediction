from fastapi import FastAPI, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timedelta
import requests
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

COINGECKO_API_URL = "https://api.coingecko.com/api/v3"
COINGECKO_API_KEY = os.getenv("COINGECKO_API_KEY")
PREDICTION_SERVICE_URL = "http://localhost:8001"

@app.get("/api/historical/{coin_id}/{period}")
async def get_historical_data(
    coin_id: str,
    period: str,
    is_prediction: bool = False,
    chart_type: str = "real"
):
    try:
        if is_prediction:
            # Получаем прогноз из сервиса прогнозов
            response = requests.get(
                f"{PREDICTION_SERVICE_URL}/api/predict/{coin_id}",
                params={
                    "days": period,
                    "model": "arima",
                    "interval": "daily",
                    "chart_type": chart_type
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail="Ошибка при получении прогноза")
                
            data = response.json()
            return {
                "prices": data.get("predictions", []),
                "market_caps": [],
                "total_volumes": []
            }
        else:
            # Получаем исторические данные
            headers = {"x-cg-pro-api-key": COINGECKO_API_KEY} if COINGECKO_API_KEY else {}
            
            response = requests.get(
                f"{COINGECKO_API_URL}/coins/{coin_id}/market_chart",
                params={
                    "vs_currency": "usd",
                    "days": period,
                    "interval": "daily"
                },
                headers=headers
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail="Ошибка при получении данных")
                
            data = response.json()
            return {
                "prices": data.get("prices", []),
                "market_caps": data.get("market_caps", []),
                "total_volumes": data.get("total_volumes", [])
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/historical/by-dates")
async def get_historical_data_by_dates(
    coin_id: str = Query(..., description="ID криптовалюты"),
    start: str = Query(..., description="Начальная дата в формате YYYY-MM-DD"),
    end: str = Query(..., description="Конечная дата в формате YYYY-MM-DD"),
    is_prediction: bool = Query(False, description="Получить прогноз вместо исторических данных"),
    chart_type: str = Query("real", description="Тип графика (real/prediction)"),
    model: str = Query("arima", description="Модель прогнозирования (arima/lstm)"),
    interval: str = Query("daily", description="Интервал (daily/hourly)")
):
    try:
        start_date = datetime.strptime(start, "%Y-%m-%d")
        end_date = datetime.strptime(end, "%Y-%m-%d")
        if start_date > end_date:
            raise HTTPException(status_code=400, detail="Начальная дата не может быть позже конечной")
        if start_date > datetime.now():
            raise HTTPException(status_code=400, detail="Начальная дата не может быть в будущем")
        days = (end_date - start_date).days + 1
        if is_prediction:
            # Проксируем на prediction_service
            response = requests.get(
                f"{PREDICTION_SERVICE_URL}/api/historical/predict/by-dates",
                params={
                    "coin_id": coin_id,
                    "start": start,
                    "end": end,
                    "model": model,
                    "interval": interval
                }
            )
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail="Ошибка при получении прогноза")
            data = response.json()
            return {
                "prices": data.get("predictions", []),
                "market_caps": [],
                "total_volumes": []
            }
        else:
            # Получаем исторические данные
            headers = {"x-cg-pro-api-key": COINGECKO_API_KEY} if COINGECKO_API_KEY else {}
            
            response = requests.get(
                f"{COINGECKO_API_URL}/coins/{coin_id}/market_chart",
                params={
                    "vs_currency": "usd",
                    "days": days,
                    "interval": "daily"
                },
                headers=headers
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail="Ошибка при получении данных")
                
            data = response.json()
            
            # Фильтруем данные по заданному диапазону дат
            prices = []
            market_caps = []
            total_volumes = []
            
            for price_point in data.get("prices", []):
                timestamp = datetime.fromtimestamp(price_point[0] / 1000)
                if start_date <= timestamp <= end_date:
                    prices.append(price_point)
                    
            for cap_point in data.get("market_caps", []):
                timestamp = datetime.fromtimestamp(cap_point[0] / 1000)
                if start_date <= timestamp <= end_date:
                    market_caps.append(cap_point)
                    
            for volume_point in data.get("total_volumes", []):
                timestamp = datetime.fromtimestamp(volume_point[0] / 1000)
                if start_date <= timestamp <= end_date:
                    total_volumes.append(volume_point)
            
            return {
                "prices": prices,
                "market_caps": market_caps,
                "total_volumes": total_volumes
            }
    except ValueError:
        raise HTTPException(status_code=400, detail="Неверный формат даты. Используйте формат YYYY-MM-DD")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002) 