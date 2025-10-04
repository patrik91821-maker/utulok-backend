require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const sheltersRoutes = require('./routes/shelters');
const dogsRoutes = require('./routes/dogs');
const paymentsRoutes = require('./routes/payments');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 4000;

// Serve uploads statically (for local test). In production use S3 and return absolute URLs.
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// For /payments/webhook we need raw body, that route uses express.raw
app.use(cors());
// parse JSON for all other routes
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/auth', authRoutes);
app.use('/shelters', sheltersRoutes);
app.use('/dogs', dogsRoutes);
app.use('/payments', paymentsRoutes);
app.use('/admin', adminRoutes);

app.get('/', (req, res) => res.json({ ok: true, name: 'utulok-backend' }));

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
