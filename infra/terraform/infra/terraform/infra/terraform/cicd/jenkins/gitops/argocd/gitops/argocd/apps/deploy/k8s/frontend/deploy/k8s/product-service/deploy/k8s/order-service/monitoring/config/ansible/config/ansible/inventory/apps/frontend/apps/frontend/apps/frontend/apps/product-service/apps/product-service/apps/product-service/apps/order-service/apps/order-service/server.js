const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

let orders = [];
let nextId = 1;

app.get('/health', (req, res) => res.json({ status: 'healthy' }));

app.get('/orders', (req, res) => res.json(orders));

app.post('/orders', async (req, res) => {
  const { productId, quantity } = req.body;
  if (!productId || !quantity) {
    return res.status(400).json({ error: 'productId and quantity required' });
  }
  try {
    const pUrl = process.env.PRODUCT_SERVICE_URL || 'http://product-service:4000';
    const pRes = await fetch(`${pUrl}/products/${productId}`);
    if (!pRes.ok) return res.status(404).json({ error: 'Product not found' });
    const product = await pRes.json();
    const order = { id: nextId++, productId, productName: product.name, quantity, total: product.price * quantity, status: 'confirmed', createdAt: new Date().toISOString() };
    orders.push(order);
    res.status(201).json(order);
  } catch (err) {
    res.status(502).json({ error: 'product-service unavailable' });
  }
});

app.listen(PORT, () => console.log(`Order service running on port ${PORT}`));