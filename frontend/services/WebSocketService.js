import { EventEmitter } from 'events';

// Синглтон для WebSocket соединения
class WebSocketService {
  constructor() {
    this.connection = null;
    this.eventEmitter = new EventEmitter();
    this.isConnected = false;
    this.reconnectInterval = null;
    this.url = 'ws://localhost:8001/ws/updates';
    this.subscribedCoins = new Set();
  }

  // Подключиться к WebSocket серверу
  connect() {
    if (this.connection) {
      return;
    }

    try {
      this.connection = new WebSocket(this.url);
      
      this.connection.onopen = () => {
        console.log('WebSocket соединение установлено');
        this.isConnected = true;
        this.eventEmitter.emit('ws_connected');
        
        if (this.reconnectInterval) {
          clearInterval(this.reconnectInterval);
          this.reconnectInterval = null;
        }
      };
      
      this.connection.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.eventEmitter.emit('message', data);
          
          if (data.type === 'price') {
            Object.keys(data.payload).forEach(coin => {
              this.eventEmitter.emit(`price_update_${coin}`, data.payload[coin]);
            });
          }
        } catch (err) {
          console.error('Ошибка при обработке сообщения WebSocket:', err);
        }
      };
      
      this.connection.onerror = (error) => {
        console.error('Ошибка WebSocket:', error);
        this.eventEmitter.emit('ws_error', error);
      };
      
      this.connection.onclose = () => {
        console.log('WebSocket соединение закрыто. Попытка переподключения...');
        this.isConnected = false;
        this.connection = null;
        this.eventEmitter.emit('ws_disconnected');
        
        // Попытка переподключения
        if (!this.reconnectInterval) {
          this.reconnectInterval = setInterval(() => {
            this.connect();
          }, 5000);
        }
      };
    } catch (err) {
      console.error('Ошибка при создании WebSocket соединения:', err);
      this.eventEmitter.emit('ws_error', err);
    }
  }

  // Подписаться на обновления цены конкретной монеты
  subscribeToPrice(coin, callback) {
    this.subscribedCoins.add(coin);
    this.eventEmitter.on(`price_update_${coin}`, callback);
    
    // Если соединение не установлено, установить его
    if (!this.isConnected) {
      this.connect();
    }
    
    return () => {
      this.eventEmitter.off(`price_update_${coin}`, callback);
      this.subscribedCoins.delete(coin);
    };
  }

  // Подписаться на все сообщения
  subscribeToAllMessages(callback) {
    this.eventEmitter.on('message', callback);
    
    // Если соединение не установлено, установить его
    if (!this.isConnected) {
      this.connect();
    }
    
    return () => {
      this.eventEmitter.off('message', callback);
    };
  }

  // Отключиться от WebSocket сервера
  disconnect() {
    if (this.connection) {
      this.connection.close();
      this.connection = null;
      this.isConnected = false;
      
      if (this.reconnectInterval) {
        clearInterval(this.reconnectInterval);
        this.reconnectInterval = null;
      }
    }
  }
}

// Создаем и экспортируем единый экземпляр сервиса
const websocketService = new WebSocketService();
export default websocketService; 