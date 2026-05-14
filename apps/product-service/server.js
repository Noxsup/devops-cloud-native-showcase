const express = require('express');
const promClient = require('prom-client');

const app = express();
const PORT = process.env.PORT || 3001;

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

// Sample in-memory data
const products = [
  { id: 1, name: 'Cloud T-Shirt', price: 29.99, category: 'apparel', stock: 100 },
  { id: 2, name: 'DevOps Mug',    price: 14.99, category: 'kitchen',  stock: 50  },
  { id: 3, name: 'K8s Sticker',   price: 4.99,  category: 'misc',     stock: 200 },
];

app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'product-service' }));
app.get('/ready',  (req, res) => res.json({ status: 'ready',   service: 'product-service' }));
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.get('/products', (req, res) => res.json({ products, count: products.length }));

app.get('/products/:id', (req, res) => {
  const product = products.find(p => p.id === parseInt(req.params.id));
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

app.post('/products', (req, res) => {
  const { name, price, category, stock } = req.body;
  if (!name || !price) return res.status(400).json({ error: 'name and price are required' });
  const product = { id: products.length + 1, name, price, category: category || 'misc', stock: stock || 0 };
  products.push(product);
  res.status(201).json(product);
});

app.listen(PORT, () => console.log(`Product service running on port ${PORT}`));
