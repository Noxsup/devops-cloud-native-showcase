const express = require('express');
const promClient = require('prom-client');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3002;
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3001';

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

app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.route?.path || req.path, status_code: res.statusCode });
  });
  next();
});

const orders = [
  { id: 1, productId: 1, quantity: 2, status: 'delivered', total: 59.98 },
  { id: 2, productId: 3, quantity: 5, status: 'processing', total: 24.95 },
];

app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'order-service' }));
app.get('/ready',  (req, res) => res.json({ status: 'ready',   service: 'order-service' }));
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.get('/orders', (req, res) => res.json({ orders, count: orders.length }));

app.get('/orders/:id', (req, res) => {
  const order = orders.find(o => o.id === parseInt(req.params.id));
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

app.post('/orders', async (req, res) => {
  const { productId, quantity } = req.body;
  if (!productId || !quantity) return res.status(400).json({ error: 'productId and quantity are required' });
  try {
    const { data: product } = await axios.get(`${PRODUCT_SERVICE_URL}/products/${productId}`);
    const total = product.price * quantity;
    const order = { id: orders.length + 1, productId, quantity, status: 'pending', total };
    orders.push(order);
    res.status(201).json(order);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch product', detail: err.message });
  }
});

app.listen(PORT, () => console.log(`Order service running on port ${PORT}`));
