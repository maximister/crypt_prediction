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
            
            for _ in range(days_forward):
                predicted_value = self.model.predict(current_sequence, verbose=0)
                predictions.append(predicted_value[0, 0])
                
                # Обновляем последовательность для следующего прогноза
                current_sequence = np.roll(current_sequence, -1)
                current_sequence[0, -1, 0] = predicted_value
            
            # Преобразуем предсказания обратно в исходный масштаб
            predictions_array = np.array(predictions).reshape(-1, 1)
            predictions_rescaled = self.scaler.inverse_transform(predictions_array)
            
            return predictions_rescaled.flatten()
            
        except Exception as e:
            logger.error(f"Ошибка при прогнозировании LSTM: {str(e)}")
            raise 