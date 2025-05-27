# Crypto Tracker

Приложение для отслеживания и прогнозирования курсов криптовалют с настраиваемыми дашбордами и расширенной аналитикой.

## Основные функции

- **Мониторинг цен** криптовалют в реальном времени
- **Настраиваемые дашборды**
- **Прогнозирование** цен с выбором периода
- **Визуализация** исторических данных и прогнозов
## Стек технологий

- Фронтенд: Next.js, React, Chart.js, Redux
- Бэкенд: FastAPI (Python), MongoDB, Redis
- Внешние API: CoinGecko
- Модели прогнозирования: ARIMA
- 
## Установка и запуск

### Запуск с помощью Docker

1. Клонируйте репозиторий:
```bash
git clone [<repository-url>](https://github.com/maximister/crypt_prediction.git)
cd crypt_prediction
```

2. Создайте файл `.env`для prediction_service:
```bash
COINGECKO_API_KEY=<ключ для coingecko>
REDIS_URL=<url развернутого redis>
COINGECKO_API_URL=https://api.coingecko.com/api/v3
CACHE_TTL=ttl для redis
```

3. Запустите бд и redis с помощью Docker Compose:
```bash
docker-compose up --build
```

4. Запустите backend сервисы:
```bash
cd backend/data_service
python -m venv venv
source venv/Scripts/activate
python main.py

cd backend/notification_service
python -m venv venv
source venv/Scripts/activate
python main.py

cd backend/user_service
python -m venv venv
source venv/Scripts/activate
python main.py

cd backend/prediction_service
python -m venv venv
source venv/Scripts/activate
python main.py
```

3. Запустите frontend:
```bash
cd frontend
npm install
npm run dev
```
