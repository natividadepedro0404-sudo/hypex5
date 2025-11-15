require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./src/controllers/auth');
const productRoutes = require('./src/controllers/products');
const orderRoutes = require('./src/controllers/orders');
const webhookRoutes = require('./src/controllers/webhook');
const usersRoutes = require('./src/controllers/users');
const couponsRoutes = require('./src/controllers/coupons');
const favoritesRoutes = require('./src/controllers/favorites');
const siteSettingsRoutes = require('./src/controllers/siteSettings');
const shippingRoutes = require('./src/controllers/shipping');
const variationsRoutes = require('./src/controllers/variations');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static frontend
app.use('/', express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/coupons', couponsRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/site-settings', siteSettingsRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/variations', variationsRoutes);

app.get('/api/ping', (req, res) => res.json({ ok: true, now: Date.now() }));

// Para Vercel, exportar o app como handler
// Para desenvolvimento local, iniciar o servidor normalmente
if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(PORT, () => {
    console.log(`Hypex server running on http://localhost:${PORT}`);
  });
}