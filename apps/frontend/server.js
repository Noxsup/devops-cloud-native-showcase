/**
 * server.js — Frontend Service
 *
 * A lightweight Express.js HTTP server that acts as the user-facing frontend.
 * It proxies API calls to the product-service and order-service microservices.
 *
 * Key features:
 *   - Exposes REST endpoints on port 3000
 *   - Integrates prom-client to expose /metrics for Prometheus scraping
 *   - Tracks per-route HTTP request duration via a Histogram metric
 *   - Health check endpoint at /health for Kubernetes liveness/readiness probes
 */

// Express: minimal web framework for Node.js
const express = require('express');

// prom-client: official Prometheus client library for Node.js
// Exposes default Node.js metrics (CPU, memory, event loop lag, etc.)
const promClient = require('prom-client');

// axios: HTTP client for making requests to downstream microservices
const axios = require('axios');

const app = express();

// PORT: read from environment variable (set in K8s deployment.yaml)
// Falls back to 3000 for local development
const PORT = process.env.PORT || 3000;

// Downstream service URLs injected via environment variables.
// In Kubernetes, these resolve to ClusterIP service DNS names.
// e.g. PRODUCT_SERVICE_URL = http://product-service:4000
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3001';
const ORDER_SERVICE_URL   = process.env.ORDER_SERVICE_URL   || 'http://localhost:3002';

// =============================================================
// Prometheus Metrics Setup
// =============================================================

// Create a custom metrics registry (keeps our metrics isolated)
const register = new promClient.Registry();

// Collect default Node.js runtime metrics:
// process_cpu_seconds_total, nodejs_heap_size_total_bytes, etc.
promClient.collectDefaultMetrics({ register });

// Custom histogram: measures how long each HTTP request takes.
// Buckets (in seconds): 0.1s, 0.5s, 1s, 2s, 5s
// Labels: HTTP method, route path, response status code
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register],
});

// Parse incoming JSON request bodies
app.use(express.json());

// =============================================================
// Middleware: Request Duration Tracking
// Wraps every request and records its duration in the histogram.
// =============================================================
app.use((req, res, next) => {
  // Start the timer when the request arrives
  const end = httpRequestDuration.startTimer();

  // When the response finishes, stop the timer and record labels
  res.on('finish', () => {
    end({
      method: req.method,
      route:  req.route ? req.route.path : req.path,
      status_code: res.statusCode,
    });
  });
  next();
});

// =============================================================
// Routes
// =============================================================

/**
 * GET /
 * Home route — confirms the frontend service is running.
 */
app.get('/', (req, res) => {
  res.json({
    service: 'frontend',
    status: 'running',
    version: process.env.APP_VERSION || '1.0.0',
  });
});

/**
 * GET /products
 * Proxies the request to the product-service and returns the response.
 * In production, product-service URL resolves via K8s DNS.
 */
app.get('/products', async (req, res) => {
  try {
    const response = await axios.get(`${PRODUCT_SERVICE_URL}/products`);
    res.json(response.data);
  } catch (err) {
    // Log the error and return a 502 Bad Gateway
    console.error('Error reaching product-service:', err.message);
    res.status(502).json({ error: 'product-service unavailable' });
  }
});

/**
 * GET /orders
 * Proxies the request to the order-service and returns the response.
 */
app.get('/orders', async (req, res) => {
  try {
    const response = await axios.get(`${ORDER_SERVICE_URL}/orders`);
    res.json(response.data);
  } catch (err) {
    console.error('Error reaching order-service:', err.message);
    res.status(502).json({ error: 'order-service unavailable' });
  }
});

/**
 * GET /health
 * Kubernetes liveness and readiness probe endpoint.
 * Returns 200 OK when the service is healthy.
 * K8s will restart the pod if this returns non-2xx.
 */
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

/**
 * GET /metrics
 * Prometheus scrape endpoint.
 * Returns all registered metrics in the Prometheus text format.
 * Grafana dashboards are built from data scraped here.
 */
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// =============================================================
// Start the server
// =============================================================
app.listen(PORT, () => {
  console.log(`[frontend] Listening on port ${PORT}`);
  console.log(`[frontend] Metrics available at http://localhost:${PORT}/metrics`);
});
