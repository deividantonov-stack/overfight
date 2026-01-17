// ==========================================================================
// OVERFIGHT - Main Application JavaScript
// ==========================================================================

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);

// Export for use in transitions.js
export { initApp };

function initApp() {
    initNavigation();
    initDropdowns();
    initRevealAnimations();
    initYear();
}

// ==========================================================================
// Navigation Toggle (Mobile)
// ==========================================================================
function initNavigation() {
    const navToggle = document.querySelector('.nav-toggle');
    const nav = document.querySelector('.nav');

    if (!navToggle || !nav) return;

    navToggle.addEventListener('click', () => {
        const isOpen = nav.classList.toggle('is-open');
        navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

        // Animate hamburger icon
        navToggle.classList.toggle('is-active', isOpen);
    });

    // Close nav when clicking outside
    document.addEventListener('click', (e) => {
        if (!nav.contains(e.target) && !navToggle.contains(e.target)) {
            nav.classList.remove('is-open');
            navToggle.setAttribute('aria-expanded', 'false');
            navToggle.classList.remove('is-active');
        }
    });
}

// ==========================================================================
// Dropdown Menus
// ==========================================================================
function initDropdowns() {
    const dropdownTriggers = document.querySelectorAll('.dropdown-trigger');

    dropdownTriggers.forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            const parent = trigger.closest('.has-dropdown');

            // Close other dropdowns
            document.querySelectorAll('.has-dropdown.open').forEach(el => {
                if (el !== parent) el.classList.remove('open');
            });

            parent.classList.toggle('open');
        });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.has-dropdown')) {
            document.querySelectorAll('.has-dropdown.open').forEach(el => {
                el.classList.remove('open');
            });
        }
    });
}

// ==========================================================================
// Reveal Animations (Intersection Observer)
// ==========================================================================
function initRevealAnimations() {
    const revealElements = document.querySelectorAll('.reveal, .reveal-stagger');

    if (!revealElements.length) return;

    const observerOptions = {
        root: null,
        rootMargin: '0px 0px -50px 0px',
        threshold: 0.1
    };

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                // Optionally unobserve after reveal
                // revealObserver.unobserve(entry.target);
            }
        });
    }, observerOptions);

    revealElements.forEach(el => {
        revealObserver.observe(el);
    });
}

// ==========================================================================
// Dynamic Year in Footer
// ==========================================================================
function initYear() {
    const yearElements = document.querySelectorAll('#y, #year');
    const currentYear = new Date().getFullYear();

    yearElements.forEach(el => {
        if (el) el.textContent = currentYear;
    });
}

// ==========================================================================
// Smooth Scroll for Anchor Links
// ==========================================================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const targetId = this.getAttribute('href');

        if (targetId === '#' || targetId === '#top') {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        const target = document.querySelector(targetId);
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
});
