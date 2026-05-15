// =============================================================
// product-service/server.js — Product Catalog Microservice
// =============================================================
//
// RESPONSIBILITY:
// This service manages the product catalog for the e-commerce
// platform. It is the source of truth for product data and
// is called by the order-service when creating new orders.
//
// PORT: 3001 (configurable via PORT env var)
//
// ENDPOINTS:
//   GET  /health          → Kubernetes liveness/readiness probe
//   GET  /metrics         → Prometheus scrape endpoint
//   GET  /products        → List all products
//   GET  /products/:id    → Get product by ID
//   POST /products        → Add a new product
//
// CALLED BY: order-service (for product validation before order creation)
// =============================================================

const express = require('express');       // Web framework
const promClient = require('prom-client'); // Prometheus metrics client

const app = express();
const PORT = process.env.PORT || 3001;  // Use env var in K8s, fallback for local dev

// =============================================================
// PROMETHEUS METRICS SETUP
// =============================================================

// Isolated registry — won't conflict with other services' metrics
const register = new promClient.Registry();

// Collect built-in Node.js metrics: memory, CPU, event loop, GC
promClient.collectDefaultMetrics({ register });

// Track how long each HTTP request takes — appears in Grafana latency panels
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],   // Latency buckets for SLA tracking
  registers: [register],
});

// =============================================================
// MIDDLEWARE
// =============================================================

app.use(express.json()); // Enable JSON body parsing for POST/PUT requests

// Latency tracking middleware — wraps all routes automatically
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer(); // Record start time
  res.on('finish', () => {
    end({ method: req.method, route: req.route?.path || req.path, status_code: res.statusCode });
  });
  next();
});

// =============================================================
// IN-MEMORY DATA STORE
// =============================================================
// Simulates a product database for demo purposes
// In production: replace with RDS (PostgreSQL) or DynamoDB
let products = [
  { id: 1, name: 'Laptop Pro X',    price: 29.99, stock: 50,  category: 'Electronics' },
  { id: 2, name: 'Wireless Mouse',  price: 89.99, stock: 200, category: 'Electronics' },
  { id: 3, name: 'USB-C Hub',       price: 14.99, stock: 150, category: 'Accessories' },
  { id: 4, name: 'Mechanical Keyboard', price: 149.99, stock: 75, category: 'Electronics' },
  { id: 5, name: 'Monitor Stand',   price: 45.99, stock: 100, category: 'Accessories' },
];
let nextProductId = 6;

// =============================================================
// HEALTH CHECK
// =============================================================
// Used by K8s liveness + readiness probes
// Returns 200 OK → pod stays running and receives traffic
// Returns non-200 → K8s restarts pod (liveness) or removes from LB (readiness)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'product-service',
    version: process.env.APP_VERSION || '1.0.0',
    uptime: process.uptime(),          // Seconds since process started
    timestamp: new Date().toISOString(),
  });
});

// =============================================================
// PROMETHEUS METRICS ENDPOINT
// =============================================================
// Prometheus scrapes this every 15s based on pod annotations:
//   prometheus.io/scrape: "true"
//   prometheus.io/port: "3001"
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// =============================================================
// PRODUCT ROUTES
// =============================================================

// GET /products — Return all products with optional category filter
// Example: GET /products?category=Electronics
app.get('/products', (req, res) => {
  const { category } = req.query;
  const result = category
    ? products.filter(p => p.category === category) // Filter by category
    : products;                                       // Return all

  res.json({
    success: true,
    count: result.length,
    products: result,
  });
});

// GET /products/:id — Fetch a single product (used by order-service)
app.get('/products/:id', (req, res) => {
  const product = products.find(p => p.id === parseInt(req.params.id));
  if (!product) {
    // 404 is handled by order-service to show "Product not found" to user
    return res.status(404).json({ success: false, error: 'Product not found' });
  }
  res.json({ success: true, product });
});

// POST /products — Add a new product to the catalog
app.post('/products', (req, res) => {
  const { name, price, stock, category } = req.body;

  // Validate all required fields are present
  if (!name || !price || !stock || !category) {
    return res.status(400).json({
      success: false,
      error: 'name, price, stock, and category are required',
    });
  }

  const product = {
    id: nextProductId++,
    name,
    price: parseFloat(price),  // Ensure numeric type
    stock: parseInt(stock),    // Ensure integer type
    category,
    createdAt: new Date().toISOString(),
  };

  products.push(product);
  res.status(201).json({ success: true, product });
});

// =============================================================
// START SERVER
// =============================================================
app.listen(PORT, () => {
  console.log(`Product service running on port ${PORT}`);
  console.log(`Metrics available at http://localhost:${PORT}/metrics`);
  console.log(`Health check at http://localhost:${PORT}/health`);
});
