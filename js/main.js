// ========================================
// ABS91 - JavaScript Principal
// ========================================

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

document.addEventListener('DOMContentLoaded', async () => {
    // Charger header + footer, puis tout initialiser
    await loadComponents();
    init();
});

function init() {
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

    // === NAVIGATION MOBILE ===
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');
    const navBackdrop = document.querySelector('.nav-backdrop');

    function openMenu() {
        navMenu.classList.add('active');
        if (navBackdrop) navBackdrop.classList.add('active');
        navToggle.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
        const spans = navToggle.querySelectorAll('span');
        spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
        spans[1].style.opacity = '0';
        spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
    }

    function closeMenu() {
        navMenu.classList.remove('active');
        if (navBackdrop) navBackdrop.classList.remove('active');
        navToggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
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

    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (navMenu && navMenu.classList.contains('active')) {
                closeMenu();
            }
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && navMenu && navMenu.classList.contains('active')) {
            closeMenu();
            navToggle.focus();
        }
    });

    // === SCROLL EFFECTS ===
    const scrollTopBtn = document.querySelector('.scroll-top');

    // Barre de progression de lecture en haut de page
    const scrollProgress = document.createElement('div');
    scrollProgress.className = 'scroll-progress';
    scrollProgress.setAttribute('aria-hidden', 'true');
    document.body.appendChild(scrollProgress);

    // Hero banner — logo roulant
    const heroBannerWrapper = document.querySelector('.hero-banner-wrapper');
    const heroBanner = document.querySelector('.hero-banner');
    const bannerLogo = document.querySelector('.hero-banner-logo');
    const bannerFront = document.querySelector('.hero-banner-img--front');
    let bannerHeight = heroBanner ? heroBanner.offsetHeight : 0;
    let bannerWidth = heroBanner ? heroBanner.offsetWidth : 0;
    let wrapperHeight = heroBannerWrapper ? heroBannerWrapper.offsetHeight : 0;
    let logoSize = 0;

    if (heroBanner) {
        window.addEventListener('resize', () => {
            bannerHeight = heroBanner.offsetHeight;
            bannerWidth = heroBanner.offsetWidth;
            wrapperHeight = heroBannerWrapper ? heroBannerWrapper.offsetHeight : 0;
            if (header) {
                document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px');
            }
        });
    }

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        // Barre de progression
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        scrollProgress.style.transform = `scaleX(${docHeight > 0 ? currentScroll / docHeight : 0})`;

        // Header shadow
        if (header) {
            if (currentScroll > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        }

        // Scroll-to-top button
        if (scrollTopBtn) {
            if (currentScroll > 400) {
                scrollTopBtn.classList.add('visible');
            } else {
                scrollTopBtn.classList.remove('visible');
            }
        }

        // Hero banner logo roll
        if (heroBannerWrapper && bannerLogo && bannerFront && !prefersReducedMotion) {
            const wrapperTop = heroBannerWrapper.offsetTop;
            const scrollInWrapper = currentScroll - wrapperTop;
            const scrollRange = wrapperHeight - bannerHeight;
            // Animation finit a 80% du scroll, les 20% restants = pause
            const animRange = scrollRange * 0.8;
            const progress = animRange > 0 ? Math.min(Math.max(scrollInWrapper / animRange, 0), 1) : 0;

            logoSize = bannerLogo.offsetHeight || bannerHeight;
            const travel = bannerWidth + logoSize;
            const distanceTraveled = progress * travel;

            const circumference = Math.PI * logoSize;
            const rotation = -(distanceTraveled / circumference) * 360;

            bannerLogo.style.transform = `translateX(${-distanceTraveled}px) rotate(${rotation}deg)`;

            const logoCenterX = bannerWidth - distanceTraveled + (logoSize / 2);
            const clipEdge = logoCenterX + (logoSize * 0.05);
            const clipFromRight = Math.min(Math.max((clipEdge / bannerWidth) * 100, 0), 100);
            bannerFront.style.clipPath = `inset(0 ${100 - clipFromRight}% 0 0)`;
        }
    });

    // Scroll-to-top click
    if (scrollTopBtn) {
        scrollTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
        });
    }

    // === SMOOTH SCROLL ===
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href !== '#' && href !== '') {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({
                        behavior: prefersReducedMotion ? 'auto' : 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });

    // === ACTIVE NAV LINK ===
    const currentPage = window.location.pathname.split('/').pop().split('?')[0] || 'index.html';
    navLinks.forEach(link => {
        link.classList.remove('active');
        const linkPage = link.getAttribute('href');
        if (linkPage === currentPage || (currentPage === '' && linkPage === 'index.html')) {
            link.classList.add('active');
        }
    });

    // === FADE IN ON SCROLL ===
    // Decalage en cascade : chaque element .observe recoit un index --stagger
    // au sein de son parent (les grilles de cartes apparaissent en escalier)
    const staggerCounts = new Map();
    document.querySelectorAll('.observe').forEach(el => {
        const parent = el.parentElement;
        const i = staggerCounts.get(parent) || 0;
        el.style.setProperty('--stagger', i % 6);
        staggerCounts.set(parent, i + 1);
    });

    if (!prefersReducedMotion) {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('fade-in');
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        document.querySelectorAll('.observe').forEach(el => {
            observer.observe(el);
        });
    } else {
        document.querySelectorAll('.observe').forEach(el => {
            el.style.opacity = '1';
        });
    }

    // === FORM VALIDATION ===
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        const inputs = form.querySelectorAll('.form-control');
        inputs.forEach(input => {
            input.addEventListener('blur', () => validateField(input));
            input.addEventListener('input', () => {
                if (input.classList.contains('error')) {
                    validateField(input);
                }
            });
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            let isValid = true;

            inputs.forEach(input => {
                if (!validateField(input)) {
                    isValid = false;
                }
            });

            if (isValid) {
                showToast('Merci pour votre message ! Nous vous répondrons rapidement.', 'success');
                form.reset();
                inputs.forEach(input => {
                    input.classList.remove('error');
                    const errorEl = input.parentElement.querySelector('.form-error');
                    if (errorEl) errorEl.classList.remove('visible');
                });
            } else {
                showToast('Veuillez corriger les erreurs dans le formulaire.', 'error');
            }
        });
    });

    function validateField(input) {
        const value = input.value.trim();
        const isRequired = input.hasAttribute('required');
        const errorEl = input.parentElement.querySelector('.form-error');
        let valid = true;

        if (isRequired && !value) {
            valid = false;
            input.classList.add('error');
            if (errorEl) {
                errorEl.textContent = 'Ce champ est obligatoire';
                errorEl.classList.add('visible');
            }
        } else if (input.type === 'email' && value && !isValidEmail(value)) {
            valid = false;
            input.classList.add('error');
            if (errorEl) {
                errorEl.textContent = 'Veuillez entrer un email valide';
                errorEl.classList.add('visible');
            }
        } else {
            input.classList.remove('error');
            if (errorEl) errorEl.classList.remove('visible');
        }

        return valid;
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

    // === COUNTER ANIMATION ===
    const animateCounter = (element, target, duration = 2000) => {
        if (prefersReducedMotion) {
            element.textContent = target + (target > 10 ? '+' : '');
            return;
        }

        const start = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - (1 - progress) * (1 - progress);
            const current = Math.floor(eased * target);

            if (progress < 1) {
                element.textContent = current;
                requestAnimationFrame(update);
            } else {
                element.textContent = target + (target > 10 ? '+' : '');
            }
        }

        requestAnimationFrame(update);
    };

    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = parseInt(entry.target.getAttribute('data-count'));
                if (!isNaN(target)) {
                    animateCounter(entry.target, target);
                }
                counterObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    document.querySelectorAll('.stat-number[data-count]').forEach(counter => {
        counterObserver.observe(counter);
    });

    // === GALLERY LIGHTBOX ===
    const galleryImages = document.querySelectorAll('.gallery-item img, .photo-item');

    galleryImages.forEach(item => {
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
            document.body.style.overflow = 'hidden';

            const closeLightbox = () => {
                document.body.removeChild(lightbox);
                document.body.style.overflow = '';
                item.focus();
            };

            lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
            lightbox.addEventListener('click', (e) => {
                if (e.target === lightbox) closeLightbox();
            });
            document.addEventListener('keydown', function onKey(e) {
                if (e.key === 'Escape') {
                    closeLightbox();
                    document.removeEventListener('keydown', onKey);
                }
            });
        };

        item.addEventListener('click', handler);
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handler();
            }
        });
    });

    // === TILT 3D SUR LES CARTES (souris uniquement) ===
    if (window.matchMedia('(pointer: fine)').matches && !prefersReducedMotion) {
        document.querySelectorAll('.card').forEach(card => {
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

    // === RIPPLE SUR LES BOUTONS ===
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

    // === DECORATIONS FLOTTANTES (heros et sections CTA) ===
    if (!prefersReducedMotion) {
        const decoTypes = ['dot', 'ring', 'glow'];
        document.querySelectorAll('.hero, .section-cta').forEach(zone => {
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

// === UTILITIES ===

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
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};
