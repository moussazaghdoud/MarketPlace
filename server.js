require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 3000;
const CONTENT_PATH = path.join(__dirname, 'data', 'content.json');

// Plan key → Stripe Price ID mapping
// Replace these with real Price IDs from your Stripe Dashboard
const PLAN_PRICES = {
    'business':   process.env.STRIPE_PRICE_BUSINESS   || 'price_REPLACE_ME_BUSINESS',
    'enterprise': process.env.STRIPE_PRICE_ENTERPRISE || 'price_REPLACE_ME_ENTERPRISE'
};

// Multer storage — saves to images/ with original filename
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'images'));
    },
    filename: function (req, file, cb) {
        // Keep original extension, sanitise name
        const ext = path.extname(file.originalname);
        const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
        cb(null, base + '-' + Date.now() + ext);
    }
});
const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static(__dirname, { index: false }));

// Public marketplace
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Admin dashboard
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Get content
app.get('/api/content', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(CONTENT_PATH, 'utf8'));
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to read content' });
    }
});

// Save content
app.post('/api/content', (req, res) => {
    try {
        const data = JSON.stringify(req.body, null, 2);
        fs.writeFileSync(CONTENT_PATH, data, 'utf8');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save content' });
    }
});

// Upload image
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    const relativePath = 'images/' + req.file.filename;
    res.json({ success: true, path: relativePath });
});

// --- Stripe endpoints ---

// Return publishable key to frontend (avoids hardcoding in JS)
app.get('/api/stripe-key', (req, res) => {
    res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
});

// Create a subscription (called when user submits payment form)
app.post('/api/create-subscription', async (req, res) => {
    const { email, planKey, licenseCount } = req.body;

    if (!email || !planKey || !licenseCount) {
        return res.status(400).json({ error: 'Missing required fields: email, planKey, licenseCount' });
    }

    const priceId = PLAN_PRICES[planKey];
    if (!priceId || priceId.startsWith('price_REPLACE_ME')) {
        return res.status(400).json({ error: 'Invalid plan or Stripe Price ID not configured. Update PLAN_PRICES in server.js or .env.' });
    }

    try {
        // 1. Create (or reuse) a Stripe Customer
        const customer = await stripe.customers.create({ email });

        // 2. Create the subscription (incomplete — awaiting payment confirmation)
        const subscription = await stripe.subscriptions.create({
            customer: customer.id,
            items: [{ price: priceId, quantity: licenseCount }],
            payment_behavior: 'default_incomplete',
            payment_settings: { save_default_payment_method: 'on_subscription' },
            expand: ['latest_invoice.payment_intent']
        });

        res.json({
            subscriptionId: subscription.id,
            clientSecret: subscription.latest_invoice.payment_intent.client_secret
        });
    } catch (err) {
        console.error('Stripe error:', err.message);
        res.status(400).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Rainbow Portal running at http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin`);
});
