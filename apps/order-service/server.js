// =============================================================
// order-service/server.js — Order Management Microservice
// =============================================================
//
// RESPONSIBILITY:
// This service handles all order operations for the e-commerce
// platform. It communicates with the product-service to validate
// products before creating orders.
//
// PORT: 3002 (configurable via PORT env var)
//
// ENDPOINTS:
//   GET  /health        → Kubernetes liveness/readiness probe
//   GET  /metrics       → Prometheus scrape endpoint
//   GET  /orders        → List all orders
//   POST /orders        → Create a new order
//   GET  /orders/:id    → Get order by ID
//
// SERVICE COMMUNICATION:
//   order-service → product-service (HTTP via K8s internal DNS)
//   PRODUCT_SERVICE_URL = http://product-service.devops-prod.svc.cluster.local:3001
// =============================================================

const express = require('express');       // Web framework
const promClient = require('prom-client'); // Prometheus metrics client
const axios = require('axios');           // HTTP client for inter-service calls

const app = express();
const PORT = process.env.PORT || 3002;  // Use env var in K8s, fallback for local dev

// Product service URL — injected as env var in Kubernetes deployment
// In K8s: http://<service-name>.<namespace>.svc.cluster.local:<port>
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3001';

// =============================================================
// PROMETHEUS METRICS SETUP
// =============================================================

// Create a custom metrics registry (keeps our metrics isolated)
const register = new promClient.Registry();

// Collect default Node.js metrics (event loop lag, memory, GC, etc.)
promClient.collectDefaultMetrics({ register });

// Custom histogram to track HTTP request duration
// This powers the Grafana "Request Latency" dashboard panels
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'], // Dimensions for filtering
  buckets: [0.1, 0.5, 1, 2, 5],                  // SLA buckets in seconds
  registers: [register],
});

// Counter to track total orders created (business metric)
const ordersCreatedTotal = new promClient.Counter({
  name: 'orders_created_total',
  help: 'Total number of orders created',
  registers: [register],
});

// =============================================================
// MIDDLEWARE
// =============================================================

app.use(express.json()); // Parse JSON request bodies

// Request timing middleware — wraps every request for latency tracking
// This runs BEFORE route handlers so it measures total request time
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer(); // Start the clock
  res.on('finish', () => {
    // Record duration with labels when response is sent
    end({
      method: req.method,
      route: req.route ? req.route.path : req.path,
      status_code: res.statusCode,
    });
  });
  next(); // Pass to next middleware/route handler
});

// =============================================================
// IN-MEMORY DATA STORE
// =============================================================
// NOTE: In production, replace with PostgreSQL/DynamoDB
// This is intentionally simple for the showcase demo
let orders = [
  { id: 1, productId: 1, quantity: 2, status: 'completed', total: 59.98 },
  { id: 2, productId: 2, quantity: 1, status: 'pending',   total: 89.99 },
  { id: 3, productId: 3, quantity: 3, status: 'processing',total: 44.97 },
];
let nextOrderId = 4;

// =============================================================
// HEALTH CHECK ENDPOINT
// =============================================================
// Kubernetes uses this for:
//   livenessProbe  → restart pod if unhealthy
//   readinessProbe → stop sending traffic if not ready
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'order-service',
    version: process.env.APP_VERSION || '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// =============================================================
// PROMETHEUS METRICS ENDPOINT
// =============================================================
// Prometheus scrapes this URL every 15s (configured via annotations)
// Annotation on K8s pod: prometheus.io/scrape: "true"
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics()); // Serialize all metrics to text format
});

// =============================================================
// ORDER ROUTES
// =============================================================

// GET /orders — Return all orders
app.get('/orders', (req, res) => {
  res.json({
    success: true,
    count: orders.length,
    orders,
  });
});

// GET /orders/:id — Return a specific order by ID
app.get('/orders/:id', (req, res) => {
  const order = orders.find(o => o.id === parseInt(req.params.id));
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }
  res.json({ success: true, order });
});

// POST /orders — Create a new order
// Calls product-service to validate the product exists first
app.post('/orders', async (req, res) => {
  const { productId, quantity } = req.body;

  // Validate required fields
  if (!productId || !quantity) {
    return res.status(400).json({
      success: false,
      error: 'productId and quantity are required',
    });
  }

  try {
    // Inter-service call: verify the product exists in product-service
    // In K8s, this resolves via internal DNS, no external network hop
    const productRes = await axios.get(`${PRODUCT_SERVICE_URL}/products/${productId}`);
    const product = productRes.data.product;

    // Build new order
    const order = {
      id: nextOrderId++,
      productId,
      quantity,
      status: 'pending',
      total: product.price * quantity,
      productName: product.name,
      createdAt: new Date().toISOString(),
    };

    orders.push(order);
    ordersCreatedTotal.inc(); // Increment Prometheus counter

    res.status(201).json({ success: true, order });
  } catch (err) {
    // If product-service is down or product not found
    if (err.response && err.response.status === 404) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to create order',
      details: err.message,
    });
  }
});

// =============================================================
// START SERVER
// =============================================================
app.listen(PORT, () => {
  console.log(`Order service running on port ${PORT}`);
  console.log(`Product service URL: ${PRODUCT_SERVICE_URL}`);
  console.log(`Metrics available at http://localhost:${PORT}/metrics`);
});
