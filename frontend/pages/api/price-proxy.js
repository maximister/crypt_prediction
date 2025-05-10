import { createProxyMiddleware } from 'http-proxy-middleware';

// Создаем проксирование для api/price запросов
export default function handler(req, res) {
  // Для CORS preflight запросов
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Выводим информацию о запросе для отладки
  console.log('Price-proxy request path:', req.url);

  const target = 'http://localhost:8001';
  
  const proxy = createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: (path) => {
      // Получаем путь после /api/price-proxy и добавляем к нему /api
      const newPath = path.replace(/^\/api\/price-proxy/, '/api');
      console.log('Rewritten path:', newPath);
      return newPath;
    },
    onError: (err, req, res) => {
      console.error('Price API Proxy Error:', err);
      res.status(500).json({ error: 'Proxy error' });
    }
  });

  // Передаем запрос и ответ через прокси
  return proxy(req, res);
}

// Отключаем парсинг тела запроса для сохранения совместимости
export const config = {
  api: {
    bodyParser: false,
  },
}; 