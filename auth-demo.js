const output = document.getElementById('output');
const tokenView = document.getElementById('tokenView');
const API_BASE_URL = 'https://backendutn-tpf.onrender.com';

let lastVerifyUrl = '';
let lastResetUrl = '';

function resolveApiUrl(path = '') {
    const raw = String(path || '');
    if (/^https?:\/\//i.test(raw)) {
        return raw;
    }

    const base = String(API_BASE_URL || '').replace(/\/+$/, '');
    const normalizedPath = raw.startsWith('/') ? raw : `/${raw}`;
    return `${base}${normalizedPath}`;
}

function getToken() {
    return localStorage.getItem('accessToken') || '';
}

function setToken(token) {
    if (token) {
        localStorage.setItem('accessToken', token);
    } else {
        localStorage.removeItem('accessToken');
    }
    tokenView.textContent = token || '(sin token)';
}

function logLine(label, payload) {
    const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
    output.value += `[${new Date().toISOString()}] ${label}\n${serialized}\n\n`;
    output.scrollTop = output.scrollHeight;
}

async function apiCall(url, options = {}, useAuth = false) {
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };

    if (useAuth) {
        const token = getToken();
        if (!token) {
            throw new Error('No hay token guardado. Primero haga login.');
        }
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(resolveApiUrl(url), { ...options, headers });
    const text = await response.text();
    let parsed;

    try {
        parsed = text ? JSON.parse(text) : null;
    } catch (_error) {
        parsed = text;
    }

    if (!response.ok) {
        throw new Error(JSON.stringify(parsed));
    }

    return parsed;
}

document.getElementById('btnRegister').addEventListener('click', async () => {
    try {
        const body = {
            nombre: document.getElementById('regNombre').value,
            email: document.getElementById('regEmail').value,
            password: document.getElementById('regPassword').value
        };

        const result = await apiCall('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify(body)
        });

        lastVerifyUrl = result?.data?.verifyUrlDev || '';
        document.getElementById('loginEmail').value = body.email;
        document.getElementById('forgotEmail').value = body.email;

        logLine('REGISTER_OK', result);
    } catch (error) {
        logLine('REGISTER_ERROR', String(error));
    }
});

document.getElementById('btnVerify').addEventListener('click', async () => {
    try {
        if (!lastVerifyUrl) throw new Error('No hay verifyUrl guardada. Ejecute Register primero.');
        const backendOrigin = new URL(API_BASE_URL).origin;
        const parsed = new URL(lastVerifyUrl, backendOrigin);

        if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
            const backend = new URL(API_BASE_URL);
            parsed.protocol = backend.protocol;
            parsed.host = backend.host;
        }

        const url = parsed.toString();
        const result = await apiCall(url, { method: 'GET' });
        logLine('VERIFY_OK', result);
    } catch (error) {
        logLine('VERIFY_ERROR', String(error));
    }
});

document.getElementById('btnLogin').addEventListener('click', async () => {
    try {
        const body = {
            email: document.getElementById('loginEmail').value,
            password: document.getElementById('loginPassword').value
        };

        const result = await apiCall('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify(body)
        });

        setToken(result?.data?.accessToken || '');
        logLine('LOGIN_OK', result);
    } catch (error) {
        logLine('LOGIN_ERROR', String(error));
    }
});

document.getElementById('btnMe').addEventListener('click', async () => {
    try {
        const result = await apiCall('/api/auth/me', { method: 'GET' }, true);
        logLine('ME_OK', result);
    } catch (error) {
        logLine('ME_ERROR', String(error));
    }
});

document.getElementById('btnForgot').addEventListener('click', async () => {
    try {
        const body = { email: document.getElementById('forgotEmail').value };
        const result = await apiCall('/api/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify(body)
        });
        lastResetUrl = result?.data?.resetUrlDev || '';
        logLine('FORGOT_OK', result);
    } catch (error) {
        logLine('FORGOT_ERROR', String(error));
    }
});

document.getElementById('btnReset').addEventListener('click', async () => {
    try {
        if (!lastResetUrl) throw new Error('No hay resetUrl guardada. Ejecute Forgot primero.');

        const match = lastResetUrl.match(/resetToken=([^&]+)/);
        if (!match) throw new Error('No se pudo obtener resetToken de la URL.');

        const body = {
            token: decodeURIComponent(match[1]),
            newPassword: document.getElementById('resetPassword').value
        };

        const result = await apiCall('/api/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify(body)
        });

        logLine('RESET_OK', result);
    } catch (error) {
        logLine('RESET_ERROR', String(error));
    }
});

document.getElementById('btnSecureCall').addEventListener('click', async () => {
    try {
        const method = document.getElementById('secureMethod').value;
        const endpoint = document.getElementById('secureEndpoint').value;
        const bodyRaw = document.getElementById('secureBody').value;
        const options = { method };

        if (method !== 'GET' && method !== 'DELETE') {
            options.body = bodyRaw;
        }

        const result = await apiCall(endpoint, options, true);
        logLine('SECURE_CALL_OK', result);
    } catch (error) {
        logLine('SECURE_CALL_ERROR', String(error));
    }
});

document.getElementById('btnClearToken').addEventListener('click', () => {
    setToken('');
    logLine('TOKEN', 'Token eliminado');
});

setToken(getToken());
