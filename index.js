const USE_MULTIUSER_MOCK = false;

const DEFAULT_MOCK_MEMBERSHIPS = [
    { userId: 1, spaceId: 1, estado: 'aprobado' },
    { userId: 1, spaceId: 2, estado: 'pendiente' },
    { userId: 3, spaceId: 1, estado: 'aprobado' },
    { userId: 4, spaceId: 1, estado: 'pendiente' },
    { userId: 3, spaceId: 3, estado: 'aprobado' }
];

const mockState = {
    currentUserId: null,
    users: [
        { id: 1, nombre: 'usuario1', email: 'usuario1@mail.com' },
        { id: 2, nombre: 'usuario2', email: 'usuario2@mail.com' },
        { id: 3, nombre: 'usuario3', email: 'usuario3@mail.com' },
        { id: 4, nombre: 'usuario4', email: 'usuario4@mail.com' }
    ],
    spaces: [
        { id: 1, nombre: 'Astronomia', ownerId: 2, tipo: 'publico' },
        { id: 2, nombre: 'Ciberseguridad', ownerId: 2, tipo: 'publico' },
        { id: 3, nombre: 'Node.js', ownerId: 2, tipo: 'publico' }
    ],
    memberships: DEFAULT_MOCK_MEMBERSHIPS.map(m => ({ ...m })),
    linksBySpace: {
        1: [
            { nombre: 'NASA', comentario: 'Novedades del espacio', direccion: 'https://www.nasa.gov' },
            { nombre: 'ESA', comentario: 'Agencia Espacial Europea', direccion: 'https://www.esa.int' },
            { nombre: 'Sky & Telescope', comentario: 'Astronomia para aficionados', direccion: 'https://skyandtelescope.org' }
        ],
        2: [
            { nombre: 'OWASP', comentario: 'Buenas practicas de seguridad', direccion: 'https://owasp.org' },
            { nombre: 'CISA', comentario: 'Alertas y guias', direccion: 'https://www.cisa.gov' },
            { nombre: 'HackerOne Blog', comentario: 'Vulnerabilidades y reportes', direccion: 'https://www.hackerone.com/blog' }
        ],
        3: [
            { nombre: 'Node.js Docs', comentario: 'Documentacion oficial', direccion: 'https://nodejs.org/en/docs' },
            { nombre: 'Express', comentario: 'Framework web', direccion: 'https://expressjs.com' },
            { nombre: 'Socket.IO', comentario: 'Tiempo real en web', direccion: 'https://socket.io/docs/v4' }
        ]
    },
    selectedSpaceId: null
};

const ACCESS_TOKEN_KEY = 'accessToken';
const AUTO_REFRESH_INTERVAL_MS = 8000;
const API_BASE_URL = 'https://backendutn-tpf.onrender.com';
const FRONTEND_BUILD_VERSION = '2026-07-17-logs-auth-header';
const authSession = {
    user: null
};
let autoRefreshTimer = null;
let autoRefreshInFlight = false;
let autoRefreshHooksConfigured = false;

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
    return localStorage.getItem(ACCESS_TOKEN_KEY) || '';
}

function setToken(token) {
    if (token) {
        localStorage.setItem(ACCESS_TOKEN_KEY, token);
        return;
    }
    localStorage.removeItem(ACCESS_TOKEN_KEY);
}

function clearToken() {
    setToken('');
}

function getAuthHeaders(extraHeaders = {}) {
    const headers = { ...extraHeaders };
    const token = getToken();
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    return headers;
}

function setAuthStatus(message, isError = false) {
    const node = document.getElementById('authStatusText');
    if (!node) return;
    node.textContent = message || '';
    node.style.color = isError ? '#9f2f2f' : '#2f4155';
}

function setAuthMode(mode = 'login') {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const forgotForm = document.getElementById('forgotForm');
    const registerLink = document.getElementById('registerLink');

    if (loginForm) loginForm.classList.toggle('hidden', mode !== 'login');
    if (registerForm) registerForm.classList.toggle('hidden', mode !== 'register');
    if (forgotForm) forgotForm.classList.toggle('hidden', mode !== 'forgot');
    if (registerLink) registerLink.style.display = mode === 'login' ? '' : 'none';
}

function clearAuthForms() {
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    const forgotEmail = document.getElementById('forgotEmailMain');
    const forgotForm = document.getElementById('forgotForm');
    const registerNombre = document.getElementById('registerNombreMain');
    const registerEmail = document.getElementById('registerEmailMain');
    const registerPassword = document.getElementById('registerPasswordMain');
    const registerForm = document.getElementById('registerForm');

    if (loginEmail) loginEmail.value = '';
    if (loginPassword) loginPassword.value = '';
    if (forgotEmail) forgotEmail.value = '';
    if (registerNombre) registerNombre.value = '';
    if (registerEmail) registerEmail.value = '';
    if (registerPassword) registerPassword.value = '';
    if (forgotForm) forgotForm.classList.add('hidden');
    if (registerForm) registerForm.classList.add('hidden');
    setAuthMode('login');
}

function resetAppStateAfterLogout() {
    authSession.user = null;
    mockState.currentUserId = null;
    mockState.selectedSpaceId = null;
    mockState.spaces = [];
    mockState.memberships = [];
    mockState.linksBySpace = {};
    hideOwnerSpacePanel();
}

function setAuthenticatedUIState(isAuthenticated) {
    const authPanel = document.getElementById('authPanel');
    const topActions = document.querySelector('.mock-top-actions');
    const formContainer = document.querySelector('.form-container');
    const buttonContainer = document.querySelector('.button-container');
    const tableContainer = document.querySelector('.table-container');
    const logoutButton = document.getElementById('btnLogout');
    const ownerPanel = document.getElementById('ownerSpacePanel');
    const spaceForm = document.getElementById('spaceFormContainer');

    if (authPanel) authPanel.classList.toggle('hidden', isAuthenticated);
    if (topActions) topActions.style.display = isAuthenticated ? '' : 'none';
    if (formContainer) formContainer.style.display = isAuthenticated ? '' : 'none';
    if (buttonContainer) buttonContainer.style.display = isAuthenticated ? '' : 'none';
    if (tableContainer) tableContainer.style.display = isAuthenticated ? '' : 'none';
    if (logoutButton) logoutButton.style.display = isAuthenticated ? '' : 'none';
    if (ownerPanel && !isAuthenticated) ownerPanel.classList.add('hidden');
    if (spaceForm && !isAuthenticated) spaceForm.classList.add('hidden');

    if (!isAuthenticated) {
        stopAutoRefresh();
    }

    if (!isAuthenticated) {
        const select = document.getElementById('categoria');
        if (select) select.innerHTML = '';
        const tbody = getMainLinksTbody();
        if (tbody) tbody.innerHTML = '';
        clearLinkFields();
    }
}

async function fetchAuthMe() {
    const payload = await requestJson('/api/auth/me');
    const user = payload && payload.user ? payload.user : null;
    authSession.user = user;
    return user;
}

function getCurrentUser() {
    if (authSession.user) {
        return {
            id: Number(authSession.user.idUsuario),
            nombre: authSession.user.nombre,
            email: authSession.user.email
        };
    }
    if (!USE_MULTIUSER_MOCK) {
        return null;
    }
    return mockState.users.find(u => u.id === mockState.currentUserId) || null;
}

function getOwner(space) {
    return mockState.users.find(u => u.id === space.ownerId) || { nombre: '-' };
}

function getMembership(userId, spaceId) {
    return mockState.memberships.find(m => m.userId === userId && m.spaceId === spaceId) || null;
}

function getSpaceByCategory(categoryName) {
    return mockState.spaces.find(s => s.nombre.toUpperCase() === String(categoryName || '').toUpperCase()) || null;
}

function getAccessState(space) {
    if (space.ownerId === mockState.currentUserId) return 'owner';
    const membership = getMembership(mockState.currentUserId, space.id);
    if (!membership) return 'solicitar';
    if (membership.estado === 'aprobado') return 'autorizado';
    if (membership.estado === 'pendiente') return 'pendiente';
    return 'solicitar';
}

function getStateMeta(state) {
    if (state === 'owner') return { label: 'Autorizado (Owner)', css: 'owner' };
    if (state === 'autorizado') return { label: 'Autorizado', css: 'ok' };
    if (state === 'pendiente') return { label: 'Pendiente', css: 'pending' };
    return { label: 'Solicitar autorizacion', css: 'request' };
}

function canViewSpaceInfo(space) {
    const state = getAccessState(space);
    return state === 'owner' || state === 'autorizado';
}

function canListSpace(space) {
    if (!space) return false;
    if (!mockState.currentUserId) return false;
    if (space.ownerId === mockState.currentUserId) return true;
    const membership = getMembership(mockState.currentUserId, space.id);
    if (membership && membership.estado !== 'expulsado') return true;
    return space.tipo === 'publico';
}

function getMainLinksTbody() {
    return document.querySelector('.table-container tbody');
}

function clearLinkFields() {
    const nombre = document.getElementById('nombre');
    const comentario = document.getElementById('comentario');
    const direccion = document.getElementById('direccion');

    if (nombre) nombre.value = '';
    if (comentario) comentario.value = '';
    if (direccion) direccion.value = '';

    selectedId = null;
    document.querySelectorAll('table tbody tr').forEach(r => r.classList.remove('selected'));
}

function snapshotLinkFormState() {
    const nombre = document.getElementById('nombre');
    const comentario = document.getElementById('comentario');
    const direccion = document.getElementById('direccion');
    const active = document.activeElement;
    const focusedId = active && active.id ? String(active.id) : '';

    return {
        nombre: nombre ? nombre.value : '',
        comentario: comentario ? comentario.value : '',
        direccion: direccion ? direccion.value : '',
        selectedId: selectedId,
        hasFocus: ['nombre', 'comentario', 'direccion'].includes(focusedId)
    };
}

function restoreLinkFormState(state) {
    if (!state) return;

    const nombre = document.getElementById('nombre');
    const comentario = document.getElementById('comentario');
    const direccion = document.getElementById('direccion');

    if (nombre) nombre.value = state.nombre || '';
    if (comentario) comentario.value = state.comentario || '';
    if (direccion) direccion.value = state.direccion || '';

    selectedId = state.selectedId || null;

    if (!selectedId) {
        document.querySelectorAll('.table-container tbody tr').forEach((row) => row.classList.remove('selected'));
        return;
    }

    let foundRow = false;
    document.querySelectorAll('.table-container tbody tr').forEach((row) => {
        const celdas = row.getElementsByTagName('td');
        const isMatch = celdas && celdas[0] && String(celdas[0].innerText) === String(selectedId);
        row.classList.toggle('selected', isMatch);
        if (isMatch) {
            foundRow = true;
        }
    });

    if (!foundRow) {
        selectedId = null;
    }
}

function getSelectedSpace() {
    return mockState.spaces.find(s => s.id === mockState.selectedSpaceId) || null;
}

function updateActionButtonsVisibility() {
    const buttonIds = {
        agregar: 'btnAgregar',
        modificar: 'btnModificar',
        borrar: 'btnBorrar',
        buscar: 'btnBuscar',
        limpiar: 'btnLimpiar',
        html: 'btnHtml',
        manual: 'btnManual',
        espacio: 'btnEspacio',
        log: 'btnLog'
    };

    const selectedSpace = getSelectedSpace();
    const state = selectedSpace ? getAccessState(selectedSpace) : 'solicitar';

    let visibles = ['agregar', 'buscar', 'limpiar', 'html', 'manual'];

    // Owner puede ver opciones de gestión adicionales.
    if (state === 'owner') {
        visibles = ['agregar', 'modificar', 'borrar', 'buscar', 'limpiar', 'html', 'manual', 'espacio', 'log'];
    }

    Object.entries(buttonIds).forEach(([key, id]) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.style.display = visibles.includes(key) ? '' : 'none';
    });
}

function renderLoggedUser() {
    const link = document.getElementById('loggedUserLink');
    const user = getCurrentUser();
    if (!link) return;

    if (!user) {
        link.textContent = '';
        link.title = '';
        link.onclick = null;
        return;
    }

    link.textContent = user.nombre;
    link.title = `Usuario autenticado: ${user.email}`;
    link.onclick = (e) => {
        e.preventDefault();
        alert(`Usuario autenticado: ${user.nombre}\nEmail: ${user.email}`);
    };
}

function switchMockUser(userId) {
    mockState.currentUserId = userId;
    mockState.selectedSpaceId = null;

    renderLoggedUser();
    renderSpaceOptions();
    renderSelectedSpaceStatus();
    renderSelectedSpaceLinksInMainTable();
    updateActionButtonsVisibility();
    hideOwnerSpacePanel();
}

function setMainFormVisible(visible) {
    document.body.classList.toggle('space-mode', !visible);
}

function hideOwnerSpacePanel() {
    const panel = document.getElementById('ownerSpacePanel');
    if (panel) panel.classList.add('hidden');
    setMainFormVisible(true);
}

function toggleUserAuthorization(userId, spaceId) {
    const membership = getMembership(userId, spaceId);

    if (membership && membership.estado === 'aprobado') {
        membership.estado = 'expulsado';
        return;
    }

    if (membership) {
        membership.estado = 'aprobado';
        return;
    }

    mockState.memberships.push({ userId, spaceId, estado: 'aprobado' });
}

async function ensureBaseTestUsers() {
    const requiredUsers = [
        { nombre: 'usuario1', email: 'usuario1@mail.com' },
        { nombre: 'usuario2', email: 'usuario2@mail.com' }
    ];

    for (const item of requiredUsers) {
        await ensureOwnerInDatabase(item.nombre, item.email);
    }
}

async function refreshUsersFromApi() {
    const users = await requestJson('/api/usuarios');
    mockState.users = (users || []).map((u) => ({
        id: Number(u.idUsuario),
        nombre: u.nombre,
        email: u.email
    }));

    const current = getCurrentUser();
    if (current && Number.isInteger(Number(current.id))) {
        mockState.currentUserId = Number(current.id);
        return;
    }

    if (mockState.users.length > 0) {
        mockState.currentUserId = mockState.users[0].id;
    }
}

async function refreshSpacesAndMembershipsFromApi() {
    const spaces = await requestJson('/api/espacios');
    mockState.spaces = (spaces || []).map((space) => ({
        id: Number(space.idEspacio),
        nombre: space.denominacion,
        ownerId: space.idOwner === null ? null : Number(space.idOwner),
        tipo: space.tipoEspacio || 'publico'
    }));

    const allMemberships = [];
    const seen = new Set();

    function pushMembership(userId, spaceId, estado) {
        const uid = Number(userId);
        const sid = Number(spaceId);
        const normalized = String(estado || '').trim().toLowerCase();
        if (!uid || !sid || !normalized) return;
        const key = `${uid}:${sid}`;
        if (seen.has(key)) return;
        seen.add(key);
        allMemberships.push({ userId: uid, spaceId: sid, estado: normalized });
    }

    for (const space of mockState.spaces) {
        const myState = await requestJson(`/api/espacios/${space.id}/mi-estado`);
        if (myState && myState.estado) {
            pushMembership(mockState.currentUserId, space.id, myState.estado);
        }

        if (space.ownerId === mockState.currentUserId) {
            const members = await requestJson(`/api/espacios/${space.id}/miembros`);
            (members || []).forEach((m) => {
                const estado = String(m.estadoDescripcion || '').trim().toLowerCase();
                pushMembership(m.idUsuario, space.id, estado || 'pendiente');
            });
        }
    }

    mockState.memberships = allMemberships;
}

async function refreshLinksFromApi() {
    const links = await requestJson('/api/links');
    const grouped = {};

    mockState.spaces.forEach((space) => {
        grouped[space.id] = [];
    });

    (links || []).forEach((link) => {
        const spaceId = Number(link.idEspacio);
        const space = mockState.spaces.find((s) => Number(s.id) === spaceId);

        if (!space) return;

        if (!grouped[space.id]) grouped[space.id] = [];
        grouped[space.id].push({
            link_id: Number(link.link_id),
            nombre: link.nombre,
            creadorNombre: link.creadorNombre || '-',
            comentario: link.comentario,
            direccion: link.direccion
        });
    });

    mockState.linksBySpace = grouped;
}

async function hydrateStateFromApi() {
    await refreshUsersFromApi();
    await refreshSpacesAndMembershipsFromApi();
    await refreshLinksFromApi();

    const currentUserMembership = mockState.memberships.find((m) => m.userId === mockState.currentUserId);
    mockState.selectedSpaceId = currentUserMembership ? currentUserMembership.spaceId : (mockState.spaces[0] ? mockState.spaces[0].id : null);
}

function hasAuthenticatedSession() {
    return Boolean(getToken() && authSession.user && Number(authSession.user.idUsuario));
}

function isUserEditingCriticalForms() {
    const active = document.activeElement;
    if (!active || !active.id) return false;

    const editingFieldIds = new Set([
        'nombre',
        'comentario',
        'direccion',
        'ownerPanelSpaceName',
        'ownerPanelSpaceType',
        'spaceName',
        'spaceType'
    ]);

    return editingFieldIds.has(String(active.id));
}

async function syncStateAndRender(options = {}) {
    const { showAlertOnError = false } = options;
    if (!hasAuthenticatedSession()) return;

    const previousSelectedSpaceId = mockState.selectedSpaceId;

    try {
        await refreshUsersFromApi();
        await refreshSpacesAndMembershipsFromApi();
        await refreshLinksFromApi();

        if (previousSelectedSpaceId) {
            const stillVisible = mockState.spaces.some((space) => (
                Number(space.id) === Number(previousSelectedSpaceId)
                && canListSpace(space)
            ));
            if (stillVisible) {
                mockState.selectedSpaceId = Number(previousSelectedSpaceId);
            }
        }

        renderLoggedUser();
        renderSpaceOptions();
        renderSelectedSpaceStatus();
        renderSelectedSpaceLinksInMainTable({ keepFormState: true });
        updateActionButtonsVisibility();

        const ownerPanel = document.getElementById('ownerSpacePanel');
        if (ownerPanel && !ownerPanel.classList.contains('hidden')) {
            const selectedSpace = getSelectedSpace();
            if (selectedSpace && selectedSpace.ownerId === mockState.currentUserId) {
                renderOwnerSpacePanel();
            } else {
                hideOwnerSpacePanel();
            }
        }
    } catch (err) {
        console.error('Auto-refresh state sync failed:', err);
        if (showAlertOnError) {
            alert(`No se pudo actualizar datos en vivo: ${err.message}`);
        }
    }
}

function stopAutoRefresh() {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;
    }
    autoRefreshInFlight = false;
}

function triggerAutoRefresh() {
    if (autoRefreshInFlight || !hasAuthenticatedSession()) {
        return;
    }

    if (isUserEditingCriticalForms()) {
        return;
    }

    autoRefreshInFlight = true;
    syncStateAndRender({ showAlertOnError: false })
        .finally(() => {
            autoRefreshInFlight = false;
        });
}

function startAutoRefresh() {
    if (autoRefreshTimer) return;

    autoRefreshTimer = setInterval(() => {
        if (document.hidden) return;
        triggerAutoRefresh();
    }, AUTO_REFRESH_INTERVAL_MS);
}

function setupAutoRefreshHooks() {
    if (autoRefreshHooksConfigured) return;
    autoRefreshHooksConfigured = true;

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            triggerAutoRefresh();
        }
    });

    window.addEventListener('focus', () => {
        triggerAutoRefresh();
    });

    const refreshOnBlurIds = [
        'nombre',
        'comentario',
        'direccion',
        'ownerPanelSpaceName',
        'ownerPanelSpaceType',
        'spaceName',
        'spaceType'
    ];

    refreshOnBlurIds.forEach((id) => {
        const element = document.getElementById(id);
        if (!element) return;

        element.addEventListener('blur', () => {
            triggerAutoRefresh();
        });
    });
}

function setupOwnerPanelActions() {
    const btnSave = document.getElementById('ownerPanelSaveBtn');
    const btnCancel = document.getElementById('ownerPanelCancelBtn');

    if (btnSave) {
        btnSave.addEventListener('click', async () => {
            const space = getSelectedSpace();
            if (!space) return;

            const newName = (document.getElementById('ownerPanelSpaceName').value || '').trim();
            const newType = document.getElementById('ownerPanelSpaceType').value;

            if (!newName) {
                alert('El nombre del espacio es obligatorio.');
                return;
            }

            try {
                await updateSpaceInDatabase(space.id, newName, newType);
                await refreshSpacesAndMembershipsFromApi();
                await refreshLinksFromApi();
                renderSpaceOptions();
                renderSelectedSpaceStatus();
                renderSelectedSpaceLinksInMainTable();
                renderOwnerSpacePanel();
                updateActionButtonsVisibility();
                alert('Espacio actualizado con exito.');
            } catch (err) {
                alert(`No se pudo actualizar el espacio: ${err.message}`);
            }
        });
    }

    if (btnCancel) {
        btnCancel.addEventListener('click', () => {
            hideOwnerSpacePanel();
            renderSpaceOptions();
            renderSelectedSpaceStatus();
            renderSelectedSpaceLinksInMainTable();
            updateActionButtonsVisibility();
        });
    }
}

function renderOwnerSpacePanel() {
    const panel = document.getElementById('ownerSpacePanel');
    const ownerEmail = document.getElementById('ownerPanelEmail');
    const ownerName = document.getElementById('ownerPanelName');
    const spaceName = document.getElementById('ownerPanelSpaceName');
    const spaceType = document.getElementById('ownerPanelSpaceType');
    const saveBtn = document.getElementById('ownerPanelSaveBtn');
    const tbody = document.getElementById('ownerUsersTableBody');
    const usersTableWrap = panel ? panel.querySelector('.owner-users-table-wrap') : null;
    const privateMessage = document.getElementById('ownerPrivateMessage');
    if (!panel || !ownerEmail || !ownerName || !spaceName || !spaceType || !saveBtn || !tbody) return;

    const space = getSelectedSpace();
    const current = getCurrentUser();
    if (!space || !current) {
        alert('Seleccione un espacio para gestionar.');
        return;
    }

    if (space.ownerId !== mockState.currentUserId) {
        alert('Solo el owner puede ver este panel.');
        return;
    }

    const owner = getOwner(space);
    ownerEmail.value = owner.email || '';
    ownerName.value = owner.nombre || '';
    spaceName.value = space.nombre || '';
    spaceType.value = space.tipo || 'publico';
    saveBtn.textContent = 'Modificar';

    tbody.innerHTML = '';

    const isPrivateSpace = String(space.tipo || '').toLowerCase() === 'privado';
    if (usersTableWrap) {
        usersTableWrap.style.display = isPrivateSpace ? 'none' : '';
    }
    if (privateMessage) {
        privateMessage.classList.toggle('hidden', !isPrivateSpace);
    }

    if (isPrivateSpace) {
        panel.classList.remove('hidden');
        const spaceFormContainer = document.getElementById('spaceFormContainer');
        if (spaceFormContainer) spaceFormContainer.classList.add('hidden');
        setMainFormVisible(false);
        return;
    }

    const miembrosEspacio = mockState.memberships
        .filter((m) => m.spaceId === space.id && m.userId !== space.ownerId)
        .sort((a, b) => a.userId - b.userId);

    miembrosEspacio.forEach((membership) => {
        const u = mockState.users.find((user) => user.id === membership.userId) || {
            id: membership.userId,
            nombre: `Usuario ${membership.userId}`,
            email: ''
        };

        const status = String(membership.estado || 'pendiente').toLowerCase();
        const row = document.createElement('tr');

        row.insertCell(0).textContent = u.nombre;
        row.insertCell(1).textContent = status;

        const actionCell = row.insertCell(2);

        const ejecutarAccion = async (url, mensajeError) => {
            try {
                await requestJson(url, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ aprobadoPor: mockState.currentUserId })
                });

                await refreshSpacesAndMembershipsFromApi();
                renderOwnerSpacePanel();
                renderSpaceOptions();
                renderSelectedSpaceStatus();
                renderSelectedSpaceLinksInMainTable();
                updateActionButtonsVisibility();
            } catch (err) {
                alert(`${mensajeError}: ${err.message}`);
            }
        };

        if (status === 'pendiente') {
            const btnAprobar = document.createElement('button');
            btnAprobar.className = 'owner-action-btn';
            btnAprobar.textContent = 'Aprobar';
            btnAprobar.addEventListener('click', () => {
                ejecutarAccion(`/api/espacios/${space.id}/solicitudes/${u.id}/aprobar`, 'No se pudo aprobar');
            });

            const btnRechazar = document.createElement('button');
            btnRechazar.className = 'owner-action-btn desauth';
            btnRechazar.textContent = 'Rechazar';
            btnRechazar.addEventListener('click', () => {
                ejecutarAccion(`/api/espacios/${space.id}/solicitudes/${u.id}/rechazar`, 'No se pudo rechazar');
            });

            actionCell.appendChild(btnAprobar);
            actionCell.appendChild(btnRechazar);
        } else if (status === 'aprobado') {
            const btnExpulsar = document.createElement('button');
            btnExpulsar.className = 'owner-action-btn desauth';
            btnExpulsar.textContent = 'Expulsar';
            btnExpulsar.addEventListener('click', () => {
                ejecutarAccion(`/api/espacios/${space.id}/usuarios/${u.id}/expulsar`, 'No se pudo expulsar');
            });
            actionCell.appendChild(btnExpulsar);
        } else {
            actionCell.textContent = '-';
        }

        tbody.appendChild(row);
    });

    panel.classList.remove('hidden');
    const spaceFormContainer = document.getElementById('spaceFormContainer');
    if (spaceFormContainer) spaceFormContainer.classList.add('hidden');
    setMainFormVisible(false);
}

function setupMockUserSwitcher() {
    const btnUser1 = document.getElementById('btnUser1');
    const btnUser2 = document.getElementById('btnUser2');

    const user1 = mockState.users.find((u) => String(u.nombre || '').toLowerCase() === 'usuario1');
    const user2 = mockState.users.find((u) => String(u.nombre || '').toLowerCase() === 'usuario2');

    if (btnUser1) {
        btnUser1.addEventListener('click', () => {
            if (user1) switchMockUser(user1.id);
        });
    }
    if (btnUser2) {
        btnUser2.addEventListener('click', () => {
            if (user2) switchMockUser(user2.id);
        });
    }
}

function renderSpaceOptions() {
    const select = document.getElementById('categoria');
    if (!select) return;

    select.innerHTML = '';

    const orderedSpaces = [...mockState.spaces].sort((a, b) =>
        a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
    );

    const visibleSpaces = orderedSpaces.filter(canListSpace);

    visibleSpaces.forEach((space) => {
        const owner = getOwner(space);
        const state = getAccessState(space);
        const meta = getStateMeta(state);

        const option = document.createElement('option');
        option.value = space.nombre.toUpperCase();
        option.dataset.spaceId = String(space.id);
        option.textContent = `${space.nombre} | owner: ${owner.nombre} | ${meta.label}`;
        select.appendChild(option);
    });

    if (mockState.selectedSpaceId) {
        const selectedSpace = visibleSpaces.find(s => s.id === mockState.selectedSpaceId);
        if (selectedSpace) {
            select.value = selectedSpace.nombre.toUpperCase();
        } else {
            mockState.selectedSpaceId = null;
        }
    }

    // Sincronizar el estado interno con lo que realmente queda seleccionado en el combo.
    if (!mockState.selectedSpaceId && select.value) {
        const selected = getSpaceByCategory(select.value);
        if (selected && canListSpace(selected)) {
            mockState.selectedSpaceId = selected.id;
        }
    }

    if (!mockState.selectedSpaceId) {
        if (visibleSpaces.length) {
            mockState.selectedSpaceId = visibleSpaces[0].id;
            select.value = visibleSpaces[0].nombre.toUpperCase();
        } else {
            mockState.selectedSpaceId = null;
            select.value = '';
        }
    }

    document.getElementById('categoria').onchange = () => {
        const selected = getSpaceByCategory(select.value);
        mockState.selectedSpaceId = selected ? selected.id : null;
        renderSelectedSpaceStatus();
        renderSelectedSpaceLinksInMainTable();
        updateActionButtonsVisibility();
    };
}

function renderSelectedSpaceStatus() {
    const actionNode = document.getElementById('spaceSelectionAction');
    if (!actionNode) return;

    const space = mockState.spaces.find(s => s.id === mockState.selectedSpaceId);
    if (!space) {
        actionNode.textContent = '-';
        return;
    }

    const state = getAccessState(space);

    if (state === 'solicitar') {
        actionNode.innerHTML = '';
        const link = document.createElement('a');
        link.href = '#';
        link.className = 'action-link';
        link.textContent = 'Solicitar autorizacion';
        link.addEventListener('click', (e) => {
            e.preventDefault();
            solicitarAutorizacion(space.id);
        });
        actionNode.appendChild(link);
    } else {
        actionNode.textContent = state === 'owner' ? 'Owner autorizado' : 'Sin accion';
    }
}

function solicitarAutorizacion(spaceId) {
    const space = mockState.spaces.find(s => s.id === spaceId);
    if (!space) {
        alert('Espacio no encontrado.');
        return;
    }

    requestJson(`/api/espacios/${spaceId}/solicitudes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idUsuario: mockState.currentUserId })
    })
        .then(async () => {
            await refreshSpacesAndMembershipsFromApi();
            renderSpaceOptions();
            renderSelectedSpaceStatus();
            renderSelectedSpaceLinksInMainTable();
            updateActionButtonsVisibility();
        })
        .catch((err) => {
            alert(`No se pudo registrar la solicitud: ${err.message}`);
        });
}

function renderSelectedSpaceLinksInMainTable(options = {}) {
    const { keepFormState = false } = options;
    const tbody = getMainLinksTbody();
    if (!tbody) return;

    const formState = keepFormState ? snapshotLinkFormState() : null;

    tbody.innerHTML = '';
    if (!keepFormState) {
        clearLinkFields();
    }
    renderSelectedSpaceTableTitle();

    const space = getSelectedSpace();
    if (!space) {
        return;
    }

    if (!canViewSpaceInfo(space)) {
        return;
    }

    const links = mockState.linksBySpace[space.id] || [];

    links.forEach((item, idx) => {
        const row = document.createElement('tr');
        row.insertCell(0).textContent = item.link_id || (idx + 1);
        row.insertCell(1).textContent = item.creadorNombre || '-';
        row.insertCell(2).textContent = item.nombre;
        row.insertCell(3).textContent = item.comentario;

        const linkCell = row.insertCell(4);
        const a = document.createElement('a');
        a.href = item.direccion;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = item.direccion;
        linkCell.appendChild(a);

        tbody.appendChild(row);
    });

    agregarEventosTabla();

    if (keepFormState) {
        restoreLinkFormState(formState);
    }
}

function fillOwnerDefaults() {
    const current = getCurrentUser();
    const email = document.getElementById('ownerEmail');
    const name = document.getElementById('ownerName');
    if (!current || !email || !name) return;
    email.value = current.email;
    name.value = current.nombre;
}

function renderSelectedSpaceTableTitle() {
    const titleNode = document.getElementById('selectedSpaceTableTitle');
    if (!titleNode) return;

    const space = getSelectedSpace();
    if (!space) {
        titleNode.textContent = 'Espacio seleccionado: -';
        return;
    }

    titleNode.textContent = `Espacio seleccionado: ${space.nombre}`;
}

async function requestJson(url, options = {}) {
    const headers = getAuthHeaders(options.headers || {});
    const response = await fetch(resolveApiUrl(url), {
        ...options,
        headers
    });
    let data = null;

    try {
        data = await response.json();
    } catch (err) {
        data = null;
    }

    if (!response.ok) {
        const message = (data && (data.message || data.error)) || `Error ${response.status}`;
        const error = new Error(message);
        error.status = response.status;
        throw error;
    }

    if (data && typeof data === 'object' && Object.prototype.hasOwnProperty.call(data, 'ok') && Object.prototype.hasOwnProperty.call(data, 'data')) {
        return data.data;
    }

    return data;
}

function setupAuthPanel() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const forgotForm = document.getElementById('forgotForm');
    const registerLink = document.getElementById('registerLink');
    const forgotLink = document.getElementById('forgotPasswordLink');
    const registerCancel = document.getElementById('btnRegisterCancel');
    const forgotCancel = document.getElementById('btnForgotCancel');
    const loginCancel = document.getElementById('btnLoginCancel');
    const logoutButton = document.getElementById('btnLogout');

    setAuthMode('login');

    if (registerLink && registerForm) {
        registerLink.addEventListener('click', (e) => {
            e.preventDefault();
            setAuthMode('register');

            const loginEmail = document.getElementById('loginEmail');
            const registerEmail = document.getElementById('registerEmailMain');
            if (loginEmail && registerEmail) {
                registerEmail.value = loginEmail.value;
            }

            setAuthStatus('');
        });
    }

    if (forgotLink && forgotForm) {
        forgotLink.addEventListener('click', (e) => {
            e.preventDefault();
            setAuthMode('forgot');
            const loginEmail = document.getElementById('loginEmail');
            const forgotEmail = document.getElementById('forgotEmailMain');
            if (loginEmail && forgotEmail) {
                forgotEmail.value = loginEmail.value;
            }
            setAuthStatus('');
        });
    }

    if (registerCancel && registerForm) {
        registerCancel.addEventListener('click', () => {
            setAuthMode('login');
            setAuthStatus('');
        });
    }

    if (forgotCancel && forgotForm) {
        forgotCancel.addEventListener('click', () => {
            setAuthMode('login');
            setAuthStatus('');
        });
    }

    if (loginCancel) {
        loginCancel.addEventListener('click', () => {
            const email = document.getElementById('loginEmail');
            const password = document.getElementById('loginPassword');
            if (email) email.value = '';
            if (password) password.value = '';
            setAuthMode('login');
            setAuthStatus('');
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const nombre = (document.getElementById('registerNombreMain')?.value || '').trim();
            const email = (document.getElementById('registerEmailMain')?.value || '').trim();
            const password = document.getElementById('registerPasswordMain')?.value || '';

            if (!nombre || !email || !password) {
                setAuthStatus('Complete nombre, email y password para registrarse.', true);
                return;
            }

            try {
                await requestJson('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nombre, email, password })
                });

                const successMessage = 'Registro creado. Revise su casilla y confirme su cuenta para poder ingresar.';

                const loginEmail = document.getElementById('loginEmail');
                if (loginEmail) loginEmail.value = email;

                setAuthMode('login');
                setAuthStatus(successMessage);
            } catch (err) {
                setAuthStatus(`No se pudo registrar: ${err.message}`, true);
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = (document.getElementById('loginEmail')?.value || '').trim();
            const password = document.getElementById('loginPassword')?.value || '';

            if (!email || !password) {
                setAuthStatus('Complete email y password.', true);
                return;
            }

            setAuthStatus('Validando credenciales...');

            try {
                const result = await requestJson('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const token = result && result.accessToken ? result.accessToken : '';
                if (!token) {
                    throw new Error('Login sin token en la respuesta');
                }

                setToken(token);
                await fetchAuthMe();
                await initMultiuserMock();
                setAuthenticatedUIState(true);
                setAuthStatus('Sesion iniciada correctamente.');
            } catch (err) {
                clearToken();
                authSession.user = null;
                setAuthenticatedUIState(false);
                setAuthStatus(`Error de login: ${err.message}`, true);
            }
        });
    }

    if (forgotForm) {
        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = (document.getElementById('forgotEmailMain')?.value || '').trim();
            if (!email) {
                setAuthStatus('Ingrese un email para recuperar contraseña.', true);
                return;
            }

            try {
                await requestJson('/api/auth/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                setAuthStatus('Solicitud enviada. Revise su casilla para continuar con la recuperacion.');
                setAuthMode('login');
            } catch (err) {
                setAuthStatus(`No se pudo procesar recuperación: ${err.message}`, true);
            }
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            stopAutoRefresh();
            clearToken();
            resetAppStateAfterLogout();
            renderLoggedUser();
            setAuthenticatedUIState(false);
            clearAuthForms();
            setAuthStatus('Sesion cerrada. Token eliminado.');
        });
    }
}

async function ensureOwnerInDatabase(nombre, email) {
    if (USE_MULTIUSER_MOCK) {
        const existingMock = (mockState.users || []).find(u =>
            String(u.email || '').toLowerCase() === String(email || '').toLowerCase()
        );

        if (existingMock) {
            return {
                idUsuario: existingMock.id,
                nombre: existingMock.nombre,
                email: existingMock.email
            };
        }

        const nextUserId = (Math.max(...mockState.users.map(u => Number(u.id) || 0), 0) + 1);
        const createdMock = { id: nextUserId, nombre, email };
        mockState.users.push(createdMock);

        return {
            idUsuario: createdMock.id,
            nombre: createdMock.nombre,
            email: createdMock.email
        };
    }

    const users = await requestJson('/api/usuarios');
    const existing = (users || []).find(u =>
        String(u.email || '').toLowerCase() === String(email || '').toLowerCase()
    );

    if (existing) return existing;

    const created = await requestJson('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, email })
    });

    return {
        idUsuario: created.idUsuario,
        nombre,
        email
    };
}

async function createSpaceInDatabase(denominacion, tipoEspacio) {
    if (USE_MULTIUSER_MOCK) {
        const nextSpaceId = (Math.max(...mockState.spaces.map(s => Number(s.id) || 0), 0) + 1);
        return nextSpaceId;
    }

    const created = await requestJson('/api/espacios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ denominacion, tipoEspacio })
    });

    return created && created.idEspacio ? Number(created.idEspacio) : null;
}

async function updateSpaceInDatabase(idEspacio, denominacion, tipoEspacio) {
    if (USE_MULTIUSER_MOCK) {
        const target = mockState.spaces.find((space) => Number(space.id) === Number(idEspacio));
        if (!target) {
            throw new Error('Espacio no encontrado');
        }

        target.nombre = denominacion;
        target.tipo = String(tipoEspacio || 'publico').toLowerCase();
        return {
            success: true,
            idEspacio: Number(idEspacio)
        };
    }

    return requestJson(`/api/espacios/${idEspacio}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ denominacion, tipoEspacio })
    });
}

function setupSpaceForm() {
    const container = document.getElementById('spaceFormContainer');
    const btnOpen = document.getElementById('btnToggleSpaceForm');
    const btnCancel = document.getElementById('btnCancelSpaceForm');
    const form = document.getElementById('spaceForm');

    if (!container || !btnOpen || !btnCancel || !form) return;

    btnOpen.addEventListener('click', () => {
        const ownerPanel = document.getElementById('ownerSpacePanel');
        if (ownerPanel) ownerPanel.classList.add('hidden');
        container.classList.remove('hidden');
        setMainFormVisible(false);
        fillOwnerDefaults();
    });

    btnCancel.addEventListener('click', () => {
        container.classList.add('hidden');
        setMainFormVisible(true);
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const spaceName = document.getElementById('spaceName').value.trim();
        const spaceType = document.getElementById('spaceType').value;

        if (!spaceName) {
            alert('Complete al menos el nombre del espacio.');
            return;
        }

        let persistedSpaceId = null;
        try {
            persistedSpaceId = await createSpaceInDatabase(spaceName, spaceType);
        } catch (err) {
            alert(`No se pudo guardar en base de datos: ${err.message}`);
            return;
        }

        await refreshUsersFromApi();
        await refreshSpacesAndMembershipsFromApi();
        await refreshLinksFromApi();

        if (persistedSpaceId) {
            mockState.selectedSpaceId = Number(persistedSpaceId);
        }

        form.reset();
        container.classList.add('hidden');
        setMainFormVisible(true);
        renderLoggedUser();
        renderSpaceOptions();
        renderSelectedSpaceStatus();
        renderSelectedSpaceLinksInMainTable();
        updateActionButtonsVisibility();
    });
}

async function initMultiuserMock() {
    try {
        await hydrateStateFromApi();
    } catch (err) {
        alert(`No se pudieron cargar datos iniciales desde MySQL: ${err.message}`);
    }

    setupOwnerPanelActions();
    renderLoggedUser();
    setupSpaceForm();
    renderSpaceOptions();
    renderSelectedSpaceStatus();
    renderSelectedSpaceLinksInMainTable();
    updateActionButtonsVisibility();
}

// Función para actualizar la tabla
function updateTable() {
    requestJson('/api/links')
        .then((data) => {
            console.log("Datos obtenidos:", data);
            const tableBody = document.querySelector(".table-container tbody");
            if (!tableBody) return;
            tableBody.innerHTML = ""; // Limpiar la tabla antes de agregar nuevos datos

            data.forEach((link) => {
                const row = tableBody.insertRow();

                // Insertar id en la primera celda (se ocultará vía CSS)
                row.insertCell(0).textContent = link.link_id;
                row.insertCell(1).textContent = link.creadorNombre || '-';
                row.insertCell(2).textContent = link.nombre;
                row.insertCell(3).textContent = link.comentario;
                // Crear link clicable en la columna Direccion
                const cell4 = row.insertCell(4);
                const a = document.createElement('a');
                a.href = link.direccion;
                a.textContent = link.direccion;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                // Evitar que el click en el enlace dispare el evento de seleccion de fila
                a.addEventListener('click', function (e) { e.stopPropagation(); });
                cell4.appendChild(a);
            });

            // Llamar a la función para agregar los eventos de clic a las filas después de actualizar la tabla
            agregarEventosTabla();
        })
        .catch((error) => console.error("Error al obtener los datos:", error));
}

// Actualizar la tabla cuando la página se cargue
function inicializarEventos() {
    console.info(`Frontend build: ${FRONTEND_BUILD_VERSION}`);
    setupAuthPanel();

    const token = getToken();
    if (!token) {
        setAuthenticatedUIState(false);
        renderLoggedUser();
        setAuthStatus('Ingrese su email y password para comenzar.');
        return;
    }

    fetchAuthMe()
        .then(() => initMultiuserMock())
        .then(() => {
            setAuthenticatedUIState(true);
            setAuthStatus('Sesion restaurada desde token guardado.');
        })
        .catch((error) => {
            const status = Number(error && error.status);

            if (status === 401 || status === 403) {
                clearToken();
                resetAppStateAfterLogout();
                renderLoggedUser();
                setAuthenticatedUIState(false);
                setAuthStatus('Sesion expirada o invalida. Ingrese nuevamente.', true);
                return;
            }

            // Falla transitoria (backend reiniciando/red): mantener token para no forzar relogin.
            renderLoggedUser();
            setAuthenticatedUIState(false);
            setAuthStatus('No se pudo validar la sesion en este momento. Reintente en unos segundos.', true);
        });
}

window.onload = inicializarEventos;

// Socket.IO: disparar registro de sesión en servidor
const socket = io(API_BASE_URL, { transports: ['websocket', 'polling'] });

socket.on('connect', () => {
    const userAgent = navigator.userAgent;
    socket.emit('registrar_link', {
        user_agent: userAgent
    });
});

socket.on('respuesta_registro', function (data) {
    console.log('Servidor respondió:', data);
});

// Id del registro seleccionado en la tabla (null si no hay selección)
var selectedId = null;

function crear() {
    if (USE_MULTIUSER_MOCK) {
        const space = getSelectedSpace();
        if (!space || !canViewSpaceInfo(space)) {
            alert('Sin autorizacion para agregar links en este espacio.');
            return;
        }

        const nombre = document.getElementById("nombre").value;
        const comentario = document.getElementById("comentario").value;
        const direccion = document.getElementById("direccion").value;

        if (!nombre || !direccion) {
            alert('Complete al menos nombre y direccion.');
            return;
        }

        if (!mockState.linksBySpace[space.id]) {
            mockState.linksBySpace[space.id] = [];
        }

        const currentUser = getCurrentUser();

        mockState.linksBySpace[space.id].push({
            nombre,
            creadorNombre: currentUser ? currentUser.nombre : '-',
            comentario,
            direccion
        });
        renderSelectedSpaceLinksInMainTable();
        return;
    }

    const selectedSpace = getSelectedSpace();
    if (!selectedSpace || !canViewSpaceInfo(selectedSpace)) {
        alert('Sin autorizacion para agregar links en este espacio.');
        return;
    }

    // Función para crear nuevo registro
    // Obtener los valores de los campos
    var idEspacio = Number(selectedSpace.id);
    var nombre = document.getElementById("nombre").value;
    var comentario = document.getElementById("comentario").value;
    var direccion = document.getElementById("direccion").value;

    // Enviar los datos al servidor usando fetch
    requestJson('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            idEspacio: idEspacio,
            nombre: nombre,
            comentario: comentario,
            direccion: direccion,
        })
    })
        .then((data) => {
            console.log(data);
            if (data.success) {
                console.log("Registro exitoso creado");
                limpiar();
                refreshLinksFromApi().then(() => renderSelectedSpaceLinksInMainTable());
            } else {
                alert("Error al registrar");
            }
        })
        .catch((error) => {
            console.error("Error:", error);
            alert(`No se pudo crear el link: ${error.message}`);
        });
}

function modificar() {
    if (USE_MULTIUSER_MOCK) {
        const space = getSelectedSpace();
        if (!space || !canViewSpaceInfo(space)) {
            alert('Sin autorizacion para modificar links en este espacio.');
            return;
        }

        if (!selectedId) {
            alert("Seleccione primero una fila de la tabla para modificar");
            return;
        }

        const idx = Number(selectedId) - 1;
        const list = mockState.linksBySpace[space.id] || [];
        if (!list[idx]) {
            alert('Link no encontrado.');
            return;
        }

        list[idx] = {
            nombre: document.getElementById("nombre").value,
            creadorNombre: list[idx].creadorNombre || '-',
            comentario: document.getElementById("comentario").value,
            direccion: document.getElementById("direccion").value
        };

        renderSelectedSpaceLinksInMainTable();
        return;
    }

    // Modificar registro seleccionado
    if (!selectedId) {
        alert("Seleccione primero una fila de la tabla para modificar");
        return;
    }

    const selectedSpace = getSelectedSpace();
    if (!selectedSpace || !canViewSpaceInfo(selectedSpace)) {
        alert('Sin autorizacion para modificar links en este espacio.');
        return;
    }

    var idEspacio = Number(selectedSpace.id);
    var nombre = document.getElementById("nombre").value;
    var comentario = document.getElementById("comentario").value;
    var direccion = document.getElementById("direccion").value;

    requestJson('/api/links/' + selectedId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            idEspacio: idEspacio,
            nombre: nombre,
            comentario: comentario,
            direccion: direccion,
        })
    })
        .then((data) => {
            console.log(data);
            if (data.success) {
                console.log("Registro actualizado");
                limpiar();
                refreshLinksFromApi().then(() => renderSelectedSpaceLinksInMainTable());
            } else {
                alert("Error al actualizar");
            }
        })
        .catch((error) => {
            console.error("Error:", error);
            alert(`No se pudo actualizar el link: ${error.message}`);
        });
}

function borrar() {
    if (USE_MULTIUSER_MOCK) {
        const space = getSelectedSpace();
        if (!space || !canViewSpaceInfo(space)) {
            alert('Sin autorizacion para eliminar links en este espacio.');
            return;
        }

        if (!selectedId) {
            alert("Seleccione primero una fila de la tabla para borrar");
            return;
        }

        if (!confirm("¿Confirma que desea eliminar el registro seleccionado?")) {
            return;
        }

        const idx = Number(selectedId) - 1;
        const list = mockState.linksBySpace[space.id] || [];
        if (idx >= 0 && idx < list.length) {
            list.splice(idx, 1);
        }

        renderSelectedSpaceLinksInMainTable();
        return;
    }

    // Borrar registro seleccionado
    if (!selectedId) {
        alert("Seleccione primero una fila de la tabla para borrar");
        return;
    }

    const selectedSpace = getSelectedSpace();
    if (!selectedSpace || !canViewSpaceInfo(selectedSpace)) {
        alert('Sin autorizacion para eliminar links en este espacio.');
        return;
    }

    if (!confirm("¿Confirma que desea eliminar el registro seleccionado?")) {
        return;
    }

    requestJson('/api/links/' + selectedId, { method: 'DELETE' })
        .then((data) => {
            console.log(data);
            if (data.success) {
                console.log("Registro eliminado");
                limpiar();
                refreshLinksFromApi().then(() => renderSelectedSpaceLinksInMainTable());
            } else {
                alert("Error al eliminar");
            }
        })
        .catch((error) => {
            console.error("Error:", error);
            alert(`No se pudo eliminar el link: ${error.message}`);
        });
}

function buscar() {
    if (USE_MULTIUSER_MOCK) {
        const space = getSelectedSpace();
        if (!space || !canViewSpaceInfo(space)) {
            alert('Sin autorizacion para buscar en este espacio.');
            return;
        }

        const nombre = String(document.getElementById("nombre").value || '').toLowerCase();
        const comentario = String(document.getElementById("comentario").value || '').toLowerCase();
        const direccion = String(document.getElementById("direccion").value || '').toLowerCase();
        const categoria = String(document.getElementById("categoria").value || '').toLowerCase();

        const list = (mockState.linksBySpace[space.id] || []).filter((item) => {
            const byNombre = !nombre || String(item.nombre || '').toLowerCase().includes(nombre);
            const byComentario = !comentario || String(item.comentario || '').toLowerCase().includes(comentario);
            const byDireccion = !direccion || String(item.direccion || '').toLowerCase().includes(direccion);
            const byCategoria = !categoria || String(space.nombre || '').toLowerCase().includes(categoria);
            return byNombre && byComentario && byDireccion && byCategoria;
        });

        const tableBody = document.querySelector(".table-container tbody");
        if (!tableBody) return;
        tableBody.innerHTML = '';

        list.forEach((item, idx) => {
            const row = tableBody.insertRow();
            row.insertCell(0).textContent = idx + 1;
            row.insertCell(1).textContent = item.creadorNombre || '-';
            row.insertCell(2).textContent = item.nombre;
            row.insertCell(3).textContent = item.comentario;
            const linkCell = row.insertCell(4);
            const a = document.createElement('a');
            a.href = item.direccion;
            a.textContent = item.direccion;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.addEventListener('click', function (e) { e.stopPropagation(); });
            linkCell.appendChild(a);
        });

        selectedId = null;
        agregarEventosTabla();
        return;
    }

    // Buscar registros por los campos del formulario
    const selectedSpace = getSelectedSpace();
    if (!selectedSpace || !canViewSpaceInfo(selectedSpace)) {
        alert('Sin autorizacion para buscar en este espacio.');
        return;
    }

    var nombre = document.getElementById("nombre").value;
    var comentario = document.getElementById("comentario").value;
    var direccion = document.getElementById("direccion").value;
    const query = new URLSearchParams({
        idEspacio: String(selectedSpace.id),
        nombre: String(nombre || ''),
        comentario: String(comentario || ''),
        direccion: String(direccion || '')
    });

    requestJson('/api/links?' + query.toString(), {
        method: 'GET'
    })
        .then((data) => {
            const tableBody = document.querySelector(".table-container tbody");
            if (!tableBody) return;
            tableBody.innerHTML = "";
            data.forEach((link) => {
                const row = tableBody.insertRow();

                row.insertCell(0).textContent = link.link_id;
                row.insertCell(1).textContent = link.creadorNombre || '-';
                row.insertCell(2).textContent = link.nombre;
                row.insertCell(3).textContent = link.comentario;
                const cell4 = row.insertCell(4);
                const a = document.createElement('a');
                a.href = link.direccion;
                a.textContent = link.direccion;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.addEventListener('click', function (e) { e.stopPropagation(); });
                cell4.appendChild(a);
            });

            // Reiniciar selección y agregar eventos
            selectedId = null;
            agregarEventosTabla();
        })
        .catch((error) => {
            console.error("Error al buscar:", error);
            alert(error.message || 'Error conectando con el servidor');
        });
}

function limpiar() {
    // Función para limpiar el formulario
    const currentSpace = getSelectedSpace();
    document.getElementById("categoria").value = currentSpace ? String(currentSpace.nombre || '').toUpperCase() : "";
    document.getElementById("nombre").value = "";
    document.getElementById("comentario").value = "";
    document.getElementById("direccion").value = "";
    // Limpiar selección
    selectedId = null;
    document.querySelectorAll("table tbody tr").forEach(r => r.classList.remove('selected'));

    // Si la tabla fue filtrada por una busqueda, restaurar todos los links del espacio seleccionado.
    renderSelectedSpaceLinksInMainTable();
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildHtmlDocument(title, spaceName, links, backgroundImageUrl = '', noticeMessage = '') {
    const safeTitle = escapeHtml(title || 'Bookmarks');
    const safeSpace = escapeHtml((spaceName || '').toUpperCase());
    const safeBackground = escapeHtml(backgroundImageUrl || '');
    const safeNotice = escapeHtml(noticeMessage || '');
    const rows = (links || [])
        .map((item) => {
            const name = escapeHtml(item.nombre || '');
            const url = escapeHtml(item.direccion || '');
            const comment = escapeHtml(item.comentario || '');
            return `
                <tr>
                    <td class="small">${safeSpace}</td>
                    <td>${name}</td>
                    <td>${comment}</td>
                    <td><a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a></td>
                </tr>`;
        })
        .join('');

    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>${safeTitle}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 24px;
            background: #f2f4f8;
            ${safeBackground ? `background-image: url('${safeBackground}');` : ''}
            background-size: cover;
            background-position: center;
            background-attachment: fixed;
            font-size: 18px;
        }
        .container { max-width: 1200px; margin: 0 auto; background: rgba(255,255,255,0.96); padding: 24px; border-radius: 8px; box-shadow: 0 0 14px rgba(0,0,0,0.08); }
        h2 { text-align: center; color: #222; margin: 0 0 16px 0; font-size: 28px; }
        .notice { margin: 0 0 12px 0; padding: 10px 12px; border: 1px solid #f0c36d; background: #fff8e8; color: #7a4f01; font-size: 15px; border-radius: 6px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 16px; }
        th, td { padding: 12px 14px; border: 1px solid #ddd; text-align: left; vertical-align: top; }
        th { background: #0033cc; color: #fff; font-weight: 700; }
        tr:nth-child(even) td { background: #f9f9f9; }
        a { color: #0033cc; text-decoration: none; word-break: break-word; }
        a:hover { text-decoration: underline; }
        .small { font-size: 0.95em; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h2>${safeTitle}</h2>
        ${safeNotice ? `<p class="notice">${safeNotice}</p>` : ''}
        <table>
            <colgroup>
                <col style="width:10%">
                <col style="width:20%">
                <col style="width:40%">
                <col style="width:30%">
            </colgroup>
            <thead>
                <tr>
                    <th>Carpeta</th>
                    <th>Nombre</th>
                    <th>Comentario</th>
                    <th>Dirección</th>
                </tr>
            </thead>
            <tbody>${rows}
            </tbody>
        </table>
    </div>
</body>
</html>`;
}

function downloadHtmlContent(filename, htmlContent) {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
}

async function getBackgroundImageDataUrl() {
    try {
        const response = await fetch('images/imagenX.jpg');
        if (!response.ok) return '';

        const blob = await response.blob();
        return await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result || ''));
            reader.onerror = () => resolve('');
            reader.readAsDataURL(blob);
        });
    } catch (err) {
        return '';
    }
}

async function publicar() {
    const space = getSelectedSpace();
    if (!space || !canViewSpaceInfo(space)) {
        alert('Sin autorizacion para generar HTML en este espacio.');
        return;
    }

    try {
        const response = await fetch(resolveApiUrl(`/api/espacios/${space.id}/generar-html`), {
            method: 'POST',
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            let message = 'No se pudo generar el HTML';
            try {
                const data = await response.json();
                message = data.message || data.error || message;
            } catch (e) {
                message = response.statusText || message;
            }
            alert(message);
            return;
        }

        const blob = await response.blob();
        const disposition = response.headers.get('Content-Disposition') || '';
        const match = disposition.match(/filename=([^;]+)/i);
        const fallbackName = `bookmarksUTN-${String(space.nombre || 'espacio').replace(/[^a-zA-Z0-9_-]+/g, '_')}.html`;
        const fileName = match ? match[1].replace(/"/g, '').trim() : fallbackName;

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error generando HTML:', error);
        alert('Error conectando con el servidor');
    }
}

async function info() {
    try {
        const response = await fetch(resolveApiUrl('/api/leePdf'), {
            method: 'POST'
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) {
            const message = payload?.message || payload?.error || `No se pudo abrir el manual (HTTP ${response.status})`;
            alert(message);
            return;
        }

        const manualUrl = String(payload?.data?.url || '').trim();
        if (!manualUrl) {
            alert('No se recibio URL del manual.');
            return;
        }

        window.open(manualUrl, '_blank');
    } catch (error) {
        console.error('Error abriendo manual:', error);
        alert('Error conectando con el servidor');
    }
}

function docs() {
    renderOwnerSpacePanel();
}

async function log() {
    const token = getToken();
    if (!token) {
        alert('Debe iniciar sesion para ver el log.');
        return;
    }

    const newWindow = window.open('', '_blank');

    if (!newWindow) {
        alert('El navegador bloqueo la apertura de la pestaña. Permita pop-ups para este sitio.');
        return;
    }

    try {
        newWindow.document.write('<p style="font-family: Arial, sans-serif; padding: 16px;">Cargando log...</p>');
        const response = await fetch(resolveApiUrl('/api/log-view'), {
            method: 'GET',
            headers: getAuthHeaders()
        });

        const contentType = String(response.headers.get('content-type') || '').toLowerCase();
        const text = await response.text();

        if (!response.ok) {
            let message = `No se pudo abrir log (HTTP ${response.status})`;
            try {
                const parsed = JSON.parse(text);
                message = parsed.message || parsed.error || message;
            } catch (_err) {
                // Mantener mensaje por defecto.
            }

            newWindow.document.open();
            newWindow.document.write(`<pre style="font-family: monospace; white-space: pre-wrap; padding: 16px;">${message}</pre>`);
            newWindow.document.close();
            return;
        }

        newWindow.document.open();
        if (contentType.includes('text/html')) {
            newWindow.document.write(text);
        } else {
            newWindow.document.write(`<pre style="font-family: monospace; white-space: pre-wrap; padding: 16px;">${text}</pre>`);
        }
        newWindow.document.close();
    } catch (error) {
        newWindow.document.open();
        newWindow.document.write(`<pre style="font-family: monospace; white-space: pre-wrap; padding: 16px;">Error conectando con el servidor: ${String(error && error.message || error)}</pre>`);
        newWindow.document.close();
    }
}

// Función que se ejecuta cuando se hace click en una fila de la tabla
function llenarFormulario(fila) {
    // Obtener las celdas de la fila
    let celdas = fila.getElementsByTagName("td");

    // Rellenar los campos del formulario con los valores de la fila
    document.getElementById("nombre").value = celdas[2].innerText;
    document.getElementById("comentario").value = celdas[3].innerText;
    document.getElementById("direccion").value = celdas[4].innerText;
    // Guardar id seleccionado y resaltar la fila
    selectedId = celdas[0].innerText;

    // Quitar clase selected de otras filas
    document.querySelectorAll("table tbody tr").forEach(r => r.classList.remove('selected'));
    fila.classList.add('selected');
    console.log("id de la fila: ", celdas[0].innerText);
}

// Añadir el evento de click a las filas de la tabla
function agregarEventosTabla() {
    let filas = document.querySelectorAll("table tbody tr");
    filas.forEach(fila => {
        fila.addEventListener("click", function () {
            llenarFormulario(fila);
        });
    });
}

// Alterna la clase 'expanded' en el contenedor del formulario
function toggleForm() {
    const container = document.querySelector('.form-container');
    if (!container) {
        console.warn('toggleForm: .form-container no encontrado');
        return;
    }
    container.classList.toggle('expanded');
}
