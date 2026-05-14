const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ service: 'frontend', status: 'ok', version: process.env.npm_package_version || '1.0.0' });
});

app.get('/health', (req, res) => res.json({ status: 'healthy' }));
app.get('/ready', (req, res) => res.json({ status: 'ready' }));

app.get('/products', async (req, res) => {
  try {
    const response = await fetch(`${process.env.PRODUCT_SERVICE_URL || 'http://product-service:4000'}/products`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'product-service unavailable' });
  }
});

app.listen(PORT, () => console.log(`Frontend running on port ${PORT}`));