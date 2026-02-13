// Salesforce REST API integration (Client Credentials OAuth flow)

const SF_LOGIN_URL = process.env.SF_LOGIN_URL || 'https://login.salesforce.com';
const SF_CLIENT_ID = process.env.SF_CLIENT_ID;
const SF_CLIENT_SECRET = process.env.SF_CLIENT_SECRET;

let cachedToken = null;
let tokenExpiresAt = 0;

function isConfigured() {
    return !!(SF_CLIENT_ID && SF_CLIENT_SECRET);
}

async function authenticate() {
    if (cachedToken && Date.now() < tokenExpiresAt) {
        return cachedToken;
    }

    const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: SF_CLIENT_ID,
        client_secret: SF_CLIENT_SECRET
    });

    const res = await fetch(`${SF_LOGIN_URL}/services/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Salesforce auth failed (${res.status}): ${err}`);
    }

    const data = await res.json();
    cachedToken = {
        accessToken: data.access_token,
        instanceUrl: data.instance_url
    };
    // Cache for 55 minutes (tokens last ~60 min)
    tokenExpiresAt = Date.now() + 55 * 60 * 1000;
    return cachedToken;
}

function clearTokenCache() {
    cachedToken = null;
    tokenExpiresAt = 0;
}

async function sfRequest(method, path, body, retried = false) {
    const { accessToken, instanceUrl } = await authenticate();

    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`${instanceUrl}/services/data/v59.0${path}`, options);

    // Auto-retry once on 401 (expired token)
    if (res.status === 401 && !retried) {
        clearTokenCache();
        return sfRequest(method, path, body, true);
    }

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Salesforce API ${method} ${path} failed (${res.status}): ${err}`);
    }

    const text = await res.text();
    return text ? JSON.parse(text) : null;
}

async function createLead(data) {
    if (!isConfigured()) {
        console.log('[Salesforce] Not configured, skipping lead creation');
        return { success: false, skipped: true };
    }

    const lead = {
        FirstName: data.firstName || '',
        LastName: data.lastName || 'Unknown',
        Email: data.email || '',
        Company: data.company || '[Not Provided]',
        LeadSource: 'Rainbow Portal'
    };

    const result = await sfRequest('POST', '/sobjects/Lead', lead);
    console.log(`[Salesforce] Lead created: ${result.id}`);
    return { success: true, leadId: result.id };
}

async function updateLead(leadId, data) {
    console.log(`[Salesforce] updateLead ${leadId}: not yet implemented`);
    return { success: true, stub: true };
}

async function convertLeadToOpportunity(leadId) {
    console.log(`[Salesforce] convertLeadToOpportunity ${leadId}: not yet implemented`);
    return { success: true, stub: true };
}

async function logActivity(leadId, activity) {
    console.log(`[Salesforce] logActivity for ${leadId}: not yet implemented`);
    return { success: true, stub: true };
}

module.exports = { isConfigured, createLead, updateLead, convertLeadToOpportunity, logActivity };
