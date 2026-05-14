const express = require('express');
const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

const products = [
  { id: 1, name: 'Laptop', price: 999.99, stock: 50 },
  { id: 2, name: 'Mouse', price: 29.99, stock: 200 },
  { id: 3, name: 'Keyboard', price: 79.99, stock: 150 },
];

app.get('/health', (req, res) => res.json({ status: 'healthy' }));
app.get('/products', (req, res) => res.json(products));
app.get('/products/:id', (req, res) => {
  const product = products.find(p => p.id === parseInt(req.params.id));
  if (!product) return res.status(404).json({ error: 'Not found' });
  res.json(product);
});

app.listen(PORT, () => console.log(`Product service running on port ${PORT}`));