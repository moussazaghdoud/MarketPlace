const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/connection');
const { adminAuth } = require('../middleware/auth');
const stripeService = require('../services/stripe-service');

const router = express.Router();
router.use(adminAuth);

// GET /api/admin/products
router.get('/', (req, res) => {
    const db = getDb();
    const products = db.prepare('SELECT * FROM products ORDER BY createdAt DESC').all();
    res.json(products.map(p => ({
        ...p,
        plans: JSON.parse(p.plans || '{}'),
        benefits: JSON.parse(p.benefits || '[]'),
        gallery: JSON.parse(p.gallery || '[]')
    })));
});

// GET /api/admin/products/:id
router.get('/:id', (req, res) => {
    const db = getDb();
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({
        ...product,
        plans: JSON.parse(product.plans || '{}'),
        benefits: JSON.parse(product.benefits || '[]'),
        gallery: JSON.parse(product.gallery || '[]')
    });
});

// POST /api/admin/products
router.post('/', (req, res) => {
    const { name, slug, shortDescription, fullDescription, benefits, gallery, plans } = req.body;
    if (!name || !slug || !plans) return res.status(400).json({ error: 'Name, slug and plans required' });

    const db = getDb();
    const existing = db.prepare('SELECT id FROM products WHERE slug = ?').get(slug);
    if (existing) return res.status(409).json({ error: 'Slug already exists' });

    const id = uuidv4();
    db.prepare(`
        INSERT INTO products (id, name, slug, shortDescription, fullDescription, benefits, gallery, plans)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, slug, shortDescription || '', fullDescription || '', JSON.stringify(benefits || []), JSON.stringify(gallery || []), JSON.stringify(plans));
    res.json({ id });
});

// PUT /api/admin/products/:id
router.put('/:id', async (req, res) => {
    try {
        const { name, slug, shortDescription, fullDescription, benefits, gallery, plans, isActive } = req.body;
        const db = getDb();
        db.prepare(`
            UPDATE products SET name = ?, slug = ?, shortDescription = ?, fullDescription = ?, benefits = ?, gallery = ?, plans = ?, isActive = ?, updatedAt = datetime(?)
            WHERE id = ?
        `).run(name, slug, shortDescription || '', fullDescription || '', JSON.stringify(benefits || []), JSON.stringify(gallery || []), JSON.stringify(plans), isActive !== undefined ? isActive : 1, new Date().toISOString(), req.params.id);

        // Auto-sync Stripe prices for each paid plan
        if (stripeService.isConfigured() && plans && typeof plans === 'object') {
            let stripeProductId = null;
            let synced = false;
            for (const [planKey, plan] of Object.entries(plans)) {
                if (!plan.pricePerUser || plan.pricePerUser <= 0) continue;
                // Ensure Stripe product exists (once per product)
                if (!stripeProductId) {
                    stripeProductId = await stripeService.ensureProduct(name, slug);
                }
                const unitAmount = Math.round(plan.pricePerUser * 100);
                const newPriceId = await stripeService.ensurePrice(
                    stripeProductId, unitAmount, 'eur', planKey, plan.stripePriceId
                );
                if (newPriceId !== plan.stripePriceId) {
                    plan.stripePriceId = newPriceId;
                    synced = true;
                }
            }
            // Re-save plans with updated stripePriceIds
            if (synced) {
                db.prepare('UPDATE products SET plans = ? WHERE id = ?')
                    .run(JSON.stringify(plans), req.params.id);
                console.log(`[Stripe Sync] Updated price IDs for product "${name}"`);
            }
        }

        // Sync prices to content_store so Offers page content translations stay consistent
        if (slug === 'rainbow' && plans && typeof plans === 'object') {
            try {
                const allLangs = db.prepare('SELECT lang, data FROM content_store').all();
                for (const row of allLangs) {
                    const content = JSON.parse(row.data);
                    if (content.pricing && content.pricing.plans) {
                        let changed = false;
                        for (const cp of content.pricing.plans) {
                            const key = cp.name.toLowerCase().replace(/\s+/g, '-');
                            if (plans[key]) {
                                if (cp.pricePerUser !== plans[key].pricePerUser) {
                                    cp.pricePerUser = plans[key].pricePerUser;
                                    cp.price = plans[key].pricePerUser > 0 ? plans[key].pricePerUser.toFixed(2) : cp.price;
                                    changed = true;
                                }
                            }
                        }
                        if (changed) {
                            db.prepare('UPDATE content_store SET data = ?, updatedAt = datetime(?) WHERE lang = ?')
                                .run(JSON.stringify(content, null, 2), new Date().toISOString(), row.lang);
                        }
                    }
                }
                console.log(`[Product Sync] Synced prices to content_store for "${name}"`);
            } catch (syncErr) {
                console.error('[Product Sync] Content store sync failed:', syncErr.message);
            }
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[Admin Products] PUT error:', err);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// DELETE /api/admin/products/:id
router.delete('/:id', (req, res) => {
    const db = getDb();
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

module.exports = router;
