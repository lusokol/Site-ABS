const SITE_BASE = (function() {
    const path = window.location.pathname;
    const absIdx = path.indexOf('/abs/');
    return absIdx !== -1 ? path.slice(0, absIdx) + '/abs' : '';
})();
const API_BASE = SITE_BASE + '/api';

function getToken() {
    return localStorage.getItem('abs91_token');
}

function getUser() {
    const raw = localStorage.getItem('abs91_user');
    return raw ? JSON.parse(raw) : null;
}

function saveAuth(token, user) {
    localStorage.setItem('abs91_token', token);
    localStorage.setItem('abs91_user', JSON.stringify(user));
}

function logout() {
    localStorage.removeItem('abs91_token');
    localStorage.removeItem('abs91_user');
    window.location.href = SITE_BASE + '/app/login.html';
}

async function apiFetch(path, options = {}) {
    const token = getToken();
    const headers = { ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (res.status === 401) {
        logout();
        return null;
    }

    return res;
}

function requireAuth(allowedRoles) {
    const token = getToken();
    const user = getUser();
    if (!token || !user) {
        window.location.href = SITE_BASE + '/app/login.html';
        return null;
    }
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        window.location.href = SITE_BASE + '/app/login.html';
        return null;
    }
    refreshUser();
    return user;
}

async function refreshUser() {
    const res = await apiFetch('/auth/me');
    if (!res || !res.ok) return;
    const fresh = await res.json();
    const cached = getUser();
    if (cached && fresh.role !== cached.role) {
        saveAuth(getToken(), { ...cached, ...fresh });
    }
}

function formatCents(cents) {
    return (cents / 100).toFixed(2).replace('.', ',') + ' €';
}

function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function showToast(message, type = 'success') {
    const container = document.querySelector('.toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function isAdminViewingAsMember() {
    return sessionStorage.getItem('abs91_member_view') === '1';
}

function toggleMemberView() {
    if (isAdminViewingAsMember()) {
        sessionStorage.removeItem('abs91_member_view');
    } else {
        sessionStorage.setItem('abs91_member_view', '1');
    }
    window.location.reload();
}

function getEffectiveRole(user) {
    if ((user.role === 'admin' || user.role === 'prof') && isAdminViewingAsMember()) {
        return 'member';
    }
    return user.role;
}

function buildSidebar(user, activePage) {
    const realAdmin = user.role === 'admin' || user.role === 'prof';
    const viewAsMember = isAdminViewingAsMember();
    const showAdmin = realAdmin && !viewAsMember;
    const sidebar = document.getElementById('sidebar');

    const viewToggle = realAdmin
        ? `<a href="#" id="view-toggle-btn" style="margin-top:0.5rem;font-size:0.85rem;opacity:0.85;">
               <i class="fas fa-${viewAsMember ? 'shield-alt' : 'eye'}"></i> ${viewAsMember ? 'Vue admin' : 'Vue membre'}
           </a>`
        : '';

    if (showAdmin) {
        const ac = (p) => activePage === p ? ' class="active"' : '';
        sidebar.innerHTML = `
            <div class="sidebar-header">
                <h2><i class="fas fa-shield-alt"></i> Administration</h2>
                <p>${user.email}</p>
            </div>
            <ul class="sidebar-nav">
                <li><a href="../admin/"${ac('dashboard')}><i class="fas fa-chart-line"></i> Tableau de bord</a></li>
                <li><a href="../admin/slots.html"${ac('slots')}><i class="fas fa-calendar-plus"></i> Créneaux</a></li>
                <li><a href="../admin/bookings.html"${ac('bookings-admin')}><i class="fas fa-bookmark"></i> Réservations</a></li>
                <li><a href="../admin/members.html"${ac('members')}><i class="fas fa-users"></i> Membres</a></li>
                <li><a href="../admin/payments.html"${ac('payments')}><i class="fas fa-euro-sign"></i> Paiements</a></li>
                <li><a href="../admin/actualites.html"${ac('actualites')}><i class="fas fa-newspaper"></i> Actualités</a></li>
                <li style="margin-top:0.5rem;border-top:1px solid rgba(255,255,255,0.15);padding-top:0.5rem;">
                    <a href="../member/bookings.html"${ac('bookings')}><i class="fas fa-calendar-check"></i> Réserver un cours</a>
                </li>
            </ul>
            <div class="sidebar-bottom">
                <a href="../../index.html"><i class="fas fa-arrow-left"></i> Retour au site</a>
                ${viewToggle}
                <a href="#" id="logout-btn" style="margin-top:0.5rem;"><i class="fas fa-sign-out-alt"></i> Déconnexion</a>
            </div>`;
    } else {
        const ac = (p) => activePage === p ? ' class="active"' : '';
        sidebar.innerHTML = `
            <div class="sidebar-header">
                <h2><i class="fas fa-user"></i> Mon espace</h2>
                <p>${user.email}</p>
            </div>
            <ul class="sidebar-nav">
                <li><a href="./"${ac('home')}><i class="fas fa-home"></i> Accueil</a></li>
                <li><a href="./bookings.html"${ac('bookings')}><i class="fas fa-calendar-check"></i> Réserver</a></li>
                <li><a href="./wallet.html"${ac('wallet')}><i class="fas fa-wallet"></i> Mon solde</a></li>
                <li><a href="./history.html"${ac('history')}><i class="fas fa-history"></i> Historique</a></li>
            </ul>
            <div class="sidebar-bottom">
                <a href="../../index.html"><i class="fas fa-arrow-left"></i> Retour au site</a>
                ${viewToggle}
                <a href="#" id="logout-btn" style="margin-top:0.5rem;"><i class="fas fa-sign-out-alt"></i> Déconnexion</a>
            </div>`;
    }

    document.getElementById('logout-btn').addEventListener('click', (e) => { e.preventDefault(); logout(); });
    const toggleBtn = document.getElementById('view-toggle-btn');
    if (toggleBtn) toggleBtn.addEventListener('click', (e) => { e.preventDefault(); toggleMemberView(); });
}

(function initSidebarToggle() {
    const toggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    if (!toggle || !sidebar) return;

    const backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    sidebar.insertAdjacentElement('afterend', backdrop);

    function closeSidebar() {
        sidebar.classList.remove('open');
        backdrop.classList.remove('open');
    }

    toggle.addEventListener('click', () => {
        const open = sidebar.classList.toggle('open');
        backdrop.classList.toggle('open', open);
    });

    backdrop.addEventListener('click', closeSidebar);
})();
