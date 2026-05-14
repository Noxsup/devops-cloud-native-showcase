const express = require('express');
const promClient = require('prom-client');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3001';
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:3002';

// Prometheus metrics
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register],
});

app.use(express.json());

// Middleware to track request duration
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.route?.path || req.path, status_code: res.statusCode });
  });
  next();
});

app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'frontend' }));
app.get('/ready', (req, res) => res.json({ status: 'ready', service: 'frontend' }));
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.get('/', (req, res) => {
  res.json({
    service: 'frontend',
    version: process.env.APP_VERSION || '1.0.0',
    endpoints: [
      'GET /products - List all products',
      'GET /orders   - List all orders',
    ],
  });
});

app.get('/products', async (req, res) => {
  try {
    const { data } = await axios.get(`${PRODUCT_SERVICE_URL}/products`);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Product service unavailable', detail: err.message });
  }
});

app.get('/orders', async (req, res) => {
  try {
    const { data } = await axios.get(`${ORDER_SERVICE_URL}/orders`);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Order service unavailable', detail: err.message });
  }
});

app.listen(PORT, () => console.log(`Frontend running on port ${PORT}`));
