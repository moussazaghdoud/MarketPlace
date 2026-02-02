// Rainbow Portal — Main JS

document.addEventListener('DOMContentLoaded', function () {
    updatePrices();
});

// Mobile menu
var mobileMenuBtn = document.getElementById('mobile-menu-btn');
var mobileMenu = document.getElementById('mobile-menu');

mobileMenuBtn.addEventListener('click', function () {
    mobileMenu.classList.toggle('hidden');
});
mobileMenu.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () { mobileMenu.classList.add('hidden'); });
});

// Plans
var PLANS = {
    business: { name: 'Business', pricePerUser: 9.99, stripePriceId: 'price_REPLACE_ME_BUSINESS' },
    enterprise: { name: 'Enterprise', pricePerUser: 19.99, stripePriceId: 'price_REPLACE_ME_ENTERPRISE' }
};

function getLicenseCount() {
    var input = document.getElementById('license-count');
    var val = parseInt(input.value, 10);
    if (isNaN(val) || val < 1) val = 1;
    if (val > 1000) val = 1000;
    input.value = val;
    return val;
}

function adjustLicenses(delta) {
    var input = document.getElementById('license-count');
    var val = parseInt(input.value, 10) + delta;
    if (val < 1) val = 1;
    if (val > 1000) val = 1000;
    input.value = val;
    updatePrices();
}

function updatePrices() {
    var count = getLicenseCount();
    var bt = document.getElementById('business-total');
    var et = document.getElementById('enterprise-total');
    if (bt) bt.textContent = '\u20AC' + (PLANS.business.pricePerUser * count).toFixed(2) + '/mo total';
    if (et) et.textContent = '\u20AC' + (PLANS.enterprise.pricePerUser * count).toFixed(2) + '/mo total';
}

// FAQ
document.querySelectorAll('.faq-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
        var item = btn.closest('.faq-item');
        var wasActive = item.classList.contains('active');
        document.querySelectorAll('.faq-item').forEach(function (el) { el.classList.remove('active'); });
        if (!wasActive) item.classList.add('active');
    });
});

// Checkout modal
var selectedPlan = null;

function checkout(planKey) {
    selectedPlan = PLANS[planKey];
    if (!selectedPlan) return;
    var count = getLicenseCount();
    var total = (selectedPlan.pricePerUser * count).toFixed(2);

    document.getElementById('checkout-plan-name').textContent = selectedPlan.name;
    document.getElementById('checkout-licenses').textContent = count + ' user' + (count > 1 ? 's' : '');
    document.getElementById('checkout-unit-price').textContent = '\u20AC' + selectedPlan.pricePerUser.toFixed(2) + '/mo';
    document.getElementById('checkout-total').textContent = '\u20AC' + total + '/mo';
    document.getElementById('checkout-summary').textContent = selectedPlan.name + ' \u2014 ' + count + ' license' + (count > 1 ? 's' : '');

    var modal = document.getElementById('checkout-modal');
    modal.classList.remove('hidden');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeCheckout() {
    var modal = document.getElementById('checkout-modal');
    modal.classList.add('hidden');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeCheckout(); });

// Payment handler (demo mode — replace with real Stripe Checkout in production)
function handlePayment() {
    var email = document.getElementById('checkout-email').value.trim();
    if (!email || !email.includes('@')) {
        showCardError('Please enter a valid email address.');
        return;
    }
    var count = getLicenseCount();
    var btn = document.getElementById('checkout-submit');

    btn.disabled = true;
    btn.textContent = 'Processing\u2026';

    // --- PRODUCTION: Uncomment below and add your Stripe key + server endpoint ---
    // fetch('/api/create-checkout-session', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ priceId: selectedPlan.stripePriceId, quantity: count, customerEmail: email })
    // })
    // .then(r => r.json())
    // .then(data => Stripe('pk_test_YOUR_KEY').redirectToCheckout({ sessionId: data.sessionId }))
    // .catch(() => { showCardError('Payment failed. Please try again.'); resetBtn(); });

    // --- DEMO ---
    setTimeout(function () {
        btn.textContent = 'Confirmed!';
        btn.classList.remove('bg-brand-500', 'hover:bg-brand-600');
        btn.classList.add('bg-green-500');
        setTimeout(function () {
            alert('Demo: Subscription confirmed!\n\nPlan: ' + selectedPlan.name + '\nLicenses: ' + count + '\nEmail: ' + email + '\nTotal: \u20AC' + (selectedPlan.pricePerUser * count).toFixed(2) + '/mo\n\nIn production this redirects to Stripe Checkout.');
            resetBtn();
            closeCheckout();
        }, 1200);
    }, 1500);
}

function resetBtn() {
    var btn = document.getElementById('checkout-submit');
    btn.disabled = false;
    btn.textContent = 'Subscribe & Pay';
    btn.classList.remove('bg-green-500');
    btn.classList.add('bg-brand-500', 'hover:bg-brand-600');
}

function showCardError(msg) {
    var el = document.getElementById('card-errors');
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(function () { el.classList.add('hidden'); }, 4000);
}

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
        var t = document.querySelector(this.getAttribute('href'));
        if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); }
    });
});
