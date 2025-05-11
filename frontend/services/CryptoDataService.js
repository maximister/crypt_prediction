// Кэш данных
const cache = {
  prices: {},
  forecasts: {},
  info: {},
  historical: {},
  // Время последнего обновления данных в кэше (в мс)
  lastUpdated: {
    prices: {},
    forecasts: {},
    info: {},
    historical: {}
  }
};

// Время жизни кэша в миллисекундах
const CACHE_TTL = {
  prices: 60 * 1000, // 1 минута для цен
  forecasts: 30 * 60 * 1000, // 30 минут для прогнозов
  info: 24 * 60 * 60 * 1000, // 24 часа для информации о монетах
  historical: 6 * 60 * 60 * 1000 // 6 часов для исторических данных
};

// Проверить, устарел ли кэш
const isCacheStale = (type, coinId) => {
  const lastUpdated = cache.lastUpdated[type][coinId] || 0;
  return Date.now() - lastUpdated > CACHE_TTL[type];
};

// Сервис для работы с данными о криптовалютах
class CryptoDataService {
  // Получить текущую цену криптовалюты
  async getPrice(coinId) {
    // Если данные в кэше не устарели, вернуть их
    if (cache.prices[coinId] && !isCacheStale('prices', coinId)) {
      return cache.prices[coinId];
    }

    try {
      const response = await fetch(`http://localhost:8001/api/price/${coinId}`);
      if (!response.ok) {
        throw new Error(`Ошибка получения цены для ${coinId}: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Обновить кэш
      cache.prices[coinId] = data.price;
      cache.lastUpdated.prices[coinId] = Date.now();
      
      return data.price;
    } catch (error) {
      console.error(`Ошибка получения цены для ${coinId}:`, error);
      
      // Если в кэше есть данные, вернуть их, даже если они устарели
      if (cache.prices[coinId]) {
        return cache.prices[coinId];
      }
      
      // Генерируем фейковые данные для демонстрации
      const mockPrice = Math.random() * 50000 + 1000;
      return mockPrice;
    }
  }

  // Получить прогноз цены криптовалюты
  async getForecast(coinId, days = 7) {
    // Параметр days может быть числом или строкой
    // Для бэкенда формируем строку с суффиксом 'd', если это число
    const daysParam = typeof days === 'number' ? `${days}d` : days;
    const cacheKey = `${coinId}_${daysParam}`;
    
    // Если данные в кэше не устарели, вернуть их
    if (cache.forecasts[coinId] && cache.forecasts[coinId].period === daysParam && !isCacheStale('forecasts', coinId)) {
      return cache.forecasts[coinId];
    }

    try {
      const response = await fetch(`http://localhost:8001/api/predict/${coinId}/${daysParam}`);
      if (!response.ok) {
        throw new Error(`Ошибка получения прогноза для ${coinId}: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Добавляем период в данные кэша для возможности кэширования разных периодов
      data.period = daysParam;
      
      // Обновить кэш
      cache.forecasts[coinId] = data;
      cache.lastUpdated.forecasts[coinId] = Date.now();
      
      return data;
    } catch (error) {
      console.error(`Ошибка получения прогноза для ${coinId}:`, error);
      
      // Если в кэше есть данные, вернуть их, даже если они устарели
      if (cache.forecasts[coinId]) {
        return cache.forecasts[coinId];
      }
      
      // Преобразуем daysParam в число для генерации данных, если это строка с 'd'
      const daysNumber = typeof days === 'number' ? days : parseInt(days);
      
      // Генерируем фейковые данные для демонстрации
      const mockForecast = {
        forecast: Array.from({ length: daysNumber }, (_, i) => ({
          datetime: new Date(Date.now() + i * 86400000).toISOString(),
          price: Math.random() * 10000 + 1000
        })),
        period: daysParam
      };
      return mockForecast;
    }
  }

  // Получить информацию о криптовалюте
  async getCurrencyInfo(coinId) {
    // Если данные в кэше не устарели, вернуть их
    if (cache.info[coinId] && !isCacheStale('info', coinId)) {
      return cache.info[coinId];
    }

    try {
      const response = await fetch(`http://localhost:8000/cryptocurrencies/${coinId}`);
      if (!response.ok) {
        throw new Error(`Ошибка получения информации о ${coinId}: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Обновить кэш
      cache.info[coinId] = data;
      cache.lastUpdated.info[coinId] = Date.now();
      
      return data;
    } catch (error) {
      console.error(`Ошибка получения информации о ${coinId}:`, error);
      
      // Если в кэше есть данные, вернуть их, даже если они устарели
      if (cache.info[coinId]) {
        return cache.info[coinId];
      }
      
      // Генерируем базовые данные
      return { 
        id: coinId, 
        name: coinId.charAt(0).toUpperCase() + coinId.slice(1), 
        symbol: coinId.substring(0, 3).toUpperCase() 
      };
    }
  }

  // Получить несколько цен за один запрос
  async getPrices(coinIds) {
    if (!coinIds || coinIds.length === 0) {
      return {};
    }

    const result = {};
    const coinsToFetch = [];

    // Проверить кэш для каждой монеты
    coinIds.forEach(coinId => {
      if (cache.prices[coinId] && !isCacheStale('prices', coinId)) {
        result[coinId] = cache.prices[coinId];
      } else {
        coinsToFetch.push(coinId);
      }
    });

    if (coinsToFetch.length === 0) {
      return result;
    }

    try {
      // Для упрощения будем запрашивать цены по одной
      // В идеале здесь должен быть один запрос для получения нескольких цен
      const pricePromises = coinsToFetch.map(coinId => 
        this.getPrice(coinId).then(price => ({ coinId, price }))
      );
      
      const prices = await Promise.all(pricePromises);
      
      prices.forEach(({ coinId, price }) => {
        result[coinId] = price;
      });
      
      return result;
    } catch (error) {
      console.error("Ошибка получения цен:", error);
      
      // Заполнить отсутствующие монеты случайными ценами
      coinsToFetch.forEach(coinId => {
        if (!result[coinId]) {
          result[coinId] = Math.random() * 50000 + 1000;
        }
      });
      
      return result;
    }
  }

  // Получить несколько прогнозов за один запрос
  async getForecasts(coinIds, days = 7) {
    // Параметр days может быть числом или строкой
    // Для бэкенда формируем строку с суффиксом 'd', если это число
    const daysParam = typeof days === 'number' ? `${days}d` : days;
    
    if (!coinIds || coinIds.length === 0) {
      return {};
    }

    const result = {};
    const coinsToFetch = [];

    // Проверить кэш для каждой монеты
    coinIds.forEach(coinId => {
      if (cache.forecasts[coinId] && cache.forecasts[coinId].period === daysParam && !isCacheStale('forecasts', coinId)) {
        result[coinId] = cache.forecasts[coinId];
      } else {
        coinsToFetch.push(coinId);
      }
    });

    if (coinsToFetch.length === 0) {
      return result;
    }

    try {
      // Запрашиваем прогнозы параллельно
      const forecastPromises = coinsToFetch.map(coinId => 
        this.getForecast(coinId, daysParam).then(forecast => ({ coinId, forecast }))
      );
      
      const forecasts = await Promise.all(forecastPromises);
      
      forecasts.forEach(({ coinId, forecast }) => {
        result[coinId] = forecast;
      });
      
      return result;
    } catch (error) {
      console.error("Ошибка получения прогнозов:", error);
      
      // Преобразуем daysParam в число для генерации данных, если это строка с 'd'
      const daysNumber = typeof days === 'number' ? days : parseInt(days);
      
      // Заполнить отсутствующие монеты случайными прогнозами
      coinsToFetch.forEach(coinId => {
        if (!result[coinId]) {
          result[coinId] = {
            forecast: Array.from({ length: daysNumber }, (_, i) => ({
              datetime: new Date(Date.now() + i * 86400000).toISOString(),
              price: Math.random() * 10000 + 1000
            })),
            period: daysParam
          };
        }
      });
      
      return result;
    }
  }

  // Получить информацию о нескольких криптовалютах за один запрос
  async getCurrenciesInfo(coinIds) {
    if (!coinIds || coinIds.length === 0) {
      return {};
    }

    const result = {};
    const coinsToFetch = [];

    // Проверить кэш для каждой монеты
    coinIds.forEach(coinId => {
      if (cache.info[coinId] && !isCacheStale('info', coinId)) {
        result[coinId] = cache.info[coinId];
      } else {
        coinsToFetch.push(coinId);
      }
    });

    if (coinsToFetch.length === 0) {
      return result;
    }

    try {
      // Запрашиваем информацию параллельно
      const infoPromises = coinsToFetch.map(coinId => 
        this.getCurrencyInfo(coinId).then(info => ({ coinId, info }))
      );
      
      const infos = await Promise.all(infoPromises);
      
      infos.forEach(({ coinId, info }) => {
        result[coinId] = info;
      });
      
      return result;
    } catch (error) {
      console.error("Ошибка получения информации о монетах:", error);
      
      // Заполнить отсутствующие монеты базовыми данными
      coinsToFetch.forEach(coinId => {
        if (!result[coinId]) {
          result[coinId] = { 
            id: coinId, 
            name: coinId.charAt(0).toUpperCase() + coinId.slice(1), 
            symbol: coinId.substring(0, 3).toUpperCase() 
          };
        }
      });
      
      return result;
    }
  }

  // Получить исторические данные о цене криптовалюты
  async getHistoricalData(coinId, days = 7) {
    // Параметр days может быть числом или строкой
    // Для бэкенда формируем строку с суффиксом 'd', если это число
    const daysParam = typeof days === 'number' ? `${days}d` : days;
    const cacheKey = `${coinId}_${daysParam}`;
    
    // Если данные в кэше не устарели, вернуть их
    if (cache.historical[cacheKey] && !isCacheStale('historical', cacheKey)) {
      return cache.historical[cacheKey];
    }

    try {
      const response = await fetch(`http://localhost:8001/api/historical/${coinId}/${daysParam}`);
      if (!response.ok) {
        throw new Error(`Ошибка получения исторических данных для ${coinId}: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Добавляем период в данные и обновляем кэш
      data.period = daysParam;
      cache.historical[cacheKey] = data;
      cache.lastUpdated.historical[cacheKey] = Date.now();
      
      return data;
    } catch (error) {
      console.error(`Ошибка получения исторических данных для ${coinId}:`, error);
      
      // Если в кэше есть данные, вернуть их, даже если они устарели
      if (cache.historical[cacheKey]) {
        return cache.historical[cacheKey];
      }
      
      // Генерируем фейковые данные для демонстрации
      const mockData = {
        prices: [],
        period: daysParam
      };
      
      // Генерируем исторические данные
      const now = Date.now();
      let price = Math.random() * 50000 + 1000;
      
      // Преобразуем daysParam в число для генерации данных, если это строка с 'd'
      const daysNumber = typeof days === 'number' ? days : parseInt(days);
      
      for (let i = daysNumber; i >= 0; i--) {
        const timestamp = now - i * 86400000;
        // Случайное изменение цены в пределах ±5%
        const change = (Math.random() * 10 - 5) / 100;
        price = price * (1 + change);
        mockData.prices.push([timestamp, price]);
      }
      
      return mockData;
    }
  }

  // Очистить кэш
  clearCache() {
    cache.prices = {};
    cache.forecasts = {};
    cache.info = {};
    cache.historical = {};
    cache.lastUpdated = {
      prices: {},
      forecasts: {},
      info: {},
      historical: {}
    };
  }
}

const cryptoDataService = new CryptoDataService();
export default cryptoDataService; 