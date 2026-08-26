const BASE = 'https://api.helloasso.com';

let tokenCache = { access_token: null, expires_at: 0 };

async function getAccessToken() {
    if (tokenCache.access_token && Date.now() < tokenCache.expires_at - 60_000) {
        return tokenCache.access_token;
    }

    const res = await fetch(`${BASE}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: process.env.HELLOASSO_CLIENT_ID,
            client_secret: process.env.HELLOASSO_CLIENT_SECRET,
        }),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`HelloAsso auth failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    tokenCache = {
        access_token: data.access_token,
        expires_at: Date.now() + data.expires_in * 1000,
    };
    return data.access_token;
}

async function haFetch(path, options = {}) {
    const token = await getAccessToken();
    const res = await fetch(`${BASE}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });
    return res;
}

async function createBookingCheckoutIntent(booking, slot, userEmail, amountCents) {
    const slug = process.env.HELLOASSO_ORG_SLUG;
    if (!slug) throw new Error('HelloAsso non configuré');

    const backUrl = process.env.BASE_URL + '/app/member/bookings.html';

    const body = {
        totalAmount: amountCents,
        initialAmount: amountCents,
        itemName: `Cours — ${slot.location}`,
        backUrl: `${backUrl}?payment=cancel&booking_id=${booking.id}`,
        errorUrl: `${backUrl}?payment=cancel&booking_id=${booking.id}`,
        returnUrl: `${backUrl}?payment=success`,
        containsDonation: false,
        payer: { email: userEmail },
        metadata: { type: 'booking', booking_id: String(booking.id) },
    };

    const res = await haFetch(`/v5/organizations/${slug}/checkout-intents`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`HelloAsso checkout failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    return { id: String(data.id), redirectUrl: data.redirectUrl };
}

async function createTopupIntent(userId, userEmail, amountCents) {
    const slug = process.env.HELLOASSO_ORG_SLUG;
    if (!slug) throw new Error('HelloAsso non configuré');

    const backUrl = process.env.BASE_URL + '/app/member/wallet.html';

    const body = {
        totalAmount: amountCents,
        initialAmount: amountCents,
        itemName: 'Rechargement de solde ABS91',
        backUrl: `${backUrl}?topup=cancel`,
        errorUrl: `${backUrl}?topup=cancel`,
        returnUrl: `${backUrl}?topup=success`,
        containsDonation: false,
        payer: { email: userEmail },
        metadata: { type: 'topup', user_id: String(userId) },
    };

    const res = await haFetch(`/v5/organizations/${slug}/checkout-intents`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`HelloAsso topup checkout failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    return { id: String(data.id), redirectUrl: data.redirectUrl };
}

module.exports = { createCheckoutIntent: createBookingCheckoutIntent, createTopupIntent, haFetch };
