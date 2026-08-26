// ========================================
// ABS91 - JavaScript Principal
// ========================================

// === THEME (dark/light) — applied immediately to avoid flash ===
(function() {
    var saved = localStorage.getItem('theme');
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    }
})();

// Marqueur JS actif — le CSS ne masque les elements .observe que si cette classe est presente
document.documentElement.classList.add('js');

// === CHARGEMENT DES COMPOSANTS (header/footer) ===
async function loadComponents() {
    const slots = document.querySelectorAll('[data-include]');
    await Promise.all([...slots].map(async (slot) => {
        try {
            const resp = await fetch(slot.getAttribute('data-include'));
            if (!resp.ok) return;
            const html = await resp.text();
            slot.insertAdjacentHTML('afterend', html);
            slot.remove();
        } catch (e) { /* composant indisponible, on continue */ }
    }));
}

function preloadHeroImages() {
    const urls = ['media/gymnasemil.webp', 'media/equipe-coupe-essonne.webp'];
    return Promise.all(urls.map(url => new Promise(resolve => {
        const img = new Image();
        img.onload = img.onerror = resolve;
        img.src = url;
    })));
}

function dismissLoader() {
    const loader = document.getElementById('page-loader');
    if (!loader) return;
    loader.classList.add('hidden');
    loader.addEventListener('transitionend', () => loader.remove(), { once: true });
    setTimeout(() => loader.remove(), 800);
}

// Fallback: dismiss loader after 4s even if something fails
setTimeout(dismissLoader, 4000);

document.addEventListener('DOMContentLoaded', async () => {
    await loadComponents();

    if (document.querySelector('.hero-banner')) {
        await preloadHeroImages();
    }

    initGlobal();
    initPage();
    dismissLoader();
});

// ========================================
// GLOBAL INIT — runs once, survives SPA navigations
// ========================================
function initGlobal() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // === ANNEE COURANTE (footer) ===
    document.querySelectorAll('.current-year').forEach(el => {
        el.textContent = new Date().getFullYear();
    });

    // === HEADER HEIGHT for banner overlap ===
    const header = document.querySelector('.header');
    if (header) {
        document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px');
    }

    // === THEME TOGGLE ===
    document.querySelectorAll('.theme-toggle').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var isDark = document.documentElement.classList.toggle('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });
    });

    // === NAVIGATION MOBILE ===
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');
    const navBackdrop = document.querySelector('.nav-backdrop');

    function openMenu() {
        navMenu.classList.add('active');
        if (navBackdrop) navBackdrop.classList.add('active');
        navToggle.setAttribute('aria-expanded', 'true');
        document.documentElement.style.overflow = 'hidden';
        const spans = navToggle.querySelectorAll('span');
        spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
        spans[1].style.opacity = '0';
        spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
    }

    function closeMenu() {
        navMenu.classList.remove('active');
        if (navBackdrop) navBackdrop.classList.remove('active');
        navToggle.setAttribute('aria-expanded', 'false');
        document.documentElement.style.overflow = '';
        const spans = navToggle.querySelectorAll('span');
        spans[0].style.transform = '';
        spans[1].style.opacity = '';
        spans[2].style.transform = '';
    }

    if (navToggle) {
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.addEventListener('click', () => {
            const isOpen = navMenu.classList.contains('active');
            isOpen ? closeMenu() : openMenu();
        });
    }

    if (navBackdrop) {
        navBackdrop.addEventListener('click', closeMenu);
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && navMenu && navMenu.classList.contains('active')) {
            closeMenu();
            navToggle.focus();
        }
    });

    // === SCROLL EFFECTS ===
    const scrollTopBtn = document.querySelector('.scroll-top');

    const scrollProgress = document.createElement('div');
    scrollProgress.className = 'scroll-progress';
    scrollProgress.setAttribute('aria-hidden', 'true');
    document.body.appendChild(scrollProgress);

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        scrollProgress.style.transform = `scaleX(${docHeight > 0 ? currentScroll / docHeight : 0})`;

        if (header) {
            header.classList.toggle('scrolled', currentScroll > 50);
        }

        if (scrollTopBtn) {
            scrollTopBtn.classList.toggle('visible', currentScroll > 400);
        }

        // Hero banner logo roll — uses live DOM refs
        const heroBannerWrapper = document.querySelector('.hero-banner-wrapper');
        const heroBanner = document.querySelector('.hero-banner');
        const bannerLogo = document.querySelector('.hero-banner-logo');
        const bannerFront = document.querySelector('.hero-banner-img--front');

        if (heroBannerWrapper && bannerLogo && bannerFront && heroBanner && !prefersReducedMotion) {
            const bannerHeight = heroBanner.offsetHeight;
            const bannerWidth = heroBanner.offsetWidth;
            const wrapperHeight = heroBannerWrapper.offsetHeight;
            const wrapperTop = heroBannerWrapper.offsetTop;
            const scrollInWrapper = currentScroll - wrapperTop;
            const scrollRange = wrapperHeight - bannerHeight;
            const animRange = scrollRange * 0.8;
            const progress = animRange > 0 ? Math.min(Math.max(scrollInWrapper / animRange, 0), 1) : 0;

            const logoSize = bannerLogo.offsetHeight || bannerHeight;
            const travel = bannerWidth + logoSize;
            const distanceTraveled = progress * travel;

            const circumference = Math.PI * logoSize;
            const rotation = -(distanceTraveled / circumference) * 360;

            bannerLogo.style.transform = `translateX(${-distanceTraveled}px) rotate(${rotation}deg)`;

            const mobileBannerQuery = window.matchMedia('(max-width: 768px)');
            if (mobileBannerQuery.matches) {
                const fade = Math.min(Math.max((progress - 0.25) / 0.35, 0), 1);
                bannerFront.style.clipPath = '';
                bannerFront.style.opacity = String(1 - fade);
                bannerFront.style.pointerEvents = fade > 0.5 ? 'none' : '';
            } else {
                const logoCenterX = bannerWidth - distanceTraveled + (logoSize / 2);
                const clipEdge = logoCenterX + (logoSize * 0.05);
                const clipFromRight = Math.min(Math.max((clipEdge / bannerWidth) * 100, 0), 100);
                bannerFront.style.clipPath = `inset(0 ${100 - clipFromRight}% 0 0)`;
                bannerFront.style.opacity = '';
                bannerFront.style.pointerEvents = '';
            }
        }
    });

    if (scrollTopBtn) {
        scrollTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
        });
    }

    // === TOAST NOTIFICATIONS ===
    window.showToast = function(message, type = 'success') {
        const container = document.querySelector('.toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon">
                <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            </span>
            <span class="toast-message">${message}</span>
            <span class="toast-close">&times;</span>
        `;

        container.appendChild(toast);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toast.classList.add('show');
            });
        });

        toast.querySelector('.toast-close').addEventListener('click', () => removeToast(toast));
        setTimeout(() => removeToast(toast), 5000);
    };

    function removeToast(toast) {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }

    // === COPIER ADRESSE AU CLIC (delegation) ===
    document.addEventListener('click', (e) => {
        const el = e.target.closest('.copyable-address');
        if (!el) return;
        const address = el.getAttribute('data-address');
        if (!address) return;
        navigator.clipboard.writeText(address).then(() => {
            showToast('Adresse copiée : ' + address, 'success');
        });
    });

    // === RIPPLE SUR LES BOUTONS (delegation) ===
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn');
        if (!btn || prefersReducedMotion) return;
        const rect = btn.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
        ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
        btn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
    });

    // === SPA NAVIGATION ===
    initSpaNavigation();
}

// ========================================
// PAGE INIT — reruns on each SPA navigation
// ========================================
function initPage() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const main = document.querySelector('main');
    if (!main) return;

    // === ACTIVE NAV LINK ===
    const navLinks = document.querySelectorAll('.nav-link');
    const path = window.location.pathname;
    const currentPage = path.replace(/\.html$/, '').split('/').pop() || 'index';
    navLinks.forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href');
        if (!href) return;
        const linkPage = href.replace(/\.html$/, '').split('/').pop() || 'index';
        if (linkPage === currentPage) link.classList.add('active');
    });

    // Close mobile nav if open
    const navMenu = document.querySelector('.nav-menu');
    if (navMenu && navMenu.classList.contains('active')) {
        navMenu.classList.remove('active');
        const navBackdrop = document.querySelector('.nav-backdrop');
        if (navBackdrop) navBackdrop.classList.remove('active');
        document.documentElement.style.overflow = '';
        const navToggle = document.querySelector('.nav-toggle');
        if (navToggle) {
            navToggle.setAttribute('aria-expanded', 'false');
            navToggle.querySelectorAll('span').forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
        }
    }

    // === FADE IN ON SCROLL ===
    const staggerCounts = new Map();
    main.querySelectorAll('.observe').forEach(el => {
        const parent = el.parentElement;
        const i = staggerCounts.get(parent) || 0;
        el.style.setProperty('--stagger', i % 6);
        staggerCounts.set(parent, i + 1);
    });

    if (!prefersReducedMotion) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('fade-in');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

        main.querySelectorAll('.observe').forEach(el => observer.observe(el));
    } else {
        main.querySelectorAll('.observe').forEach(el => { el.style.opacity = '1'; });
    }

    // === COUNTER ANIMATION ===
    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = parseInt(entry.target.getAttribute('data-count'));
                if (!isNaN(target)) animateCounter(entry.target, target, prefersReducedMotion);
                counterObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    main.querySelectorAll('.stat-number[data-count]').forEach(counter => counterObserver.observe(counter));

    // === FORM VALIDATION ===
    main.querySelectorAll('form').forEach(form => {
        const inputs = form.querySelectorAll('.form-control');
        inputs.forEach(input => {
            input.addEventListener('blur', () => validateField(input));
            input.addEventListener('input', () => {
                if (input.classList.contains('error')) validateField(input);
            });
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            let isValid = true;
            inputs.forEach(input => { if (!validateField(input)) isValid = false; });

            if (isValid) {
                if (form.id === 'contactForm') {
                    const btn = form.querySelector('button[type="submit"]');
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Envoi en cours...';
                    const siteBase = (() => { const p = window.location.pathname; const i = p.indexOf('/abs/'); return i !== -1 ? p.slice(0, i) + '/abs' : ''; })();
                    fetch(siteBase + '/api/contact', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: form.querySelector('#nom').value,
                            email: form.querySelector('#email').value,
                            phone: form.querySelector('#telephone')?.value || '',
                            subject: form.querySelector('#sujet').value,
                            message: form.querySelector('#message').value,
                        }),
                    })
                    .then(r => r.json().then(d => ({ ok: r.ok, data: d })))
                    .then(({ ok, data }) => {
                        if (ok) {
                            showToast('Merci pour votre message ! Nous vous répondrons rapidement.', 'success');
                            form.reset();
                            inputs.forEach(input => {
                                input.classList.remove('error');
                                const errorEl = input.parentElement.querySelector('.form-error');
                                if (errorEl) errorEl.classList.remove('visible');
                            });
                        } else {
                            showToast(data.error || 'Erreur lors de l\'envoi.', 'error');
                        }
                    })
                    .catch(() => showToast('Erreur de connexion au serveur.', 'error'))
                    .finally(() => { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Envoyer le message'; });
                } else {
                    showToast('Merci pour votre message ! Nous vous répondrons rapidement.', 'success');
                    form.reset();
                    inputs.forEach(input => {
                        input.classList.remove('error');
                        const errorEl = input.parentElement.querySelector('.form-error');
                        if (errorEl) errorEl.classList.remove('visible');
                    });
                }
            } else {
                showToast('Veuillez corriger les erreurs dans le formulaire.', 'error');
            }
        });
    });

    // === GALLERY LIGHTBOX ===
    main.querySelectorAll('.gallery-item img, .photo-item').forEach(item => {
        item.setAttribute('tabindex', '0');
        item.setAttribute('role', 'button');

        const handler = () => {
            const img = item.tagName === 'IMG' ? item : item.querySelector('img');
            if (!img) return;

            const lightbox = document.createElement('div');
            lightbox.className = 'lightbox';
            lightbox.setAttribute('role', 'dialog');
            lightbox.setAttribute('aria-label', 'Image agrandie');
            lightbox.innerHTML = `
                <div class="lightbox-content">
                    <span class="lightbox-close" role="button" aria-label="Fermer">&times;</span>
                    <img src="${img.src}" alt="${img.alt || ''}">
                </div>
            `;

            document.body.appendChild(lightbox);
            document.documentElement.style.overflow = 'hidden';

            const closeLightbox = () => {
                document.body.removeChild(lightbox);
                document.documentElement.style.overflow = '';
                item.focus();
            };

            lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
            lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
            document.addEventListener('keydown', function onKey(e) {
                if (e.key === 'Escape') { closeLightbox(); document.removeEventListener('keydown', onKey); }
            });
        };

        item.addEventListener('click', handler);
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }
        });
    });

    // === FILTRES ACTUALITES ===
    const filterBtns = main.querySelectorAll('.badge-filter[data-filter]');
    if (filterBtns.length) {
        const filterCards = main.querySelectorAll('[data-category]');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => { b.classList.remove('badge-primary'); b.setAttribute('aria-pressed', 'false'); });
                btn.classList.add('badge-primary');
                btn.setAttribute('aria-pressed', 'true');
                const filter = btn.getAttribute('data-filter');
                filterCards.forEach(card => {
                    card.classList.toggle('is-hidden', filter !== 'all' && card.getAttribute('data-category') !== filter);
                });
            });
        });
    }

    // === TILT 3D SUR LES CARTES ===
    if (window.matchMedia('(pointer: fine)').matches && !prefersReducedMotion) {
        main.querySelectorAll('.card:not(.no-tilt)').forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width - 0.5;
                const y = (e.clientY - rect.top) / rect.height - 0.5;
                card.classList.add('is-tilting');
                card.style.transform =
                    `perspective(900px) rotateX(${(-y * 5).toFixed(2)}deg) rotateY(${(x * 5).toFixed(2)}deg) translateY(-6px)`;
            });
            card.addEventListener('mouseleave', () => {
                card.classList.remove('is-tilting');
                card.style.transform = '';
            });
        });
    }

    // === SMOOTH SCROLL (ancres) ===
    main.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href !== '#' && href !== '') {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
            }
        });
    });

    // === SCROLL CUE (fleche banniere accueil) ===
    const scrollCue = main.querySelector('.scroll-cue');
    const heroBannerWrapper = main.querySelector('.hero-banner-wrapper');
    const header = document.querySelector('.header');
    if (scrollCue && heroBannerWrapper) {
        scrollCue.addEventListener('click', () => {
            const headerH = header ? header.offsetHeight : 0;
            const targetY = heroBannerWrapper.offsetTop + heroBannerWrapper.offsetHeight - headerH;

            if (prefersReducedMotion) { window.scrollTo(0, targetY); return; }

            const startY = window.pageYOffset;
            const distance = targetY - startY;
            const duration = 2000;
            const startTime = performance.now();
            let cancelled = false;

            const cancel = () => { cancelled = true; };
            const cancelEvents = ['wheel', 'touchstart', 'keydown'];
            cancelEvents.forEach(ev => window.addEventListener(ev, cancel, { passive: true, once: true }));
            document.documentElement.style.scrollBehavior = 'auto';

            const cleanup = () => {
                document.documentElement.style.scrollBehavior = '';
                cancelEvents.forEach(ev => window.removeEventListener(ev, cancel));
            };

            const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

            function step(now) {
                if (cancelled) { cleanup(); return; }
                const progress = Math.min((now - startTime) / duration, 1);
                window.scrollTo(0, startY + distance * easeInOutCubic(progress));
                if (progress < 1) requestAnimationFrame(step); else cleanup();
            }

            requestAnimationFrame(step);
        });
    }

    // === DECORATIONS FLOTTANTES ===
    if (!prefersReducedMotion) {
        const decoTypes = ['dot', 'ring', 'glow'];
        main.querySelectorAll('.hero, .section-cta').forEach(zone => {
            const frag = document.createDocumentFragment();
            for (let i = 0; i < 7; i++) {
                const deco = document.createElement('span');
                const size = 14 + Math.random() * 70;
                deco.className = `float-deco float-deco--${decoTypes[i % decoTypes.length]}`;
                deco.setAttribute('aria-hidden', 'true');
                deco.style.width = deco.style.height = `${size.toFixed(0)}px`;
                deco.style.left = `${(Math.random() * 92).toFixed(1)}%`;
                deco.style.top = `${(Math.random() * 80).toFixed(1)}%`;
                deco.style.animationDuration = `${(5 + Math.random() * 6).toFixed(1)}s`;
                deco.style.animationDelay = `-${(Math.random() * 6).toFixed(1)}s`;
                frag.appendChild(deco);
            }
            zone.appendChild(frag);
        });
    }
}

// ========================================
// SPA NAVIGATION
// ========================================
function initSpaNavigation() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const TRANSITION_MS = prefersReducedMotion ? 0 : 250;
    let navigating = false;

    // Pages publiques du site (pas le dashboard /app/)
    function isSpaLink(a) {
        if (!a || !a.href) return false;
        if (a.target === '_blank' || a.hasAttribute('download')) return false;
        if (a.origin !== location.origin) return false;
        const path = a.pathname;
        if (path.match(/\.(pdf|png|jpg|jpeg|webp|svg|css|js)$/i)) return false;
        // Ne pas intercepter les liens vers /app/ (dashboard)
        if (path.includes('/app/')) return false;
        // Seulement les pages du site public
        const base = getBasePath();
        if (!path.startsWith(base)) return false;
        return true;
    }

    function getBasePath() {
        const p = window.location.pathname;
        const i = p.indexOf('/abs/');
        return i !== -1 ? p.slice(0, i) + '/abs/' : '/';
    }

    function normalizeUrl(url) {
        return url.replace(/\/index(\.html)?$/, '/').replace(/\.html$/, '').replace(/\/$/, '') || '/';
    }

    document.addEventListener('click', (e) => {
        const a = e.target.closest('a');
        if (!a || !isSpaLink(a)) return;
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

        const targetUrl = normalizeUrl(a.pathname);
        const currentUrl = normalizeUrl(location.pathname);
        if (targetUrl === currentUrl && !a.hash) return;

        e.preventDefault();
        if (!navigating) navigateTo(a.href);
    });

    window.addEventListener('popstate', () => {
        if (!navigating) navigateTo(location.href, false);
    });

    async function navigateTo(url, pushState = true) {
        navigating = true;
        const main = document.querySelector('main');

        try {
            // Fade out
            if (TRANSITION_MS > 0 && main) {
                main.style.transition = `opacity ${TRANSITION_MS}ms ease`;
                main.style.opacity = '0';
                await sleep(TRANSITION_MS);
            }

            // Fetch new page
            const res = await fetch(url);
            if (!res.ok) { window.location.href = url; return; }
            const html = await res.text();

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const newMain = doc.querySelector('main');

            if (!newMain || !main) { window.location.href = url; return; }

            // Swap content
            main.innerHTML = newMain.innerHTML;

            // Update <title> and meta description
            const newTitle = doc.querySelector('title');
            if (newTitle) document.title = newTitle.textContent;
            const newDesc = doc.querySelector('meta[name="description"]');
            const curDesc = document.querySelector('meta[name="description"]');
            if (newDesc && curDesc) curDesc.setAttribute('content', newDesc.getAttribute('content'));

            // Push URL (clean, without .html)
            if (pushState) {
                const cleanUrl = normalizeUrl(new URL(url).pathname) + (new URL(url).hash || '');
                history.pushState(null, '', cleanUrl);
            }

            // Scroll to top (or to hash)
            const hash = new URL(url, location.origin).hash;
            if (hash) {
                const target = document.querySelector(hash);
                if (target) target.scrollIntoView({ behavior: 'auto', block: 'start' });
            } else {
                window.scrollTo(0, 0);
            }

            // Reinit page-specific behavior
            initPage();

            // Preload hero images if needed
            if (document.querySelector('.hero-banner')) {
                preloadHeroImages();
            }

            // Fade in
            if (TRANSITION_MS > 0) {
                main.style.opacity = '0';
                requestAnimationFrame(() => {
                    main.style.transition = `opacity ${TRANSITION_MS}ms ease`;
                    main.style.opacity = '1';
                });
            } else {
                main.style.opacity = '1';
            }
        } catch (err) {
            window.location.href = url;
        } finally {
            navigating = false;
        }
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ========================================
// HELPERS
// ========================================
function animateCounter(element, target, prefersReducedMotion) {
    if (prefersReducedMotion) {
        element.textContent = target + (target > 10 ? '+' : '');
        return;
    }

    const start = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - start;
        const progress = Math.min(elapsed / 2000, 1);
        const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        const current = Math.floor(eased * target);

        if (progress < 1) {
            element.textContent = current;
            requestAnimationFrame(update);
        } else {
            element.textContent = target + (target > 10 ? '+' : '');
        }
    }

    requestAnimationFrame(update);
}

function validateField(input) {
    const value = input.value.trim();
    const isRequired = input.hasAttribute('required');
    const errorEl = input.parentElement.querySelector('.form-error');
    let valid = true;

    if (isRequired && !value) {
        valid = false;
        input.classList.add('error');
        if (errorEl) { errorEl.textContent = 'Ce champ est obligatoire'; errorEl.classList.add('visible'); }
    } else if (input.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        valid = false;
        input.classList.add('error');
        if (errorEl) { errorEl.textContent = 'Veuillez entrer un email valide'; errorEl.classList.add('visible'); }
    } else {
        input.classList.remove('error');
        if (errorEl) errorEl.classList.remove('visible');
    }

    return valid;
}

const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('fr-FR', options);
};

const truncateText = (text, maxLength) => {
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
};

const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => { clearTimeout(timeout); func(...args); };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};
