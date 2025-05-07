import numpy as np
import pandas as pd
from statsmodels.tsa.arima.model import ARIMA
from sklearn.metrics import mean_squared_error
from sklearn.preprocessing import MinMaxScaler
from typing import List, Optional, Tuple
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ArimaModel:
    def __init__(self):
        """Инициализация модели ARIMA с сохранением скейлера для обратного преобразования."""
        self.model = None
        self.scaler = MinMaxScaler()
        self.last_values = None
        
    def prepare_data(self, data: list[float]) -> np.ndarray:
        """
        Подготовка данных для модели ARIMA.
        
        Args:
            data: Список исторических цен
            
        Returns:
            np.ndarray: Подготовленные данные
        """
        try:
            # Преобразуем в numpy массив и обработаем пропущенные значения
            data_array = np.array(data)
            data_array = np.nan_to_num(data_array, nan=np.nanmean(data_array))
            
            # Сохраняем последние значения для обратного преобразования
            self.last_values = data_array[-5:]
            
            # Нормализуем данные
            data_reshaped = data_array.reshape(-1, 1)
            normalized_data = self.scaler.fit_transform(data_reshaped)
            
            return normalized_data.flatten()
        except Exception as e:
            logger.error(f"Ошибка при подготовке данных: {str(e)}")
            raise
            
    def find_best_parameters(self, data: np.ndarray) -> tuple[int, int, int]:
        """
        Определение оптимальных параметров для модели ARIMA.
        В текущей версии возвращает фиксированные параметры.
        
        Args:
            data: Подготовленные данные
            
        Returns:
            tuple: Оптимальные параметры (p, d, q)
        """
        # TODO: Реализовать полный grid search для поиска оптимальных параметров
        return (2, 1, 2)
        
    def train(self, data: np.ndarray) -> None:
        """
        Обучение модели ARIMA на подготовленных данных.
        
        Args:
            data: Подготовленные данные
        """
        try:
            p, d, q = self.find_best_parameters(data)
            self.model = ARIMA(data, order=(p, d, q))
            self.model = self.model.fit()
            logger.info("Модель ARIMA успешно обучена")
        except Exception as e:
            logger.error(f"Ошибка при обучении модели: {str(e)}")
            raise
            
    def forecast(self, data: list[float], steps: int = 7) -> list[float]:
        """
        Прогнозирование будущих цен.
        
        Args:
            data: Исторические данные цен
            steps: Количество шагов для прогноза
            
        Returns:
            list[float]: Прогнозируемые цены
        """
        try:
            logger.info(f"ARIMA forecast: steps={steps}, data_len={len(data)}")
            # Подготовка данных
            prepared_data = self.prepare_data(data)
            
            # Обучение модели
            self.train(prepared_data)
            
            # Прогнозирование
            forecast_normalized = self.model.forecast(steps=steps)
            logger.info(f"ARIMA forecast_normalized shape: {forecast_normalized.shape}")
            
            # Обратное преобразование
            forecast_reshaped = forecast_normalized.reshape(-1, 1)
            forecast = self.scaler.inverse_transform(forecast_reshaped)
            logger.info(f"ARIMA forecast result length: {len(forecast.flatten().tolist())}")
            
            return forecast.flatten().tolist()
        except Exception as e:
            logger.error(f"Ошибка при прогнозировании: {str(e)}")
            raise
    
    def evaluate(self, test_data):
        if self.model is None:
            raise ValueError("Модель не обучена. Сначала вызовите метод train()")
            
        predictions = self.model.forecast(steps=len(test_data))
        mse = mean_squared_error(test_data, predictions)
        return np.sqrt(mse)  # RMSE 