# Crypto Tracker

Приложение для отслеживания и прогнозирования курсов криптовалют.

## Стек технологий

- Фронтенд: Next.js, React, WebSocket, Chart.js
- Бэкенд: FastAPI (Python), MongoDB, Redis
- Внешние API: CoinGecko

## Требования

- Docker
- Docker Compose
- Node.js 18+
- Python 3.9+

## Запуск проекта

1. Клонируйте репозиторий:
```bash
git clone <repository-url>
cd crypto-tracker
```

2. Запустите проект с помощью Docker Compose:
```bash
docker-compose up --build
```

3. Откройте приложение в браузере:
```
http://localhost:3000
```

## Структура проекта

```
.
├── frontend/              # Next.js приложение
├── backend/
│   ├── user_service/      # Сервис пользователей
│   └── prediction_service/# Сервис предсказаний
├── docker-compose.yml     # Конфигурация Docker
└── README.md             # Документация
```

## API Endpoints

### User Service (http://localhost:8000)

- POST /register - Регистрация пользователя
- POST /token - Получение JWT токена
- GET /watchlist - Получение списка отслеживаемых криптовалют
- PUT /watchlist - Обновление списка отслеживаемых криптовалют

### Prediction Service (http://localhost:8001)

- GET /current/{currency} - Получение текущего курса
- GET /predict/{currency}/{interval} - Получение прогноза
- WebSocket /ws/updates - Обновления курсов в реальном времени

## Разработка

### Фронтенд

```bash
cd frontend
npm install
npm run dev
```

### Бэкенд

```bash
cd backend/user_service
pip install -r requirements.txt
uvicorn main:app --reload

cd backend/prediction_service
pip install -r requirements.txt
uvicorn main:app --reload
```

## Тестирование

```bash
# Фронтенд
cd frontend
npm test

# Бэкенд
cd backend/user_service
python -m pytest

cd backend/prediction_service
python -m pytest
``` 