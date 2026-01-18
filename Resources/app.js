// ==========================================================================
// OVERFIGHT - Main Application JavaScript
// ==========================================================================

// Export for use in transitions.js (transitions.js calls initApp)
export { initApp };

// Fallback: if page is accessed directly without transitions.js handling
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    // DOM already loaded, init immediately
    initApp();
}

function initApp() {
    initNavigation();
    initDropdowns();
    initRevealAnimations();
    initYear();
    initCounters();
    initGymsMap();

    // Dynamic content loading from API
    loadNews();
    loadTrainers();
    loadGymsContent();
    loadGalleryAlbums();
}

// ==========================================================================
// Dynamic Content Loading from API
// ==========================================================================

async function loadNews() {
    const container = document.getElementById('news-container');
    if (!container) return;

    try {
        const res = await fetch('/api/news');
        const news = await res.json();

        if (!news || news.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:var(--text-muted);">Няма налични новини</p>';
            return;
        }

        container.innerHTML = news.map(item => `
            <article class="news-card">
                <div class="news-thumb">
                    <img src="${item.image}" alt="${item.title}" loading="lazy" />
                </div>
                <div class="news-body">
                    <h3>${item.title}</h3>
                    <p>${item.description}</p>
                    <a class="link" href="${item.link}">
                        ${item.linkText || 'Виж повече'} <i class="fa-solid fa-arrow-right"></i>
                    </a>
                </div>
            </article>
        `).join('');

        // Re-trigger reveal animations for new content
        container.classList.add('reveal-stagger');
        initRevealAnimations();
    } catch (error) {
        console.error('Error loading news:', error);
    }
}

async function loadTrainers() {
    const container = document.getElementById('trainers-container');
    if (!container) return;

    try {
        const res = await fetch('/api/content/trainers');
        const trainers = await res.json();

        if (!trainers || trainers.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:var(--text-muted);">Няма налични треньори</p>';
            return;
        }

        container.innerHTML = trainers.map(item => `
            <a href="${item.page || '#'}" class="trainer-card">
                <div class="trainer-card-image">
                    <img src="${item.image}" alt="${item.name}" loading="lazy" />
                </div>
                <div class="trainer-card-body">
                    <h3 class="trainer-card-name">${item.name}</h3>
                    <p class="trainer-card-role">
                        ${item.dan} <i class="fa-solid fa-circle" style="font-size: 0.4em;"></i> ${item.role}
                    </p>
                    <span class="trainer-card-link">
                        Виж профил <i class="fa-solid fa-arrow-right"></i>
                    </span>
                </div>
            </a>
        `).join('');

        container.classList.add('reveal-stagger');
        initRevealAnimations();
    } catch (error) {
        console.error('Error loading trainers:', error);
    }
}

async function loadGymsContent() {
    const container = document.getElementById('gyms-container');
    if (!container) return;

    try {
        const res = await fetch('/api/content/gyms');
        const gyms = await res.json();

        if (!gyms || gyms.length === 0) return;

        container.innerHTML = gyms.map(item => `
            <article class="feature-card">
                <div class="feature-card-media">
                    <img src="${item.image}" alt="${item.name}" loading="lazy" />
                </div>
                <div class="feature-card-body">
                    <h3 class="feature-card-title">${item.name}</h3>
                    <p class="feature-card-desc">${item.description}</p>
                    <ul class="feature-card-list">
                        ${(item.features || []).map(f => `<li>${f}</li>`).join('')}
                    </ul>
                    <a class="btn btn-secondary btn-full" href="contacts.html">
                        Запиши се
                    </a>
                </div>
            </article>
        `).join('');

        container.classList.add('reveal-stagger');
        initRevealAnimations();
    } catch (error) {
        console.error('Error loading gyms:', error);
    }
}

async function loadGalleryAlbums() {
    const container = document.getElementById('gallery-albums-container');
    if (!container) return;

    try {
        const res = await fetch('/api/content/gallery');
        const gallery = await res.json();

        if (!gallery || Object.keys(gallery).length === 0) {
            container.innerHTML = '<p style="text-align:center;color:var(--text-muted);">Няма налични албуми</p>';
            return;
        }

        // Convert gallery object to array
        const albums = Object.values(gallery);

        container.innerHTML = albums.map(album => `
            <a href="${album.page}" class="album-card">
                <img src="${album.cover}" alt="${album.title}" loading="lazy" />
                <div class="album-card-overlay">
                    <h3 class="album-card-title">${album.title}</h3>
                    <p class="album-card-count">${album.subtitle}</p>
                </div>
            </a>
        `).join('');

        container.classList.add('reveal-stagger');
        initRevealAnimations();
    } catch (error) {
        console.error('Error loading gallery albums:', error);
    }
}

// ==========================================================================
// Counter Animation
// ==========================================================================
function initCounters() {
    const counters = document.querySelectorAll('.counter');
    if (!counters.length) return;

    // Reset counters to 0 first
    counters.forEach(counter => counter.textContent = '0');

    function animateCounters() {
        counters.forEach(counter => {
            const target = +counter.getAttribute('data-target');
            if (!target) return;

            const duration = 1000;
            const startTime = performance.now();

            function updateCounter(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easeOutQuart = 1 - Math.pow(1 - progress, 4);
                const current = Math.floor(easeOutQuart * target);

                counter.textContent = current;

                if (progress < 1) {
                    requestAnimationFrame(updateCounter);
                } else {
                    counter.textContent = target;
                }
            }

            requestAnimationFrame(updateCounter);
        });
    }

    const statsSection = document.querySelector('.stats-section');
    if (statsSection) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    observer.disconnect();
                    animateCounters();
                }
            });
        }, { threshold: 0.3 });

        observer.observe(statsSection);
    }
}

// ==========================================================================
// Gyms Map Initialization
// ==========================================================================
function initGymsMap() {
    const mapContainer = document.getElementById('gyms-map');
    if (!mapContainer) return;

    // Skip if already initialized
    if (mapContainer._leaflet_id) return;

    const isVisible = () => {
        const style = window.getComputedStyle(mapContainer);
        return style.display !== 'none' && mapContainer.offsetParent !== null;
    };

    // Wait for Leaflet to be available
    function waitForLeaflet(callback, attempts = 0) {
        if (typeof L !== 'undefined') {
            callback();
        } else if (attempts < 50) {
            setTimeout(() => waitForLeaflet(callback, attempts + 1), 100);
        }
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && isVisible() && !mapContainer._leaflet_id) {
                observer.disconnect();
                waitForLeaflet(() => createGymsMap(mapContainer));
            }
        });
    }, { threshold: 0.1 });

    observer.observe(mapContainer);
}

function createGymsMap(mapContainer) {
    const gyms = {
        'ivan': { name: 'Зала Иван Вазов', address: 'бул. „Петко Каравелов" 5, София', coords: [42.6875, 23.3181], color: '#A7F3FF' },
        'geo': { name: 'Зала Гео Милев', address: 'ул. „Едисон" 29, София', coords: [42.6841, 23.3567], color: '#5c0909' },
        'silver': { name: 'Зала Силвър Сити', address: 'ул. „Емилиян Станев" 2А, бл. 6, София', coords: [42.6563, 23.2976], color: '#FFD700' }
    };

    const allCoords = Object.values(gyms).map(g => g.coords);
    const bounds = L.latLngBounds(allCoords);

    const map = L.map('gyms-map', { scrollWheelZoom: false, zoomControl: true, dragging: true });
    map.fitBounds(bounds.pad(0.7));

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OSM &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    setTimeout(() => map.invalidateSize(), 100);
    setTimeout(() => { map.invalidateSize(); map.fitBounds(bounds.pad(0.7)); }, 500);

    function createMarkerIcon(color) {
        return L.divIcon({
            className: 'custom-gym-marker',
            html: `<div style="width:24px;height:24px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 4px 16px rgba(0,0,0,0.5);"></div>`,
            iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -12]
        });
    }

    const markers = {};
    const gymKeys = Object.keys(gyms);

    gymKeys.forEach(key => {
        const gym = gyms[key];
        const marker = L.marker(gym.coords, { icon: createMarkerIcon(gym.color) }).addTo(map);
        marker.bindPopup(`<div style="text-align:center;padding:8px;min-width:160px;"><div style="font-size:14px;font-weight:600;margin-bottom:4px;">${gym.name}</div><div style="font-size:12px;color:#666;">${gym.address}</div><a href="contacts.html" style="display:inline-block;margin-top:8px;font-size:12px;color:#5c0909;text-decoration:none;"><i class="fa-solid fa-directions"></i> Виж детайли</a></div>`, { closeButton: false });
        markers[key] = marker;
    });

    // Navigation
    let currentIndex = -1;
    const prevBtn = document.getElementById('mapPrevBtn');
    const nextBtn = document.getElementById('mapNextBtn');
    const navName = document.getElementById('mapNavName');
    const dots = document.querySelectorAll('.nav-dot');

    function updateView(index) {
        currentIndex = index;
        dots.forEach((dot, i) => {
            dot.style.opacity = i === index ? '1' : '0.5';
            dot.style.transform = i === index ? 'scale(1.3)' : 'scale(1)';
        });

        if (index === -1) {
            navName.textContent = 'Всички зали';
            map.fitBounds(bounds.pad(0.7), { duration: 0.5 });
            Object.values(markers).forEach(m => m.closePopup());
        } else {
            const key = gymKeys[index];
            const gym = gyms[key];
            navName.textContent = gym.name;
            map.flyTo(gym.coords, 15, { duration: 0.6 });
            setTimeout(() => markers[key].openPopup(), 300);
        }
    }

    if (prevBtn) prevBtn.addEventListener('click', () => { let i = currentIndex - 1; if (i < -1) i = gymKeys.length - 1; updateView(i); });
    if (nextBtn) nextBtn.addEventListener('click', () => { let i = currentIndex + 1; if (i >= gymKeys.length) i = -1; updateView(i); });
    dots.forEach((dot, i) => dot.addEventListener('click', () => updateView(i)));
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
