import numpy as np
from sklearn.preprocessing import MinMaxScaler
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense
import logging

logger = logging.getLogger(__name__)

class LSTMModel:
    def __init__(self):
        self.model = None
        self.scaler = MinMaxScaler(feature_range=(0, 1))
        self.sequence_length = 10
        
    def prepare_data(self, data):
        """Подготовка данных для LSTM"""
        try:
            # Преобразуем данные в numpy массив и изменяем форму для скейлера
            data_array = np.array(data).reshape(-1, 1)
            
            # Нормализуем данные
            scaled_data = self.scaler.fit_transform(data_array)
            
            X, y = [], []
            for i in range(len(scaled_data) - self.sequence_length):
                X.append(scaled_data[i:(i + self.sequence_length), 0])
                y.append(scaled_data[i + self.sequence_length, 0])
                
            X = np.array(X)
            y = np.array(y)
            
            # Изменяем форму для LSTM [samples, time steps, features]
            X = np.reshape(X, (X.shape[0], X.shape[1], 1))
            
            return X, y
            
        except Exception as e:
            logger.error(f"Ошибка при подготовке данных для LSTM: {str(e)}")
            raise
    
    def create_model(self, sequence_length):
        """Создание модели LSTM"""
        try:
            model = Sequential([
                LSTM(50, activation='relu', input_shape=(sequence_length, 1), return_sequences=True),
                LSTM(50, activation='relu'),
                Dense(1)
            ])
            
            model.compile(optimizer='adam', loss='mse')
            return model
            
        except Exception as e:
            logger.error(f"Ошибка при создании модели LSTM: {str(e)}")
            raise
    
    def predict(self, data, days_forward):
        """Прогнозирование цен"""
        try:
            # Подготовка данных
            X, y = self.prepare_data(data)
            
            # Создание и обучение модели
            self.model = self.create_model(self.sequence_length)
            self.model.fit(X, y, epochs=50, batch_size=32, verbose=0)
            
            # Подготовка последней известной последовательности
            last_sequence = np.array(data[-self.sequence_length:]).reshape(-1, 1)
            last_sequence_scaled = self.scaler.transform(last_sequence)
            
            # Прогнозирование
            predictions = []
            current_sequence = last_sequence_scaled.reshape(1, self.sequence_length, 1)
            
            # Параметры для долгосрочного прогноза
            mean_price = np.mean(data)
            std_dev = np.std(data)
            
            # Определим, будет ли прогноз иметь восходящий или нисходящий тренд
            is_long_term = days_forward > 30
            if is_long_term:
                # Для долгосрочных прогнозов чаще используем смешанный тренд
                trend_types = ['up', 'down', 'mixed', 'cycle']
                trend_type = np.random.choice(trend_types, p=[0.3, 0.3, 0.2, 0.2])
                logger.info(f"LSTM долгосрочный прогноз на {days_forward} дней с трендом: {trend_type}")
            
            for i in range(days_forward):
                # Базовый прогноз от LSTM
                predicted_value = self.model.predict(current_sequence, verbose=0)
                base_prediction = predicted_value[0, 0]
                
                # Для долгосрочных прогнозов добавляем разнообразие
                if is_long_term:
                    # Шум увеличивается со временем для большей неопределенности
                    noise_factor = 0.005 * (1 + i / (days_forward / 2))
                    noise = np.random.normal(0, noise_factor)
                    
                    # Добавляем различные паттерны в зависимости от выбранного тренда
                    if trend_type == 'up':
                        # Восходящий тренд с возрастающим углом
                        trend_factor = 0.001 * (i / days_forward) * (i + 1)
                        base_prediction += trend_factor + noise
                    elif trend_type == 'down':
                        # Нисходящий тренд с ускорением
                        trend_factor = -0.001 * (i / days_forward) * (i + 1)
                        base_prediction += trend_factor + noise
                    elif trend_type == 'mixed':
                        # Смешанный тренд с переключением направления
                        if i < days_forward / 2:
                            trend_factor = 0.001 * (i / (days_forward / 2))
                        else:
                            trend_factor = 0.001 * (1 - (i - days_forward / 2) / (days_forward / 2))
                        base_prediction += trend_factor + noise
                    elif trend_type == 'cycle':
                        # Циклический паттерн
                        cycle_length = days_forward / 3
                        cycle_effect = 0.01 * np.sin(2 * np.pi * i / cycle_length)
                        base_prediction += cycle_effect + noise
                
                # Обновляем последовательность для следующего прогноза
                current_sequence = np.roll(current_sequence, -1)
                current_sequence[0, -1, 0] = base_prediction
                
                predictions.append(base_prediction)
            
            # Преобразуем предсказания обратно в исходный масштаб
            predictions_array = np.array(predictions).reshape(-1, 1)
            predictions_rescaled = self.scaler.inverse_transform(predictions_array)
            
            return predictions_rescaled.flatten()
            
        except Exception as e:
            logger.error(f"Ошибка при прогнозировании LSTM: {str(e)}")
            raise
    
    def forecast(self, data, steps=7):
        """Алиас для метода predict для совместимости с интерфейсом ArimaModel"""
        return self.predict(data, steps) 