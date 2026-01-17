// ==========================================================================
// OVERFIGHT - Admin Panel JavaScript
// ==========================================================================

const API_URL = window.location.origin;

// ==========================================================================
// State
// ==========================================================================
let adminState = {
    token: localStorage.getItem('admin_token'),
    username: localStorage.getItem('admin_username'),
    currentSection: 'news',
    content: null,
    images: [],
    previewMode: false
};

// ==========================================================================
// Initialize
// ==========================================================================
document.addEventListener('DOMContentLoaded', initAdmin);

function initAdmin() {
    createAdminUI();
    bindAdminEvents();

    // If already logged in, verify token
    if (adminState.token) {
        verifyToken();
    }
}

// ==========================================================================
// Create UI Elements
// ==========================================================================
function createAdminUI() {
    // Create padlock trigger
    const trigger = document.createElement('button');
    trigger.className = 'admin-trigger';
    trigger.innerHTML = '<i class="fa-solid fa-lock"></i>';
    trigger.title = 'Admin';
    trigger.id = 'adminTrigger';
    document.body.appendChild(trigger);

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'admin-modal-overlay';
    overlay.id = 'adminOverlay';
    overlay.innerHTML = `
    <div class="admin-auth-modal" id="authModal">
      <h2 id="authTitle">Вход в админ панел</h2>
      <p id="authSubtitle">Въведете данните си за достъп</p>
      
      <form id="authForm">
        <div class="form-group">
          <label>Потребител</label>
          <input type="text" id="authUsername" placeholder="Username" required>
        </div>
        <div class="form-group">
          <label>Парола</label>
          <input type="password" id="authPassword" placeholder="Password" required>
        </div>
        <div class="error-message" id="authError"></div>
        <button type="submit" class="btn btn-primary" id="authSubmit">Вход</button>
      </form>
    </div>
  `;
    document.body.appendChild(overlay);

    // Create admin panel
    const panel = document.createElement('div');
    panel.className = 'admin-panel';
    panel.id = 'adminPanel';
    panel.innerHTML = `
    <aside class="admin-sidebar">
      <div class="admin-sidebar-header">
        <h2><i class="fa-solid fa-shield-halved"></i> Admin</h2>
        <small id="adminUserDisplay"></small>
      </div>
      <nav class="admin-nav">
        <div class="admin-nav-item is-active" data-section="news">
          <i class="fa-solid fa-newspaper"></i> Новини
        </div>
        <div class="admin-nav-item" data-section="trainers">
          <i class="fa-solid fa-users"></i> Треньори
        </div>
        <div class="admin-nav-item" data-section="gyms">
          <i class="fa-solid fa-building"></i> Зали
        </div>
        <div class="admin-nav-item" data-section="schedule">
          <i class="fa-solid fa-calendar"></i> График
        </div>
        <div class="admin-nav-item" data-section="images">
          <i class="fa-solid fa-images"></i> Изображения
        </div>
        <div class="admin-nav-item" data-section="gallery">
          <i class="fa-solid fa-photo-film"></i> Галерия
        </div>
        <div class="admin-nav-item" data-section="settings">
          <i class="fa-solid fa-gear"></i> Настройки
        </div>
      </nav>
      <div class="admin-sidebar-footer">
        <button class="admin-logout-btn" id="adminLogout">
          <i class="fa-solid fa-right-from-bracket"></i> Изход
        </button>
      </div>
    </aside>
    <main class="admin-main">
      <header class="admin-header">
        <button class="admin-mobile-toggle" id="adminMobileToggle" aria-label="Отвори меню">
          <i class="fa-solid fa-bars"></i>
        </button>
        <h1 id="sectionTitle">Новини</h1>
        <div class="admin-header-actions">
          <button class="admin-preview-btn" id="previewToggleBtn" title="Режим преглед">
            <i class="fa-solid fa-eye"></i>
            <span>Преглед</span>
          </button>
          <button class="admin-publish-btn" id="publishAllBtn" style="display:none;" title="Публикувай всичко">
            <i class="fa-solid fa-upload"></i>
            <span>Публикувай</span>
          </button>
          <button class="admin-add-btn" id="addItemBtn" style="display:none;">
            <i class="fa-solid fa-plus"></i> Добави
          </button>
        </div>
      </header>
      <div class="admin-content" id="adminContent">
        <!-- Dynamic content -->
      </div>
    </main>
    <div class="admin-sidebar-overlay" id="adminSidebarOverlay"></div>
  `;
    document.body.appendChild(panel);
}

// ==========================================================================
// Event Bindings
// ==========================================================================
function bindAdminEvents() {
    // Padlock trigger
    document.getElementById('adminTrigger')?.addEventListener('click', openAuthModal);

    // Close overlay on click outside
    document.getElementById('adminOverlay')?.addEventListener('click', (e) => {
        if (e.target.id === 'adminOverlay') closeAuthModal();
    });

    // Auth form submit
    document.getElementById('authForm')?.addEventListener('submit', handleAuth);

    // Nav items
    document.querySelectorAll('.admin-nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const section = item.dataset.section;
            setActiveSection(section);
            // Close mobile sidebar on nav click
            closeMobileSidebar();
        });
    });

    // Logout
    document.getElementById('adminLogout')?.addEventListener('click', logout);

    // ESC to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAuthModal();
            closeMobileSidebar();
        }
    });

    // Mobile sidebar toggle
    document.getElementById('adminMobileToggle')?.addEventListener('click', toggleMobileSidebar);
    document.getElementById('adminSidebarOverlay')?.addEventListener('click', closeMobileSidebar);

    // Preview mode toggle
    document.getElementById('previewToggleBtn')?.addEventListener('click', togglePreviewMode);
    document.getElementById('publishAllBtn')?.addEventListener('click', publishAllDrafts);
}

// Preview mode functions
async function togglePreviewMode() {
    try {
        const res = await apiRequest('/api/preview/toggle', 'POST');
        adminState.previewMode = res.previewMode;
        updatePreviewUI();
    } catch (err) {
        console.error('Failed to toggle preview mode:', err);
    }
}

async function publishAllDrafts() {
    if (!confirm('Сигурни ли сте, че искате да публикувате всички промени?')) return;

    try {
        await apiRequest('/api/preview/publish', 'POST');
        adminState.previewMode = false;
        updatePreviewUI();
        await fetchContent();
        renderCurrentSection();
        alert('Всички промени бяха публикувани успешно!');
    } catch (err) {
        console.error('Failed to publish:', err);
        alert('Грешка при публикуване');
    }
}

function updatePreviewUI() {
    const toggleBtn = document.getElementById('previewToggleBtn');
    const publishBtn = document.getElementById('publishAllBtn');

    if (toggleBtn) {
        toggleBtn.classList.toggle('is-active', adminState.previewMode);
        toggleBtn.innerHTML = adminState.previewMode
            ? '<i class="fa-solid fa-eye-slash"></i><span>Спри преглед</span>'
            : '<i class="fa-solid fa-eye"></i><span>Преглед</span>';
    }

    if (publishBtn) {
        publishBtn.style.display = adminState.previewMode ? 'flex' : 'none';
    }
}

// Mobile sidebar functions
function toggleMobileSidebar() {
    const sidebar = document.querySelector('.admin-sidebar');
    const overlay = document.getElementById('adminSidebarOverlay');
    sidebar?.classList.toggle('is-open');
    overlay?.classList.toggle('is-open');
}

function closeMobileSidebar() {
    const sidebar = document.querySelector('.admin-sidebar');
    const overlay = document.getElementById('adminSidebarOverlay');
    sidebar?.classList.remove('is-open');
    overlay?.classList.remove('is-open');
}

// ==========================================================================
// Auth Modal
// ==========================================================================
async function openAuthModal() {
    // Check if registration is needed
    const status = await checkAuthStatus();

    const overlay = document.getElementById('adminOverlay');
    const title = document.getElementById('authTitle');
    const subtitle = document.getElementById('authSubtitle');
    const submit = document.getElementById('authSubmit');

    if (status.registrationAvailable && !status.hasAdmin) {
        title.textContent = 'Регистрация на администратор';
        subtitle.textContent = 'Създайте първия администраторски акаунт';
        submit.textContent = 'Регистрация';
        submit.dataset.mode = 'register';
    } else {
        title.textContent = 'Вход в админ панел';
        subtitle.textContent = 'Въведете данните си за достъп';
        submit.textContent = 'Вход';
        submit.dataset.mode = 'login';
    }

    overlay.classList.add('is-open');
    document.getElementById('authUsername').focus();
}

function closeAuthModal() {
    document.getElementById('adminOverlay').classList.remove('is-open');
    document.getElementById('authForm').reset();
    hideError();
}

// ==========================================================================
// API Calls
// ==========================================================================
async function checkAuthStatus() {
    try {
        const res = await fetch(`${API_URL}/auth/status`);
        return await res.json();
    } catch (error) {
        console.error('Auth status error:', error);
        return { registrationAvailable: false, hasAdmin: true };
    }
}

async function handleAuth(e) {
    e.preventDefault();

    const username = document.getElementById('authUsername').value.trim();
    const password = document.getElementById('authPassword').value;
    const mode = document.getElementById('authSubmit').dataset.mode || 'login';

    if (!username || !password) {
        showError('Моля, попълнете всички полета');
        return;
    }

    try {
        const endpoint = mode === 'register' ? '/auth/register' : '/auth/login';
        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (!res.ok) {
            showError(data.error || 'Грешка при влизане');
            return;
        }

        // Save token
        adminState.token = data.token;
        adminState.username = data.username;
        localStorage.setItem('admin_token', data.token);
        localStorage.setItem('admin_username', data.username);

        closeAuthModal();
        openAdminPanel();
    } catch (error) {
        showError('Сървърът не е достъпен');
        console.error('Auth error:', error);
    }
}

async function verifyToken() {
    try {
        const res = await fetch(`${API_URL}/auth/verify`, {
            headers: { 'Authorization': `Bearer ${adminState.token}` }
        });

        if (!res.ok) {
            logout();
        }
    } catch (error) {
        console.error('Token verify error:', error);
    }
}

async function fetchContent() {
    try {
        const res = await fetch(`${API_URL}/api/content`);
        adminState.content = await res.json();
        return adminState.content;
    } catch (error) {
        console.error('Fetch content error:', error);
        return null;
    }
}

async function fetchImages() {
    try {
        const res = await fetch(`${API_URL}/api/images`, {
            headers: { 'Authorization': `Bearer ${adminState.token}` }
        });
        adminState.images = await res.json();
        return adminState.images;
    } catch (error) {
        console.error('Fetch images error:', error);
        return [];
    }
}

async function apiRequest(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${adminState.token}`,
            'Content-Type': 'application/json'
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const res = await fetch(`${API_URL}${endpoint}`, options);
    return await res.json();
}

// ==========================================================================
// Admin Panel
// ==========================================================================
async function openAdminPanel() {
    await fetchContent();
    await fetchImages();

    document.getElementById('adminUserDisplay').textContent = `Logged in as: ${adminState.username}`;
    document.getElementById('adminPanel').classList.add('is-open');

    renderSection(adminState.currentSection);
}

function closeAdminPanel() {
    document.getElementById('adminPanel').classList.remove('is-open');
}

function logout() {
    adminState.token = null;
    adminState.username = null;
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_username');
    closeAdminPanel();
}

function setActiveSection(section) {
    adminState.currentSection = section;

    // Update nav
    document.querySelectorAll('.admin-nav-item').forEach(item => {
        item.classList.toggle('is-active', item.dataset.section === section);
    });

    // Update title
    const titles = {
        news: 'Новини',
        trainers: 'Треньори',
        gyms: 'Зали',
        schedule: 'График',
        images: 'Изображения',
        gallery: 'Галерия',
        settings: 'Настройки'
    };
    document.getElementById('sectionTitle').textContent = titles[section] || section;

    // Show/hide add button
    const addBtn = document.getElementById('addItemBtn');
    addBtn.style.display = section === 'news' ? 'flex' : 'none';

    renderSection(section);
}

// ==========================================================================
// Render Sections
// ==========================================================================
function renderSection(section) {
    const container = document.getElementById('adminContent');

    switch (section) {
        case 'news':
            renderNews(container);
            break;
        case 'trainers':
            renderTrainers(container);
            break;
        case 'gyms':
            renderGyms(container);
            break;
        case 'schedule':
            renderSchedule(container);
            break;
        case 'images':
            renderImages(container);
            break;
        case 'gallery':
            renderGallery(container);
            break;
        case 'settings':
            renderSettings(container);
            break;
        default:
            container.innerHTML = '<p>Секцията не е намерена</p>';
    }
}

// ==========================================================================
// News Section
// ==========================================================================
function renderNews(container) {
    const news = adminState.content?.news || [];

    container.innerHTML = `
    <div class="admin-items-grid">
      ${news.map(item => `
        <div class="admin-item" data-id="${item.id}">
          <div class="admin-item-image">
            <img src="${item.image}" alt="${item.title}">
          </div>
          <div class="admin-item-info">
            <h4>${item.title}</h4>
            <p>${item.description.substring(0, 60)}...</p>
          </div>
          <div class="admin-item-actions">
            <button class="admin-btn-sm admin-btn-edit" onclick="editNews('${item.id}')">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="admin-btn-sm admin-btn-delete" onclick="deleteNews('${item.id}')">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

    // Bind add button
    document.getElementById('addItemBtn').onclick = () => showNewsForm();
}

function showNewsForm(newsItem = null) {
    const container = document.getElementById('adminContent');
    const isEdit = !!newsItem;
    const currentImage = newsItem?.image || 'Resources/danokarate.png';

    container.innerHTML = `
    <div class="admin-card">
      <h3>${isEdit ? 'Редактиране' : 'Добавяне'} на новина</h3>
      <form class="admin-form" id="newsForm">
        <div class="form-group">
          <label>Заглавие</label>
          <input type="text" id="newsTitle" value="${newsItem?.title || ''}" required>
        </div>
        <div class="form-group">
          <label>Описание</label>
          <textarea id="newsDescription" required>${newsItem?.description || ''}</textarea>
        </div>
        <div class="form-group">
          <label>Изображение</label>
          <div style="display: flex; gap: 12px; align-items: center;">
            <img id="newsImagePreview" src="${currentImage}" style="width: 100px; height: 70px; object-fit: cover; border-radius: 8px; border: 1px solid var(--glass-border);">
            <input type="hidden" id="newsImage" value="${currentImage}">
            <button type="button" class="btn btn-ghost" onclick="pickNewsImage()">
              <i class="fa-solid fa-image"></i> Избери снимка
            </button>
          </div>
        </div>
        <div class="form-group">
          <label>Линк</label>
          <input type="text" id="newsLink" value="${newsItem?.link || '#'}">
        </div>
        <div class="form-group">
          <label>Текст на бутона</label>
          <input type="text" id="newsLinkText" value="${newsItem?.linkText || 'Виж повече'}">
        </div>
        <input type="hidden" id="newsId" value="${newsItem?.id || ''}">
        <div class="admin-form-actions">
          <button type="button" class="btn btn-ghost" onclick="renderSection('news')">Отказ</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Запази' : 'Добави'}</button>
        </div>
      </form>
    </div>
  `;

    document.getElementById('newsForm').onsubmit = saveNews;
}

function pickNewsImage() {
    showImagePickerModal((path) => {
        document.getElementById('newsImage').value = path;
        document.getElementById('newsImagePreview').src = path;
    });
}

async function saveNews(e) {
    e.preventDefault();

    const id = document.getElementById('newsId').value;
    const data = {
        title: document.getElementById('newsTitle').value,
        description: document.getElementById('newsDescription').value,
        image: document.getElementById('newsImage').value,
        link: document.getElementById('newsLink').value,
        linkText: document.getElementById('newsLinkText').value
    };

    const endpoint = id ? `/api/news/${id}` : '/api/news';
    const method = id ? 'PUT' : 'POST';

    await apiRequest(endpoint, method, data);
    await fetchContent();
    renderSection('news');
}

async function editNews(id) {
    const item = adminState.content.news.find(n => n.id === id);
    if (item) showNewsForm(item);
}

async function deleteNews(id) {
    if (!confirm('Сигурни ли сте, че искате да изтриете тази новина?')) return;

    await apiRequest(`/api/news/${id}`, 'DELETE');
    await fetchContent();
    renderSection('news');
}

// ==========================================================================
// Trainers Section
// ==========================================================================
function renderTrainers(container) {
    const trainers = adminState.content?.trainers || [];

    container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <p style="color: var(--text-muted);">Управление на треньори. Кликнете за редакция или добавете нов.</p>
      <button class="admin-add-btn" onclick="showAddTrainerForm()">
        <i class="fa-solid fa-plus"></i> Добави треньор
      </button>
    </div>
    <div class="admin-items-grid">
      ${trainers.map(item => `
        <div class="admin-item" data-id="${item.id}">
          <div class="admin-item-image">
            <img src="${item.image}" alt="${item.name}">
          </div>
          <div class="admin-item-info">
            <h4>${item.name}</h4>
            <p>${item.dan} • ${item.role}</p>
          </div>
          <div class="admin-item-actions">
            <button class="admin-btn-sm admin-btn-edit" onclick="editTrainer('${item.id}')">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="admin-btn-sm admin-btn-delete" onclick="deleteTrainer('${item.id}')">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      `).join('')}
    </div>
    
    <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--glass-border);">
      <button class="btn btn-ghost" onclick="showTrainerBackups()" style="font-size: 13px;">
        <i class="fa-solid fa-archive"></i> Изтрити треньори (резервни копия)
      </button>
    </div>
  `;
}

function showAddTrainerForm() {
    showTrainerForm(null);
}

function editTrainer(id) {
    const item = adminState.content.trainers.find(t => t.id === id);
    if (item) showTrainerForm(item);
}

function showTrainerForm(trainer) {
    const isEdit = !!trainer;
    const container = document.getElementById('adminContent');

    // Default values for new trainer
    const t = trainer || {
        name: '',
        shortName: '',
        dan: 'I дан',
        role: 'Треньор',
        image: 'Resources/logo.png',
        bio: [''],
        contributions: ['']
    };

    container.innerHTML = `
    <button class="btn btn-ghost" onclick="renderSection('trainers')" style="margin-bottom: 16px;">
      <i class="fa-solid fa-arrow-left"></i> Назад
    </button>
    
    <div class="admin-card">
      <h3>${isEdit ? 'Редактиране на' : 'Добавяне на'} треньор</h3>
      <form class="admin-form" id="trainerForm">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div class="form-group">
            <label>Пълно име (с титла)</label>
            <input type="text" id="trainerName" value="${t.name}" placeholder="Сенсей Иво Мукански" required>
          </div>
          <div class="form-group">
            <label>Кратко име</label>
            <input type="text" id="trainerShortName" value="${t.shortName || ''}" placeholder="Иво Мукански">
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div class="form-group">
            <label>Дан</label>
            <select id="trainerDan" style="width:100%; padding: 10px; background: var(--bg-secondary); border: 1px solid var(--glass-border); border-radius: 6px; color: var(--text-primary);">
              <option ${t.dan === 'I дан' ? 'selected' : ''}>I дан</option>
              <option ${t.dan === 'II дан' ? 'selected' : ''}>II дан</option>
              <option ${t.dan === 'III дан' ? 'selected' : ''}>III дан</option>
              <option ${t.dan === 'IV дан' ? 'selected' : ''}>IV дан</option>
              <option ${t.dan === 'V дан' ? 'selected' : ''}>V дан</option>
            </select>
          </div>
          <div class="form-group">
            <label>Роля</label>
            <input type="text" id="trainerRole" value="${t.role}" placeholder="Главен треньор">
          </div>
        </div>
        
        <div class="form-group">
          <label>Снимка</label>
          <div style="display: flex; gap: 12px; align-items: center;">
            <img id="trainerImagePreview" src="${t.image}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid var(--glass-border);">
            <input type="hidden" id="trainerImage" value="${t.image}">
            <button type="button" class="btn btn-ghost" onclick="pickTrainerImage()">
              <i class="fa-solid fa-image"></i> Избери снимка
            </button>
          </div>
        </div>
        
        <div class="form-group">
          <label>Биография (параграфи)</label>
          <div id="bioParagraphs">
            ${(t.bio || []).map((p, i) => `
              <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                <textarea class="bio-input" rows="2" style="flex: 1; padding: 10px; background: var(--bg-secondary); border: 1px solid var(--glass-border); border-radius: 6px; color: var(--text-primary); resize: vertical;">${p}</textarea>
                <button type="button" class="admin-btn-sm admin-btn-delete" onclick="removeBioParagraph(this)"><i class="fa-solid fa-minus"></i></button>
              </div>
            `).join('')}
          </div>
          <button type="button" class="btn btn-ghost" onclick="addBioParagraph()" style="font-size: 13px;">
            <i class="fa-solid fa-plus"></i> Добави параграф
          </button>
        </div>
        
        <div class="form-group">
          <label>Роля и принос (списък)</label>
          <div id="contributionsList">
            ${(t.contributions || []).map((c, i) => `
              <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                <input type="text" class="contrib-input" value="${c}" style="flex: 1; padding: 10px; background: var(--bg-secondary); border: 1px solid var(--glass-border); border-radius: 6px; color: var(--text-primary);">
                <button type="button" class="admin-btn-sm admin-btn-delete" onclick="removeContribution(this)"><i class="fa-solid fa-minus"></i></button>
              </div>
            `).join('')}
          </div>
          <button type="button" class="btn btn-ghost" onclick="addContribution()" style="font-size: 13px;">
            <i class="fa-solid fa-plus"></i> Добави принос
          </button>
        </div>
        
        <input type="hidden" id="trainerId" value="${trainer?.id || ''}">
        <div class="admin-form-actions">
          <button type="button" class="btn btn-ghost" onclick="renderSection('trainers')">Отказ</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Запази' : 'Създай'}</button>
        </div>
      </form>
    </div>
  `;

    document.getElementById('trainerForm').onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('trainerId').value;

        // Collect bio paragraphs
        const bio = Array.from(document.querySelectorAll('.bio-input')).map(el => el.value.trim()).filter(v => v);
        // Collect contributions
        const contributions = Array.from(document.querySelectorAll('.contrib-input')).map(el => el.value.trim()).filter(v => v);

        const data = {
            name: document.getElementById('trainerName').value,
            shortName: document.getElementById('trainerShortName').value,
            dan: document.getElementById('trainerDan').value,
            role: document.getElementById('trainerRole').value,
            image: document.getElementById('trainerImage').value,
            bio,
            contributions
        };

        if (id) {
            await apiRequest(`/api/trainers/${id}`, 'PUT', data);
        } else {
            await apiRequest('/api/trainers', 'POST', data);
        }
        await fetchContent();
        renderSection('trainers');
    };
}

function pickTrainerImage() {
    showImagePickerModal((path) => {
        document.getElementById('trainerImage').value = path;
        document.getElementById('trainerImagePreview').src = path;
    });
}

function addBioParagraph() {
    const container = document.getElementById('bioParagraphs');
    const div = document.createElement('div');
    div.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px;';
    div.innerHTML = `
      <textarea class="bio-input" rows="2" style="flex: 1; padding: 10px; background: var(--bg-secondary); border: 1px solid var(--glass-border); border-radius: 6px; color: var(--text-primary); resize: vertical;"></textarea>
      <button type="button" class="admin-btn-sm admin-btn-delete" onclick="removeBioParagraph(this)"><i class="fa-solid fa-minus"></i></button>
    `;
    container.appendChild(div);
}

function removeBioParagraph(btn) {
    btn.parentElement.remove();
}

function addContribution() {
    const container = document.getElementById('contributionsList');
    const div = document.createElement('div');
    div.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px;';
    div.innerHTML = `
      <input type="text" class="contrib-input" style="flex: 1; padding: 10px; background: var(--bg-secondary); border: 1px solid var(--glass-border); border-radius: 6px; color: var(--text-primary);">
      <button type="button" class="admin-btn-sm admin-btn-delete" onclick="removeContribution(this)"><i class="fa-solid fa-minus"></i></button>
    `;
    container.appendChild(div);
}

function removeContribution(btn) {
    btn.parentElement.remove();
}

async function deleteTrainer(id) {
    if (!confirm('Сигурни ли сте? Треньорът ще бъде преместен в резервно копие за 60 дни.')) return;

    await apiRequest(`/api/trainers/${id}`, 'DELETE');
    await fetchContent();
    renderSection('trainers');
}

async function showTrainerBackups() {
    const container = document.getElementById('adminContent');
    container.innerHTML = '<p style="color: var(--text-muted);">Зареждане на резервни копия...</p>';

    try {
        const res = await fetch(`${API_URL}/api/trainers/backups`, {
            headers: { 'Authorization': `Bearer ${adminState.token}` }
        });
        const backups = await res.json();

        container.innerHTML = `
        <button class="btn btn-ghost" onclick="renderSection('trainers')" style="margin-bottom: 16px;">
          <i class="fa-solid fa-arrow-left"></i> Назад към треньори
        </button>
        
        <div class="admin-card">
          <h3><i class="fa-solid fa-archive"></i> Изтрити треньори</h3>
          <p style="color: var(--text-muted); margin-bottom: 16px;">Резервни копия се пазят 60 дни след изтриване.</p>
          
          ${backups.length === 0 ? '<p style="color: var(--text-muted);">Няма изтрити треньори.</p>' : `
            <div class="admin-items-grid">
              ${backups.map(b => `
                <div class="admin-item">
                  <div class="admin-item-image">
                    <img src="${b.image}" alt="${b.name}">
                  </div>
                  <div class="admin-item-info">
                    <h4>${b.name}</h4>
                    <p style="color: var(--text-muted); font-size: 12px;">Изтрит: ${new Date(b.deletedAt).toLocaleDateString('bg-BG')}</p>
                  </div>
                  <div class="admin-item-actions" style="flex-direction: column; gap: 4px;">
                    <button class="admin-btn-sm admin-btn-edit" onclick="restoreTrainer('${b.id}')" title="Възстанови">
                      <i class="fa-solid fa-rotate-left"></i>
                    </button>
                    <button class="admin-btn-sm admin-btn-delete" onclick="forceDeleteTrainer('${b.id}')" title="Изтрий завинаги">
                      <i class="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      `;
    } catch (err) {
        container.innerHTML = '<p style="color: var(--brand-red);">Грешка при зареждане.</p>';
    }
}

async function restoreTrainer(id) {
    if (!confirm('Възстановяване на треньора?')) return;

    await apiRequest(`/api/trainers/${id}/restore`, 'POST');
    await fetchContent();
    renderSection('trainers');
}

async function forceDeleteTrainer(id) {
    if (!confirm('ВНИМАНИЕ: Това ще изтрие треньора завинаги! Сигурни ли сте?')) return;

    await apiRequest(`/api/trainers/${id}/force`, 'DELETE');
    showTrainerBackups();
}

// ==========================================================================
// Gyms Section
// ==========================================================================
function renderGyms(container) {
    const gyms = adminState.content?.gyms || [];

    container.innerHTML = `
    <div class="admin-items-grid">
      ${gyms.map(item => `
        <div class="admin-item" data-id="${item.id}">
          <div class="admin-item-image">
            <img src="${item.image}" alt="${item.name}">
          </div>
          <div class="admin-item-info">
            <h4>${item.name}</h4>
            <p>${item.address}</p>
          </div>
          <div class="admin-item-actions">
            <button class="admin-btn-sm admin-btn-edit" onclick="editGym('${item.id}')">
              <i class="fa-solid fa-pen"></i>
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function editGym(id) {
    const item = adminState.content.gyms.find(g => g.id === id);
    if (!item) return;

    const container = document.getElementById('adminContent');
    container.innerHTML = `
    <div class="admin-card">
      <h3>Редактиране на ${item.name}</h3>
      <form class="admin-form" id="gymForm">
        <div class="form-group">
          <label>Име на залата</label>
          <input type="text" id="gymName" value="${item.name}" required>
        </div>
        <div class="form-group">
          <label>Описание</label>
          <input type="text" id="gymDescription" value="${item.description}">
        </div>
        <div class="form-group">
          <label>Адрес</label>
          <input type="text" id="gymAddress" value="${item.address}">
        </div>
        <div class="form-group">
          <label>Изображение</label>
          <div style="display: flex; gap: 12px; align-items: center;">
            <img id="gymImagePreview" src="${item.image}" style="width: 100px; height: 70px; object-fit: cover; border-radius: 8px; border: 1px solid var(--glass-border);">
            <input type="hidden" id="gymImage" value="${item.image}">
            <button type="button" class="btn btn-ghost" onclick="pickGymImage()">
              <i class="fa-solid fa-image"></i> Избери снимка
            </button>
          </div>
        </div>
        <div class="form-group">
          <label>Характеристики (разделени със запетая)</label>
          <input type="text" id="gymFeatures" value="${item.features?.join(', ') || ''}">
        </div>
        <input type="hidden" id="gymId" value="${item.id}">
        <div class="admin-form-actions">
          <button type="button" class="btn btn-ghost" onclick="renderSection('gyms')">Отказ</button>
          <button type="submit" class="btn btn-primary">Запази</button>
        </div>
      </form>
    </div>
  `;

    document.getElementById('gymForm').onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('gymId').value;
        const data = {
            name: document.getElementById('gymName').value,
            description: document.getElementById('gymDescription').value,
            address: document.getElementById('gymAddress').value,
            image: document.getElementById('gymImage').value,
            features: document.getElementById('gymFeatures').value.split(',').map(f => f.trim())
        };
        await apiRequest(`/api/gyms/${id}`, 'PUT', data);
        await fetchContent();
        renderSection('gyms');
    };
}

function pickGymImage() {
    showImagePickerModal((path) => {
        document.getElementById('gymImage').value = path;
        document.getElementById('gymImagePreview').src = path;
    });
}

// ==========================================================================
// Schedule Section
// ==========================================================================
function renderSchedule(container) {
    const schedule = adminState.content?.schedule || {};

    container.innerHTML = `
    <div class="admin-items-grid">
      ${Object.entries(schedule).map(([key, item]) => `
        <div class="admin-card">
          <div class="admin-card-header">
            <h3>${item.name}</h3>
            <button class="admin-btn-sm admin-btn-edit" onclick="editSchedule('${key}')">
              <i class="fa-solid fa-pen"></i> Редактирай
            </button>
          </div>
          <table style="width: 100%;">
            ${item.days?.map(d => `
              <tr>
                <td style="padding: 8px; color: var(--text-secondary);">${d.day}</td>
                <td style="padding: 8px;">${d.time}</td>
              </tr>
            `).join('')}
          </table>
        </div>
      `).join('')}
    </div>
  `;
}

function editSchedule(gymKey) {
    const item = adminState.content.schedule[gymKey];
    if (!item) return;

    const container = document.getElementById('adminContent');
    container.innerHTML = `
    <div class="admin-card">
      <h3>Редактиране на график: ${item.name}</h3>
      <form class="admin-form" id="scheduleForm">
        <div class="form-group">
          <label>Име на залата</label>
          <input type="text" id="scheduleName" value="${item.name}" required>
        </div>
        <div id="daysList">
          ${item.days?.map((d, i) => `
            <div class="form-group" style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px;">
              <input type="text" name="day_${i}" value="${d.day}" placeholder="Ден">
              <input type="text" name="time_${i}" value="${d.time}" placeholder="Час">
              <button type="button" class="admin-btn-sm admin-btn-delete" onclick="this.parentElement.remove()">
                <i class="fa-solid fa-minus"></i>
              </button>
            </div>
          `).join('')}
        </div>
        <button type="button" class="btn btn-ghost" onclick="addScheduleDay()">
          <i class="fa-solid fa-plus"></i> Добави ден
        </button>
        <input type="hidden" id="scheduleKey" value="${gymKey}">
        <div class="admin-form-actions">
          <button type="button" class="btn btn-ghost" onclick="renderSection('schedule')">Отказ</button>
          <button type="submit" class="btn btn-primary">Запази</button>
        </div>
      </form>
    </div>
  `;

    document.getElementById('scheduleForm').onsubmit = async (e) => {
        e.preventDefault();
        const key = document.getElementById('scheduleKey').value;
        const form = document.getElementById('scheduleForm');
        const days = [];

        document.querySelectorAll('#daysList .form-group').forEach((group, i) => {
            const day = group.querySelector(`input[name="day_${i}"]`);
            const time = group.querySelector(`input[name="time_${i}"]`);
            if (day?.value && time?.value) {
                days.push({ day: day.value, time: time.value });
            }
        });

        const data = {
            name: document.getElementById('scheduleName').value,
            days
        };

        await apiRequest(`/api/schedule/${key}`, 'PUT', data);
        await fetchContent();
        renderSection('schedule');
    };
}

function addScheduleDay() {
    const list = document.getElementById('daysList');
    const count = list.children.length;
    const div = document.createElement('div');
    div.className = 'form-group';
    div.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px;';
    div.innerHTML = `
    <input type="text" name="day_${count}" placeholder="Ден">
    <input type="text" name="time_${count}" placeholder="Час">
    <button type="button" class="admin-btn-sm admin-btn-delete" onclick="this.parentElement.remove()">
      <i class="fa-solid fa-minus"></i>
    </button>
  `;
    list.appendChild(div);
}

// ==========================================================================
// Images Section
// ==========================================================================
function renderImages(container) {
    container.innerHTML = `
    <div class="admin-card">
      <h3>Качване на изображение</h3>
      <form id="uploadForm" class="admin-form" enctype="multipart/form-data">
        <div class="form-group">
          <label>Избери файл</label>
          <input type="file" id="imageFile" accept="image/*" required>
        </div>
        <div class="form-group">
          <label>Име на файла (без разширение)</label>
          <input type="text" id="customName" placeholder="Оставете празно за автоматично име">
        </div>
        <button type="submit" class="btn btn-primary">Качи</button>
      </form>
    </div>
    
    <h3 style="margin: 24px 0 16px;">Налични изображения</h3>
    <div class="admin-image-picker">
      ${adminState.images.map(img => `
        <div class="admin-image-option" onclick="copyImagePath('${img.path}')">
          <img src="${img.path}" alt="${img.name}">
        </div>
      `).join('')}
    </div>
    <p style="margin-top: 12px; color: var(--text-muted); font-size: 13px;">
      Кликни върху изображение за да копираш пътя му
    </p>
  `;

    document.getElementById('uploadForm').onsubmit = async (e) => {
        e.preventDefault();

        const formData = new FormData();
        formData.append('image', document.getElementById('imageFile').files[0]);
        formData.append('customName', document.getElementById('customName').value);

        const res = await fetch(`${API_URL}/api/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${adminState.token}` },
            body: formData
        });

        if (res.ok) {
            await fetchImages();
            renderSection('images');
            alert('Изображението е качено успешно!');
        } else {
            alert('Грешка при качване!');
        }
    };
}

function copyImagePath(path) {
    navigator.clipboard.writeText(path);
    alert(`Копирано: ${path}`);
}

// ==========================================================================
// Settings Section
// ==========================================================================
function renderSettings(container) {
    const info = adminState.content?.siteInfo || {};

    container.innerHTML = `
    <div class="admin-card">
      <h3>Информация за сайта</h3>
      <form class="admin-form" id="settingsForm">
        <div class="form-group">
          <label>Име на клуба</label>
          <input type="text" id="clubName" value="${info.clubName || ''}">
        </div>
        <div class="form-group">
          <label>Телефон</label>
          <input type="text" id="phone" value="${info.phone || ''}">
        </div>
        <div class="form-group">
          <label>Имейл</label>
          <input type="email" id="email" value="${info.email || ''}">
        </div>
        <div class="form-group">
          <label>Президент</label>
          <input type="text" id="president" value="${info.president || ''}">
        </div>
        <button type="submit" class="btn btn-primary">Запази</button>
      </form>
    </div>
  `;

    document.getElementById('settingsForm').onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            clubName: document.getElementById('clubName').value,
            phone: document.getElementById('phone').value,
            email: document.getElementById('email').value,
            president: document.getElementById('president').value
        };
        await apiRequest('/api/siteInfo', 'PUT', data);
        await fetchContent();
        alert('Настройките са запазени!');
    };
}

// ==========================================================================
// Gallery Section
// ==========================================================================
function renderGallery(container) {
    const gallery = adminState.content?.gallery || {};

    container.innerHTML = `
    <p style="color: var(--text-muted); margin-bottom: 16px;">Управление на снимки в галериите. Кликнете върху албум за редакция.</p>
    <div class="admin-items-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
      ${Object.entries(gallery).map(([key, album]) => `
        <div class="admin-card" style="cursor: pointer;" onclick="editAlbum('${key}')">
          <div style="display: flex; gap: 16px; align-items: center;">
            <img src="${album.cover}" alt="${album.title}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;">
            <div>
              <h3 style="margin-bottom: 4px;">${album.title}</h3>
              <p style="color: var(--text-muted); font-size: 13px;">${album.subtitle}</p>
              <p style="color: var(--accent-ice); font-size: 12px; margin-top: 4px;">${album.images?.length || 0} снимки</p>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function editAlbum(albumId) {
    const album = adminState.content?.gallery?.[albumId];
    if (!album) return;

    const container = document.getElementById('adminContent');
    container.innerHTML = `
    <button class="btn btn-ghost" onclick="renderSection('gallery')" style="margin-bottom: 16px;">
      <i class="fa-solid fa-arrow-left"></i> Назад към албуми
    </button>
    
    <div class="admin-card" style="margin-bottom: 16px;">
      <h3>${album.title}</h3>
      <p style="color: var(--text-muted);">${album.subtitle}</p>
    </div>
    
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <h4>Снимки в албума</h4>
      <button class="admin-add-btn" onclick="addGalleryImage('${albumId}')">
        <i class="fa-solid fa-plus"></i> Добави снимка
      </button>
    </div>
    
    <div class="admin-items-grid">
      ${album.images?.map(img => `
        <div class="admin-item" style="flex-direction: column; text-align: center;">
          <div style="width: 100%; height: 150px; border-radius: 8px; overflow: hidden; margin-bottom: 8px;">
            <img src="${img.src}" alt="" style="width: 100%; height: 100%; object-fit: cover;">
          </div>
          <input type="text" value="${img.description || ''}" placeholder="Описание..." 
                 style="width: 100%; margin-bottom: 8px; padding: 8px; background: var(--bg-secondary); border: 1px solid var(--glass-border); border-radius: 6px; color: var(--text-primary); font-size: 13px;"
                 onchange="updateImageDescription('${albumId}', '${img.id}', this.value)">
          <button class="admin-btn-sm admin-btn-delete" onclick="deleteGalleryImage('${albumId}', '${img.id}')">
            <i class="fa-solid fa-trash"></i> Изтрий
          </button>
        </div>
      `).join('') || '<p style="color: var(--text-muted);">Няма снимки в този албум</p>'}
    </div>
  `;
}

function addGalleryImage(albumId) {
    showImagePickerModal(async (selectedImage) => {
        await apiRequest(`/api/gallery/${albumId}/images`, 'POST', {
            src: selectedImage,
            description: ''
        });
        await fetchContent();
        editAlbum(albumId);
    });
}

async function updateImageDescription(albumId, imageId, description) {
    await apiRequest(`/api/gallery/${albumId}/images/${imageId}`, 'PUT', { description });
    await fetchContent();
}

async function deleteGalleryImage(albumId, imageId) {
    if (!confirm('Сигурни ли сте, че искате да изтриете тази снимка?')) return;

    await apiRequest(`/api/gallery/${albumId}/images/${imageId}`, 'DELETE');
    await fetchContent();
    editAlbum(albumId);
}

// ==========================================================================
// Image Picker Modal (Enhanced)
// ==========================================================================
function showImagePickerModal(onSelect) {
    // Remove existing modal if any
    const existingModal = document.getElementById('imagePickerModal');
    if (existingModal) existingModal.remove();

    // Group images by date
    const imagesByDate = groupImagesByDate(adminState.images);

    const modal = document.createElement('div');
    modal.id = 'imagePickerModal';
    modal.className = 'admin-modal-overlay is-open';
    modal.innerHTML = `
    <div class="admin-auth-modal image-picker-modal">
      <div class="image-picker-header">
        <h2><i class="fa-solid fa-images"></i> Изберете изображение</h2>
        <button class="btn btn-ghost image-picker-close" onclick="closeImagePickerModal()">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      
      <div class="image-picker-search">
        <i class="fa-solid fa-search"></i>
        <input type="text" id="imagePickerSearch" placeholder="Търси по име...">
      </div>
      
      <div class="image-picker-body" id="imagePickerBody">
        ${renderImageSections(imagesByDate)}
      </div>
      
      <div class="image-picker-footer">
        <button class="btn btn-ghost" onclick="closeImagePickerModal()">Отказ</button>
        <button class="btn btn-primary" onclick="triggerImageUploadFromPicker()">
          <i class="fa-solid fa-upload"></i> Качи ново
        </button>
      </div>
    </div>
  `;

    document.body.appendChild(modal);

    // Bind click events to images
    bindImagePickerEvents(modal, onSelect);

    // Bind search
    const searchInput = document.getElementById('imagePickerSearch');
    searchInput.addEventListener('input', (e) => {
        filterImages(e.target.value);
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeImagePickerModal();
    });

    // Close on Escape
    modal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeImagePickerModal();
    });
}

function groupImagesByDate(images) {
    const groups = {
        today: [],
        thisWeek: [],
        thisMonth: [],
        older: []
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    images.forEach(img => {
        const imgDate = img.dateAdded ? new Date(img.dateAdded) : new Date(0);
        if (imgDate >= today) {
            groups.today.push(img);
        } else if (imgDate >= weekAgo) {
            groups.thisWeek.push(img);
        } else if (imgDate >= monthAgo) {
            groups.thisMonth.push(img);
        } else {
            groups.older.push(img);
        }
    });

    return groups;
}

function renderImageSections(groups) {
    const sections = [];

    if (groups.today.length > 0) {
        sections.push(renderImagePickerSection('Днес', groups.today));
    }
    if (groups.thisWeek.length > 0) {
        sections.push(renderImagePickerSection('Тази седмица', groups.thisWeek));
    }
    if (groups.thisMonth.length > 0) {
        sections.push(renderImagePickerSection('Този месец', groups.thisMonth));
    }
    if (groups.older.length > 0) {
        sections.push(renderImagePickerSection('По-стари', groups.older));
    }

    if (sections.length === 0) {
        return '<p style="color: var(--text-muted); text-align: center; padding: 32px;">Няма качени изображения</p>';
    }

    return sections.join('');
}

function renderImagePickerSection(title, images) {
    return `
        <div class="image-picker-section">
            <h4 class="image-picker-section-title">${title} <span>(${images.length})</span></h4>
            <div class="image-picker-grid">
                ${images.map(img => `
                    <div class="image-picker-item" data-path="${img.path}" data-name="${img.name.toLowerCase()}">
                        <img src="${img.path}" alt="${img.name}" loading="lazy">
                        <div class="image-picker-item-name">${img.name}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function bindImagePickerEvents(modal, onSelect) {
    modal.querySelectorAll('.image-picker-item').forEach(item => {
        item.addEventListener('click', () => {
            const path = item.dataset.path;
            closeImagePickerModal();
            onSelect(path);
        });
    });
}

function filterImages(query) {
    const normalizedQuery = query.toLowerCase().trim();
    const items = document.querySelectorAll('.image-picker-item');

    items.forEach(item => {
        const name = item.dataset.name || '';
        if (name.includes(normalizedQuery) || normalizedQuery === '') {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });

    // Hide empty sections
    document.querySelectorAll('.image-picker-section').forEach(section => {
        const visibleItems = section.querySelectorAll('.image-picker-item:not([style*="display: none"])');
        section.style.display = visibleItems.length > 0 ? '' : 'none';
    });
}

function triggerImageUploadFromPicker() {
    closeImagePickerModal();
    // Switch to images section
    setActiveSection('images');
}

function closeImagePickerModal() {
    const modal = document.getElementById('imagePickerModal');
    if (modal) modal.remove();
}

function renderCurrentSection() {
    renderSection(adminState.currentSection);
}

// ==========================================================================
// Helpers
// ==========================================================================
function showError(message) {
    const el = document.getElementById('authError');
    el.textContent = message;
    el.classList.add('show');
}

function hideError() {
    const el = document.getElementById('authError');
    el.textContent = '';
    el.classList.remove('show');
}

// Make functions available globally for onclick handlers
window.editNews = editNews;
window.deleteNews = deleteNews;
window.editTrainer = editTrainer;
window.deleteTrainer = deleteTrainer;
window.showAddTrainerForm = showAddTrainerForm;
window.showTrainerBackups = showTrainerBackups;
window.restoreTrainer = restoreTrainer;
window.forceDeleteTrainer = forceDeleteTrainer;
window.addBioParagraph = addBioParagraph;
window.removeBioParagraph = removeBioParagraph;
window.addContribution = addContribution;
window.removeContribution = removeContribution;
window.pickTrainerImage = pickTrainerImage;
window.pickNewsImage = pickNewsImage;
window.pickGymImage = pickGymImage;
window.editGym = editGym;
window.editSchedule = editSchedule;
window.addScheduleDay = addScheduleDay;
window.copyImagePath = copyImagePath;
window.renderSection = renderSection;
window.showNewsForm = showNewsForm;
window.editAlbum = editAlbum;
window.addGalleryImage = addGalleryImage;
window.updateImageDescription = updateImageDescription;
window.deleteGalleryImage = deleteGalleryImage;
window.showImagePickerModal = showImagePickerModal;
window.closeImagePickerModal = closeImagePickerModal;
window.triggerImageUploadFromPicker = triggerImageUploadFromPicker;

