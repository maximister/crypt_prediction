import { createProxyMiddleware } from 'http-proxy-middleware';

// Создаем проксирование для user-api запросов
export default function handler(req, res) {
  // Для CORS preflight запросов
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Выводим информацию о запросе для отладки
  console.log('User-proxy request path:', req.url);

  const target = 'http://localhost:8000';
  
  const proxy = createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: (path) => {
      // Удаляем префикс /api/user-proxy
      const newPath = path.replace(/^\/api\/user-proxy/, '');
      console.log('Rewritten path:', newPath);
      return newPath;
    },
    onError: (err, req, res) => {
      console.error('User API Proxy Error:', err);
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