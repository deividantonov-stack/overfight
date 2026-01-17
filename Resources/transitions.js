import { initApp } from './app.js';

// Use readyState pattern to handle module loading after DOMContentLoaded
function setupTransitions() {
    // Navigation order: НАЧАЛО → КОНТАКТИ → ЗА КЛУБА → ГАЛЕРИЯ → НОВИНИ → SOFIA GRAND PRIX
    const navOrder = [
        'index.html',
        'contacts.html',
        'about.html',
        'trainers.html',
        'schedule.html',
        'gallery.html',
        'news.html',
        'sofiagradprix.html',
        'competitors.html'
    ];

    // Parent-child relationships for hierarchical navigation
    const pageHierarchy = {
        'trainerDAMYAN.html': 'trainers.html',
        'trainerDEIVID.html': 'trainers.html',
        'trainerIVO.html': 'trainers.html',
        'gallerylageri.html': 'gallery.html',
        'gallerytrenirovki.html': 'gallery.html',
        'galleryuspehi.html': 'gallery.html'
    };

    // Dropdown child pages (vertical navigation - top/bottom)
    const dropdownChildren = {
        'about.html': ['trainers.html', 'about.html', 'schedule.html'],
    };

    // Get effective index for a page
    function getPageIndex(pageName) {
        const directIndex = navOrder.indexOf(pageName);
        if (directIndex !== -1) return { index: directIndex, isChild: false };

        const parent = pageHierarchy[pageName];
        if (parent) {
            const parentIndex = navOrder.indexOf(parent);
            return { index: parentIndex + 0.5, isChild: true, parent };
        }

        return { index: navOrder.length, isChild: false };
    }

    // Check if target is in a dropdown of current page
    function isDropdownNavigation(currentPath, targetPath) {
        for (const [parent, children] of Object.entries(dropdownChildren)) {
            if (children.includes(currentPath) && children.includes(targetPath)) {
                return {
                    isDropdown: true,
                    currentIndex: children.indexOf(currentPath),
                    targetIndex: children.indexOf(targetPath)
                };
            }
        }
        return { isDropdown: false };
    }

    // Determine animation direction
    function getAnimationDirection(currentPath, targetPath) {
        // Same page = no animation
        if (currentPath === targetPath) {
            return 'none';
        }

        // Check dropdown navigation (vertical)
        const dropdown = isDropdownNavigation(currentPath, targetPath);
        if (dropdown.isDropdown) {
            return dropdown.targetIndex < dropdown.currentIndex ? 'up' : 'down';
        }

        const current = getPageIndex(currentPath);
        const target = getPageIndex(targetPath);

        // Child to parent = backward
        if (current.isChild && current.parent === targetPath) {
            return 'backward';
        }

        // Parent to child = forward
        if (target.isChild && target.parent === currentPath) {
            return 'forward';
        }

        // Siblings (same parent)
        if (current.isChild && target.isChild && current.parent === target.parent) {
            return currentPath < targetPath ? 'forward' : 'backward';
        }

        // Standard position-based direction
        return target.index < current.index ? 'backward' : 'forward';
    }

    // Force Scroll Top
    if (history.scrollRestoration) history.scrollRestoration = 'manual';

    // Mobile detection
    function isMobile() {
        return window.innerWidth <= 900;
    }

    // Back Button Logic - Only inject on mobile
    function injectBackButton() {
        const existing = document.getElementById('back-arrow');
        if (existing) existing.remove();

        if (isMobile()) {
            const backBtn = document.createElement('a');
            backBtn.id = 'back-arrow';
            backBtn.href = '#';
            backBtn.ariaLabel = "Go Back";
            backBtn.innerHTML = '<i class="fa-solid fa-arrow-left"></i>';
            document.body.prepend(backBtn);
            backBtn.onclick = (e) => {
                e.preventDefault();
                window.history.back();
            };
        }
    }

    // Update on resize
    window.addEventListener('resize', () => {
        injectBackButton();
    });

    injectBackButton();

    const body = document.body;

    const cleanClasses = () => body.classList.remove(
        'slide-in-right', 'slide-in-left', 'slide-out-left', 'slide-out-right',
        'slide-in-up', 'slide-in-down', 'slide-out-up', 'slide-out-down'
    );

    // Load Content via Fetch
    async function loadPage(url, pushState = true, forceLoad = false) {
        try {
            const targetPath = url.split('/').pop() || 'index.html';
            // Use tracked page instead of window.location (which is already updated on popstate)
            const currentPath = document.body.getAttribute('data-page') || window.location.pathname.split('/').pop() || 'index.html';

            // Skip if same page (unless force loading for back navigation)
            if (currentPath === targetPath && !forceLoad) {
                return;
            }

            const response = await fetch(url);
            if (!response.ok) throw new Error('Network error');
            const text = await response.text();

            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');

            document.title = doc.title;

            // Save admin elements before replacing content
            const adminPanel = document.getElementById('adminPanel');
            const adminOverlay = document.getElementById('adminOverlay');
            const adminTrigger = document.getElementById('adminTrigger');
            const imagePickerModal = document.getElementById('imagePickerModal');

            const savedElements = [];
            if (adminPanel) savedElements.push(adminPanel.cloneNode(true));
            if (adminOverlay) savedElements.push(adminOverlay.cloneNode(true));
            if (adminTrigger) savedElements.push(adminTrigger.cloneNode(true));
            if (imagePickerModal) savedElements.push(imagePickerModal.cloneNode(true));

            const newContent = doc.body.innerHTML;
            const newBodyClass = doc.body.className;

            const direction = getAnimationDirection(currentPath, targetPath);

            // Skip animation if same page
            if (direction === 'none') {
                return;
            }

            let exitClass, enterClass;
            switch (direction) {
                case 'backward':
                    exitClass = 'slide-out-right';
                    enterClass = 'slide-in-left';
                    break;
                case 'forward':
                    exitClass = 'slide-out-left';
                    enterClass = 'slide-in-right';
                    break;
                case 'up':
                    exitClass = 'slide-out-down';
                    enterClass = 'slide-in-up';
                    break;
                case 'down':
                    exitClass = 'slide-out-up';
                    enterClass = 'slide-in-down';
                    break;
                default:
                    exitClass = 'slide-out-left';
                    enterClass = 'slide-in-right';
            }

            // Animate OUT
            body.classList.add(exitClass);

            setTimeout(() => {
                document.body.innerHTML = newContent;
                document.body.className = newBodyClass;
                document.body.setAttribute('data-page', targetPath); // Track current page

                // Restore admin elements
                savedElements.forEach(el => {
                    document.body.appendChild(el);
                });

                injectBackButton();
                initApp();

                cleanClasses();
                body.classList.add(enterClass);

                window.scrollTo(0, 0);

                if (pushState) {
                    window.history.pushState({ path: targetPath }, '', url);
                    localStorage.setItem('prevPath', targetPath);
                }

                // Remove enter animation class after animation completes
                setTimeout(() => {
                    cleanClasses();
                }, 450);

                attachLinkListeners();

            }, 380);

        } catch (err) {
            console.error('Nav Error:', err);
            window.location.href = url;
        }
    }

    // Handle Forward/Back Buttons (including back-arrow)
    window.onpopstate = (event) => {
        // Force load the page from the new URL
        loadPage(window.location.href, false, true);
    };

    // Link Interception
    function attachLinkListeners() {
        document.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', (e) => {
                if (link.hostname !== window.location.hostname ||
                    link.getAttribute('target') === '_blank' ||
                    link.getAttribute('href')?.startsWith('#') ||
                    link.id === 'back-arrow') return;

                const targetPath = link.href.split('/').pop() || 'index.html';
                const currentPath = window.location.pathname.split('/').pop() || 'index.html';

                // Skip if same page
                if (targetPath === currentPath) {
                    e.preventDefault();
                    return;
                }

                e.preventDefault();
                loadPage(link.href);
            });
        });
    }

    attachLinkListeners();
    initApp();

    // Set initial page tracking for back navigation
    const initialPath = window.location.pathname.split('/').pop() || 'index.html';
    document.body.setAttribute('data-page', initialPath);

    // Ensure initial history state is set
    if (!history.state) {
        history.replaceState({ path: initialPath }, '', window.location.href);
    }
}

// Call setupTransitions based on DOM ready state
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupTransitions);
} else {
    // DOM already loaded, run immediately
    setupTransitions();
}
