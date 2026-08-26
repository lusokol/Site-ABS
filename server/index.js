require('dotenv/config');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3002;

app.set('trust proxy', true);

app.use(helmet());
app.use(cors({ origin: [process.env.BASE_URL, 'https://tcg-demo.fr'].filter(Boolean) }));

app.use(express.json());

const paymentRoutes = require('./routes/payments');
app.use('/api/payments', paymentRoutes);

const authRoutes = require('./routes/auth');
const slotRoutes = require('./routes/slots');
const bookingRoutes = require('./routes/bookings');
const memberRoutes = require('./routes/members');
const adminRoutes = require('./routes/admin');
const contactRoutes = require('./routes/contact');
const articleRoutes = require('./routes/articles');
const walletRoutes = require('./routes/wallet');

app.use('/api/auth', authRoutes);
app.use('/api/slots', slotRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/wallet', walletRoutes);

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`ABS91 API démarrée sur le port ${PORT}`);
});
