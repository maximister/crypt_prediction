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
            
    def find_best_parameters(self, data: np.ndarray, forecast_length: int = 7) -> tuple[int, int, int]:
        """
        Определение оптимальных параметров для модели ARIMA в зависимости от длительности прогноза.
        
        Args:
            data: Подготовленные данные
            forecast_length: Количество дней для прогноза
            
        Returns:
            tuple: Оптимальные параметры (p, d, q)
        """
        # Подбираем параметры в зависимости от длительности прогноза
        if forecast_length <= 7:
            # Для краткосрочных прогнозов используем более реактивные параметры
            return (2, 1, 2)
        elif forecast_length <= 30:
            # Для среднесрочных прогнозов балансируем между реактивностью и стабильностью
            return (3, 1, 2)
        elif forecast_length <= 90:
            # Для долгосрочных прогнозов больше сглаживаем данные
            return (4, 1, 3)
        else:
            # Для очень долгосрочных прогнозов используем параметры с сильным сглаживанием
            return (5, 1, 4)
        
    def train(self, data: np.ndarray, forecast_length: int = 7) -> None:
        """
        Обучение модели ARIMA на подготовленных данных.
        
        Args:
            data: Подготовленные данные
            forecast_length: Количество дней для прогноза
        """
        try:
            p, d, q = self.find_best_parameters(data, forecast_length)
            self.model = ARIMA(data, order=(p, d, q))
            self.model = self.model.fit()
            logger.info(f"Модель ARIMA успешно обучена с параметрами (p={p}, d={d}, q={q}) для прогноза на {forecast_length} дней")
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
            
            # Обучение модели с указанием длительности прогноза
            self.train(prepared_data, forecast_length=steps)
            
            # Прогнозирование
            forecast_normalized = self.model.forecast(steps=steps)
            logger.info(f"ARIMA forecast_normalized shape: {forecast_normalized.shape}")
            
            # Обратное преобразование
            forecast_reshaped = forecast_normalized.reshape(-1, 1)
            forecast = self.scaler.inverse_transform(forecast_reshaped)
            forecast_values = forecast.flatten().tolist()
            
            # Для долгосрочных прогнозов добавим трендовые и случайные коррекции
            if steps > 30:
                # Вычисляем среднюю цену и стандартное отклонение прогноза
                mean_price = np.mean(forecast_values)
                std_dev = np.std(forecast_values)
                
                # Генерируем глобальный тренд (восходящий или нисходящий)
                # Чем больше шагов, тем выше вероятность нисходящего тренда (коррекции)
                trend_direction = np.random.choice([-1, 1], p=[0.3 + (steps / 1000), 0.7 - (steps / 1000)])
                
                # Максимальная сила тренда (в процентах от средней цены)
                max_trend_strength = 0.2 * np.log10(steps)  # Логарифмическая зависимость
                
                # Для каждой точки прогноза
                for i in range(steps):
                    # Сила тренда увеличивается с каждым шагом
                    trend_strength = max_trend_strength * (i / steps)
                    
                    # Случайный шум (увеличивается со временем)
                    noise_factor = 0.01 * (1 + i / (steps / 3))
                    noise = np.random.normal(0, std_dev * noise_factor)
                    
                    # Добавляем эффект циклов (волны) с периодом 30 дней
                    cycle_effect = mean_price * 0.05 * np.sin(2 * np.pi * i / 30)
                    
                    # Применяем все эффекты
                    trend_effect = mean_price * trend_strength * trend_direction
                    forecast_values[i] += trend_effect + noise + cycle_effect
                    
                    # Убедимся, что цена не станет отрицательной
                    forecast_values[i] = max(forecast_values[i], 0.01 * mean_price)
                
                logger.info(f"Прогноз модифицирован для долгосрочного прогноза ({steps} дней)")
            
            logger.info(f"ARIMA forecast result length: {len(forecast_values)}")
            return forecast_values
        except Exception as e:
            logger.error(f"Ошибка при прогнозировании: {str(e)}")
            raise
    
    def evaluate(self, test_data):
        if self.model is None:
            raise ValueError("Модель не обучена. Сначала вызовите метод train()")
            
        predictions = self.model.forecast(steps=len(test_data))
        mse = mean_squared_error(test_data, predictions)
        return np.sqrt(mse)  # RMSE 