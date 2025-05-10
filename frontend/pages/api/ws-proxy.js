import { createProxyMiddleware } from 'http-proxy-middleware';

// Создаем проксирование WebSocket
export default function handler(req, res) {
  // Не запускаем прокси для опций (чтобы избежать ошибок с CORS preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const target = 'http://localhost:8001';
  
  const proxy = createProxyMiddleware({
    target,
    changeOrigin: true,
    ws: true, // включаем поддержку WebSocket
    pathRewrite: {
      '^/api/ws-proxy': '/ws/updates', // переадресовываем путь
    },
    onError: (err, req, res) => {
      console.error('WebSocket Proxy Error:', err);
      res.status(500).json({ error: 'Proxy error' });
    }
  });

  // Передаем запрос и ответ через прокси
  return proxy(req, res);
}

// Отключаем парсинг тела запроса, так как это может вызвать проблемы с WebSocket
export const config = {
  api: {
    bodyParser: false,
  },
}; 