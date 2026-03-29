// ==========================================================================
// OVERFIGHT - Backend Server
// ==========================================================================

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Secret key for JWT (in production, use environment variable)
const JWT_SECRET = 'overfight-admin-secret-key-2024';

// ==========================================================================
// Middleware
// ==========================================================================
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Speed Insights Middleware - Inject tracking script into HTML responses
app.use((req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
        // Only modify HTML responses
        if (typeof data === 'string' && data.includes('</body>')) {
            // Inject Speed Insights tracking script before closing body tag
            const speedInsightsScript = `
    <script>
      window.si = window.si || function () { (window.siq = window.siq || []).push(arguments); };
    </script>
    <script defer src="/_vercel/speed-insights/script.js"></script>
  </body>`;
            data = data.replace('</body>', speedInsightsScript);
        }
        
        return originalSend.call(this, data);
    };
    
    next();
});

// File paths
const ADMIN_FILE = path.join(__dirname, 'data', 'admin.json');
const CONTENT_FILE = path.join(__dirname, 'data', 'content.json');

// ==========================================================================
// Helper Functions
// ==========================================================================

// SHA-256 hash with salt
function hashPassword(password, salt = null) {
    salt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.createHash('sha256')
        .update(password + salt)
        .digest('hex');
    return { hash, salt };
}

// Verify password
function verifyPassword(password, storedHash, salt) {
    const { hash } = hashPassword(password, salt);
    return hash === storedHash;
}

// Read JSON file
function readJsonFile(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading file:', filePath, error);
        return null;
    }
}

// Write JSON file
function writeJsonFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error writing file:', filePath, error);
        return false;
    }
}

// Auth middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// ==========================================================================
// Image Upload Configuration
// ==========================================================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'Resources'));
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const name = req.body.customName || `upload-${Date.now()}`;
        cb(null, name + ext);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);
        if (ext && mime) {
            cb(null, true);
        } else {
            cb(new Error('Only image files allowed'));
        }
    }
});

// ==========================================================================
// AUTH ENDPOINTS
// ==========================================================================

// Check if registration is available
app.get('/auth/status', (req, res) => {
    const adminData = readJsonFile(ADMIN_FILE);
    res.json({
        registrationAvailable: !adminData?.registrationLocked,
        hasAdmin: !!adminData?.admin
    });
});

// Register admin (one-time only)
app.post('/auth/register', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const adminData = readJsonFile(ADMIN_FILE);

    if (adminData?.registrationLocked) {
        return res.status(403).json({ error: 'Registration is closed. Admin already exists.' });
    }

    // Hash password
    const { hash, salt } = hashPassword(password);

    // Save admin
    const newAdminData = {
        admin: {
            id: uuidv4(),
            username,
            passwordHash: hash,
            salt,
            createdAt: new Date().toISOString()
        },
        registrationLocked: true
    };

    if (writeJsonFile(ADMIN_FILE, newAdminData)) {
        // Generate token
        const token = jwt.sign(
            { id: newAdminData.admin.id, username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Admin registered successfully',
            token,
            username
        });
    } else {
        res.status(500).json({ error: 'Failed to save admin data' });
    }
});

// Login
app.post('/auth/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    const adminData = readJsonFile(ADMIN_FILE);

    if (!adminData?.admin) {
        return res.status(401).json({ error: 'No admin exists. Please register first.' });
    }

    const { admin } = adminData;

    if (admin.username !== username) {
        return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (!verifyPassword(password, admin.passwordHash, admin.salt)) {
        return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Generate token
    const token = jwt.sign(
        { id: admin.id, username: admin.username },
        JWT_SECRET,
        { expiresIn: '24h' }
    );

    res.json({
        message: 'Login successful',
        token,
        username: admin.username
    });
});

// Verify token
app.get('/auth/verify', authenticateToken, (req, res) => {
    res.json({ valid: true, user: req.user });
});

// ==========================================================================
// CONTENT ENDPOINTS (Protected)
// ==========================================================================

// Get all content (public)
app.get('/api/content', (req, res) => {
    const content = readJsonFile(CONTENT_FILE);
    if (content) {
        res.json(content);
    } else {
        res.status(500).json({ error: 'Failed to load content' });
    }
});

// Get specific content type
app.get('/api/content/:type', (req, res) => {
    const content = readJsonFile(CONTENT_FILE);
    const { type } = req.params;

    if (content && content[type] !== undefined) {
        res.json(content[type]);
    } else {
        res.status(404).json({ error: 'Content type not found' });
    }
});

// Update content (protected)
app.put('/api/content/:type', authenticateToken, (req, res) => {
    const content = readJsonFile(CONTENT_FILE);
    const { type } = req.params;

    if (!content) {
        return res.status(500).json({ error: 'Failed to load content' });
    }

    if (content[type] === undefined) {
        return res.status(404).json({ error: 'Content type not found' });
    }

    content[type] = req.body;

    if (writeJsonFile(CONTENT_FILE, content)) {
        res.json({ message: 'Content updated', data: content[type] });
    } else {
        res.status(500).json({ error: 'Failed to save content' });
    }
});

// ==========================================================================
// NEWS CRUD
// ==========================================================================

// Get all news
app.get('/api/news', (req, res) => {
    const content = readJsonFile(CONTENT_FILE);
    res.json(content?.news || []);
});

// Add news item
app.post('/api/news', authenticateToken, (req, res) => {
    const content = readJsonFile(CONTENT_FILE);
    const { title, description, image, link, linkText } = req.body;

    if (!title || !description) {
        return res.status(400).json({ error: 'Title and description required' });
    }

    const newItem = {
        id: uuidv4(),
        title,
        description,
        image: image || 'Resources/danokarate.png',
        link: link || '#',
        linkText: linkText || 'Виж повече',
        createdAt: new Date().toISOString()
    };

    content.news.push(newItem);

    if (writeJsonFile(CONTENT_FILE, content)) {
        res.json({ message: 'News added', data: newItem });
    } else {
        res.status(500).json({ error: 'Failed to save' });
    }
});

// Update news item
app.put('/api/news/:id', authenticateToken, (req, res) => {
    const content = readJsonFile(CONTENT_FILE);
    const { id } = req.params;
    const index = content.news.findIndex(item => item.id === id);

    if (index === -1) {
        return res.status(404).json({ error: 'News item not found' });
    }

    content.news[index] = { ...content.news[index], ...req.body };

    if (writeJsonFile(CONTENT_FILE, content)) {
        res.json({ message: 'News updated', data: content.news[index] });
    } else {
        res.status(500).json({ error: 'Failed to save' });
    }
});

// Delete news item
app.delete('/api/news/:id', authenticateToken, (req, res) => {
    const content = readJsonFile(CONTENT_FILE);
    const { id } = req.params;
    const index = content.news.findIndex(item => item.id === id);

    if (index === -1) {
        return res.status(404).json({ error: 'News item not found' });
    }

    content.news.splice(index, 1);

    if (writeJsonFile(CONTENT_FILE, content)) {
        res.json({ message: 'News deleted' });
    } else {
        res.status(500).json({ error: 'Failed to save' });
    }
});

// ==========================================================================
// TRAINERS CRUD WITH HTML GENERATION & BACKUP
// ==========================================================================

const TRAINER_BACKUP_DIR = path.join(__dirname, 'data', 'trainer_backups');
const BACKUP_RETENTION_DAYS = 60;

// Ensure backup directory exists
if (!fs.existsSync(TRAINER_BACKUP_DIR)) {
    fs.mkdirSync(TRAINER_BACKUP_DIR, { recursive: true });
}

// Clean expired backups on startup
function cleanExpiredBackups() {
    try {
        const files = fs.readdirSync(TRAINER_BACKUP_DIR);
        const now = Date.now();
        const retentionMs = BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;

        files.filter(f => f.endsWith('.json')).forEach(file => {
            const backupPath = path.join(TRAINER_BACKUP_DIR, file);
            const backup = readJsonFile(backupPath);
            if (backup?.deletedAt) {
                const deletedAt = new Date(backup.deletedAt).getTime();
                if (now - deletedAt > retentionMs) {
                    // Delete backup and associated HTML file
                    fs.unlinkSync(backupPath);
                    const htmlBackup = backupPath.replace('.json', '.html');
                    if (fs.existsSync(htmlBackup)) fs.unlinkSync(htmlBackup);
                    console.log(`Cleaned expired backup: ${file}`);
                }
            }
        });
    } catch (err) {
        console.error('Backup cleanup error:', err);
    }
}
cleanExpiredBackups();

// Generate trainer HTML page
function generateTrainerHTML(trainer) {
    const bioHTML = (trainer.bio || []).map(p => `        <p>${p}</p>`).join('\n\n');
    const contribHTML = (trainer.contributions || []).map(c => `          <li>${c}</li>`).join('\n');

    return `<!DOCTYPE html>
<html lang="bg">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${trainer.name} – ${trainer.role} на карате клуб Overfight" />
  <link rel="icon" href="Resources/logo.png" />
  <title>${trainer.name} | Overfight</title>

  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
    integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA=="
    crossorigin="anonymous" referrerpolicy="no-referrer" />
  <link rel="stylesheet" href="styles.css" />
  <link rel="stylesheet" href="Resources/admin.css" />

  <script type="module" src="Resources/app.js"></script>
  <script type="module" src="Resources/transitions.js"></script>
  <script src="Resources/admin.js" defer></script>
</head>

<body id="top">
  <!-- Header -->
  <header class="site-header">
    <div class="container header-row">
      <a class="brand" href="index.html">
        <img src="Resources/logo.png" alt="Overfight logo" class="brand-logo" />
        <span class="brand-name">Overfight</span>
      </a>

      <button class="nav-toggle" aria-label="Отвори ��еню" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>

      <nav class="nav" aria-label="Главна навигация">
        <ul class="nav-list">
          <li><a href="index.html">НАЧАЛО</a></li>
          <li class="has-dropdown">
            <a href="about.html" class="dropdown-trigger is-active">ЗА КЛУБА</a>
            <ul class="dropdown">
              <li><a href="trainers.html">ТРЕНЬОРИ</a></li>
              <li><a href="about.html">ОПИСАНИЕ</a></li>
              <li><a href="schedule.html">ГРАФИК</a></li>
            </ul>
          </li>
          <li><a href="gallery.html">ГАЛЕРИЯ</a></li>
          <li><a href="contacts.html">КОНТАКТИ</a></li>
          <li><a href="news.html">НОВИНИ</a></li>
          <li><a href="sofiagradprix.html">SOFIA GRAND PRIX</a></li>
        </ul>
      </nav>
    </div>
  </header>

  <!-- Main Content -->
  <main class="container profile-section">
    <div class="profile-header reveal">
      <h1>${trainer.name}</h1>
      <p class="subtitle">
        ${trainer.dan} <i class="fa-solid fa-circle" style="font-size: 0.4em;"></i>
        ${trainer.role} на карате клуб Overfight
      </p>
    </div>

    <div class="profile-content reveal">
      <div class="profile-image">
        <img src="${trainer.image}" alt="${trainer.name}" />
      </div>

      <div class="profile-body">
        <h2>${trainer.shortName || trainer.name}</h2>
        <p><strong>${trainer.dan} <i class="fa-solid fa-circle" style="font-size: 0.4em;"></i> ${trainer.role}</strong></p>

${bioHTML}

        <h3>Роля и принос</h3>
        <ul>
${contribHTML}
        </ul>

        <a href="trainers.html" class="link-back">
          <i class="fa-solid fa-arrow-left"></i> Назад към треньори
        </a>
      </div>
    </div>
  </main>

  <!-- Footer -->
  <footer class="site-footer">
    <div class="container footer-row">
      <div>
        <div class="footer-brand">Карате клуб <strong>Overfight</strong></div>
        <div class="muted">© <span id="y"></span> Всички права запазени.</div>
      </div>

      <nav class="footer-links">
        <a href="about.html">Политика</a>
        <a href="contacts.html">Контакти</a>
        <a href="schedule.html">График</a>
      </nav>

      <div class="social">
        <a class="social-btn" href="https://www.instagram.com/karate.club.overfight/" target="_blank" rel="noopener"
          aria-label="Instagram">
          <svg viewBox="0 0 24 24">
            <path
              d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm10 2H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3zm-5 4a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm5.5-2.2a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z" />
          </svg>
        </a>
        <a class="social-btn" href="https://www.tiktok.com/@karate_overfight" target="_blank" rel="noopener"
          aria-label="TikTok">
          <svg viewBox="0 0 24 24">
            <path
              d="M14 3v10.2a3.8 3.8 0 1 1-3-3.7V7.2a7 7 0 1 0 5 6.7V8.4c1.1 1 2.6 1.6 4 1.6V7.6c-1.6 0-3.1-.9-4-2.2A5.5 5.5 0 0 1 14 3z" />
          </svg>
        </a>
      </div>
    </div>
  </footer>

</body>

</html>`;
}

// Create trainer
app.post('/api/trainers', authenticateToken, (req, res) => {
    const content = readJsonFile(CONTENT_FILE);
    const { name, shortName, dan, role, image, bio, contributions } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Trainer name is required' });
    }

    // Generate filename from name
    const safeName = (shortName || name).replace(/\s+/g, '').replace(/[^a-zA-Zа-яА-Я0-9]/g, '').toUpperCase();
    const page = `trainer${safeName}.html`;

    const newTrainer = {
        id: uuidv4(),
        name,
        shortName: shortName || name.split(' ').slice(-2).join(' '),
        dan: dan || 'I дан',
        role: role || 'Треньор',
        image: image || 'Resources/logo.png',
        page,
        bio: bio || [],
        contributions: contributions || []
    };

    // Generate HTML file
    const htmlContent = generateTrainerHTML(newTrainer);
    const htmlPath = path.join(__dirname, page);


    try {
        fs.writeFileSync(htmlPath, htmlContent, 'utf8');
    } catch (err) {
        return res.status(500).json({ error: 'Failed to create trainer page' });
    }

    content.trainers.push(newTrainer);

    if (writeJsonFile(CONTENT_FILE, content)) {
        res.json({ message: 'Trainer created', data: newTrainer });
    } else {
        // Rollback HTML file
        fs.unlinkSync(htmlPath);
        res.status(500).json({ error: 'Failed to save' });
    }
});

// Update trainer
app.put('/api/trainers/:id', authenticateToken, (req, res) => {
    const content = readJsonFile(CONTENT_FILE);
    const { id } = req.params;
    const index = content.trainers.findIndex(item => item.id === id);

    if (index === -1) {
        return res.status(404).json({ error: 'Trainer not found' });
    }

    const oldPage = content.trainers[index].page;
    content.trainers[index] = { ...content.trainers[index], ...req.body };
    const trainer = content.trainers[index];

    // Regenerate HTML file
    const htmlContent = generateTrainerHTML(trainer);
    const htmlPath = path.join(__dirname, trainer.page);

    try {
        fs.writeFileSync(htmlPath, htmlContent, 'utf8');
        // If page name changed, delete old file
        if (oldPage && oldPage !== trainer.page) {
            const oldPath = path.join(__dirname, oldPage);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
    } catch (err) {
        console.error('Failed to update trainer page:', err);
    }

    if (writeJsonFile(CONTENT_FILE, content)) {
        res.json({ message: 'Trainer updated', data: trainer });
    } else {
        res.status(500).json({ error: 'Failed to save' });
    }
});

// Delete trainer (soft delete with backup)
app.delete('/api/trainers/:id', authenticateToken, (req, res) => {
    const content = readJsonFile(CONTENT_FILE);
    const { id } = req.params;
    const index = content.trainers.findIndex(item => item.id === id);

    if (index === -1) {
        return res.status(404).json({ error: 'Trainer not found' });
    }

    const trainer = content.trainers[index];

    // Create backup
    const backupData = {
        ...trainer,
        deletedAt: new Date().toISOString()
    };
    const backupPath = path.join(TRAINER_BACKUP_DIR, `${trainer.id}.json`);
    writeJsonFile(backupPath, backupData);

    // Backup HTML file
    const htmlPath = path.join(__dirname, trainer.page);
    const htmlBackupPath = path.join(TRAINER_BACKUP_DIR, `${trainer.id}.html`);
    if (fs.existsSync(htmlPath)) {
        fs.copyFileSync(htmlPath, htmlBackupPath);
        fs.unlinkSync(htmlPath);
    }

    // Remove from content
    content.trainers.splice(index, 1);

    if (writeJsonFile(CONTENT_FILE, content)) {
        res.json({ message: 'Trainer deleted (backed up for 60 days)' });
    } else {
        res.status(500).json({ error: 'Failed to save' });
    }
});

// Get trainer backups
app.get('/api/trainers/backups', authenticateToken, (req, res) => {
    try {
        const files = fs.readdirSync(TRAINER_BACKUP_DIR);
        const backups = files
            .filter(f => f.endsWith('.json'))
            .map(f => readJsonFile(path.join(TRAINER_BACKUP_DIR, f)))
            .filter(b => b);
        res.json(backups);
    } catch (err) {
        res.json([]);
    }
});

// Restore trainer from backup
app.post('/api/trainers/:id/restore', authenticateToken, (req, res) => {
    const backupPath = path.join(TRAINER_BACKUP_DIR, `${req.params.id}.json`);
    const htmlBackupPath = path.join(TRAINER_BACKUP_DIR, `${req.params.id}.html`);

    if (!fs.existsSync(backupPath)) {
        return res.status(404).json({ error: 'Backup not found' });
    }

    const backup = readJsonFile(backupPath);
    delete backup.deletedAt;

    const content = readJsonFile(CONTENT_FILE);
    content.trainers.push(backup);

    // Restore HTML file
    const htmlPath = path.join(__dirname, backup.page);
    if (fs.existsSync(htmlBackupPath)) {
        fs.copyFileSync(htmlBackupPath, htmlPath);
    } else {
        // Regenerate if backup doesn't exist
        fs.writeFileSync(htmlPath, generateTrainerHTML(backup), 'utf8');
    }

    if (writeJsonFile(CONTENT_FILE, content)) {
        // Delete backup after restore
        fs.unlinkSync(backupPath);
        if (fs.existsSync(htmlBackupPath)) fs.unlinkSync(htmlBackupPath);
        res.json({ message: 'Trainer restored', data: backup });
    } else {
        res.status(500).json({ error: 'Failed to restore' });
    }
});

// Force delete trainer backup
app.delete('/api/trainers/:id/force', authenticateToken, (req, res) => {
    const backupPath = path.join(TRAINER_BACKUP_DIR, `${req.params.id}.json`);
    const htmlBackupPath = path.join(TRAINER_BACKUP_DIR, `${req.params.id}.html`);

    try {
        if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
        if (fs.existsSync(htmlBackupPath)) fs.unlinkSync(htmlBackupPath);
        res.json({ message: 'Backup permanently deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete backup' });
    }
});

// ==========================================================================
// GYMS CRUD
// ==========================================================================

// Update gym
app.put('/api/gyms/:id', authenticateToken, (req, res) => {
    const content = readJsonFile(CONTENT_FILE);
    const { id } = req.params;
    const index = content.gyms.findIndex(item => item.id === id);

    if (index === -1) {
        return res.status(404).json({ error: 'Gym not found' });
    }

    content.gyms[index] = { ...content.gyms[index], ...req.body };

    if (writeJsonFile(CONTENT_FILE, content)) {
        res.json({ message: 'Gym updated', data: content.gyms[index] });
    } else {
        res.status(500).json({ error: 'Failed to save' });
    }
});

// ==========================================================================
// SCHEDULE CRUD
// ==========================================================================

// Update schedule
app.put('/api/schedule/:gymId', authenticateToken, (req, res) => {
    const content = readJsonFile(CONTENT_FILE);
    const { gymId } = req.params;

    if (!content.schedule[gymId]) {
        return res.status(404).json({ error: 'Schedule not found' });
    }

    content.schedule[gymId] = { ...content.schedule[gymId], ...req.body };

    if (writeJsonFile(CONTENT_FILE, content)) {
        res.json({ message: 'Schedule updated', data: content.schedule[gymId] });
    } else {
        res.status(500).json({ error: 'Failed to save' });
    }
});

// ==========================================================================
// GALLERY CRUD
// ==========================================================================

// Get all gallery albums
app.get('/api/gallery', (req, res) => {
    const content = readJsonFile(CONTENT_FILE);
    res.json(content?.gallery || {});
});

// Get specific gallery album (trenirovki, uspehi, lageri)
app.get('/api/gallery/:albumId', (req, res) => {
    const content = readJsonFile(CONTENT_FILE);
    const { albumId } = req.params;

    if (content?.gallery && content.gallery[albumId]) {
        res.json(content.gallery[albumId]);
    } else {
        res.status(404).json({ error: 'Album not found' });
    }
});

// Update gallery album (protected)
app.put('/api/gallery/:albumId', authenticateToken, (req, res) => {
    const content = readJsonFile(CONTENT_FILE);
    const { albumId } = req.params;

    if (!content.gallery) {
        content.gallery = {};
    }

    if (!content.gallery[albumId]) {
        return res.status(404).json({ error: 'Album not found' });
    }

    content.gallery[albumId] = { ...content.gallery[albumId], ...req.body };

    if (writeJsonFile(CONTENT_FILE, content)) {
        res.json({ message: 'Album updated', data: content.gallery[albumId] });
    } else {
        res.status(500).json({ error: 'Failed to save' });
    }
});

// Add image to album (protected)
app.post('/api/gallery/:albumId/images', authenticateToken, (req, res) => {
    const content = readJsonFile(CONTENT_FILE);
    const { albumId } = req.params;
    const { src, description } = req.body;

    if (!content.gallery?.[albumId]) {
        return res.status(404).json({ error: 'Album not found' });
    }

    const newImage = {
        id: uuidv4(),
        src: src || 'Resources/logo.png',
        description: description || ''
    };

    content.gallery[albumId].images.push(newImage);

    if (writeJsonFile(CONTENT_FILE, content)) {
        res.json({ message: 'Image added', data: newImage });
    } else {
        res.status(500).json({ error: 'Failed to save' });
    }
});

// Delete image from album (protected)
app.delete('/api/gallery/:albumId/images/:imageId', authenticateToken, (req, res) => {
    const content = readJsonFile(CONTENT_FILE);
    const { albumId, imageId } = req.params;

    if (!content.gallery?.[albumId]) {
        return res.status(404).json({ error: 'Album not found' });
    }

    const imageIndex = content.gallery[albumId].images.findIndex(img => img.id === imageId);
    if (imageIndex === -1) {
        return res.status(404).json({ error: 'Image not found' });
    }

    content.gallery[albumId].images.splice(imageIndex, 1);

    if (writeJsonFile(CONTENT_FILE, content)) {
        res.json({ message: 'Image deleted' });
    } else {
        res.status(500).json({ error: 'Failed to save' });
    }
});

// ==========================================================================
// IMAGE UPLOAD
// ==========================================================================

// Upload image
app.post('/api/upload', authenticateToken, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image uploaded' });
    }

    res.json({
        message: 'Image uploaded',
        filename: req.file.filename,
        path: `Resources/${req.file.filename}`
    });
});

// List images in Resources folder with dates
app.get('/api/images', authenticateToken, (req, res) => {
    const resourcesDir = path.join(__dirname, 'Resources');

    fs.readdir(resourcesDir, (err, files) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to list images' });
        }

        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const images = [];

        files.forEach(file => {
            const ext = path.extname(file).toLowerCase();
            if (imageExtensions.includes(ext)) {
                try {
                    const filePath = path.join(resourcesDir, file);
                    const stats = fs.statSync(filePath);
                    images.push({
                        name: file,
                        path: `Resources/${file}`,
                        dateAdded: stats.mtime.toISOString(),
                        size: stats.size
                    });
                } catch (e) {
                    // Skip files we can't stat
                }
            }
        });

        // Sort by date, newest first
        images.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));

        res.json(images);
    });
});

// ==========================================================================
// SITE INFO
// ==========================================================================

// Update site info
app.put('/api/siteInfo', authenticateToken, (req, res) => {
    const content = readJsonFile(CONTENT_FILE);
    content.siteInfo = { ...content.siteInfo, ...req.body };

    if (writeJsonFile(CONTENT_FILE, content)) {
        res.json({ message: 'Site info updated', data: content.siteInfo });
    } else {
        res.status(500).json({ error: 'Failed to save' });
    }
});

// ==========================================================================
// GALLERY CRUD
// ==========================================================================

// Get all gallery albums
app.get('/api/gallery', (req, res) => {
    const content = readJsonFile(CONTENT_FILE);
    res.json(content?.gallery || {});
});

// Get specific album
app.get('/api/gallery/:albumId', (req, res) => {
    const content = readJsonFile(CONTENT_FILE);
    const { albumId } = req.params;

    if (content?.gallery?.[albumId]) {
        res.json(content.gallery[albumId]);
    } else {
        res.status(404).json({ error: 'Album not found' });
    }
});

// Update album metadata
app.put('/api/gallery/:albumId', authenticateToken, (req, res) => {
    const content = readJsonFile(CONTENT_FILE);
    const { albumId } = req.params;

    if (!content?.gallery?.[albumId]) {
        return res.status(404).json({ error: 'Album not found' });
    }

    // Update metadata (don't replace images unless explicitly provided)
    const { title, subtitle, cover } = req.body;
    if (title) content.gallery[albumId].title = title;
    if (subtitle) content.gallery[albumId].subtitle = subtitle;
    if (cover) content.gallery[albumId].cover = cover;

    if (writeJsonFile(CONTENT_FILE, content)) {
        res.json({ message: 'Album updated', data: content.gallery[albumId] });
    } else {
        res.status(500).json({ error: 'Failed to save' });
    }
});

// Add image to album
app.post('/api/gallery/:albumId/images', authenticateToken, (req, res) => {
    const content = readJsonFile(CONTENT_FILE);
    const { albumId } = req.params;
    const { src, description } = req.body;

    if (!content?.gallery?.[albumId]) {
        return res.status(404).json({ error: 'Album not found' });
    }

    if (!src) {
        return res.status(400).json({ error: 'Image source required' });
    }

    const newImage = {
        id: uuidv4(),
        src,
        description: description || ''
    };

    content.gallery[albumId].images.push(newImage);

    if (writeJsonFile(CONTENT_FILE, content)) {
        res.json({ message: 'Image added', data: newImage });
    } else {
        res.status(500).json({ error: 'Failed to save' });
    }
});

// Update image in album
app.put('/api/gallery/:albumId/images/:imageId', authenticateToken, (req, res) => {
    const content = readJsonFile(CONTENT_FILE);
    const { albumId, imageId } = req.params;

    if (!content?.gallery?.[albumId]) {
        return res.status(404).json({ error: 'Album not found' });
    }

    const imageIndex = content.gallery[albumId].images.findIndex(img => img.id === imageId);
    if (imageIndex === -1) {
        return res.status(404).json({ error: 'Image not found' });
    }

    content.gallery[albumId].images[imageIndex] = {
        ...content.gallery[albumId].images[imageIndex],
        ...req.body
    };

    if (writeJsonFile(CONTENT_FILE, content)) {
        res.json({ message: 'Image updated', data: content.gallery[albumId].images[imageIndex] });
    } else {
        res.status(500).json({ error: 'Failed to save' });
    }
});

// Delete image from album
app.delete('/api/gallery/:albumId/images/:imageId', authenticateToken, (req, res) => {
    const content = readJsonFile(CONTENT_FILE);
    const { albumId, imageId } = req.params;

    if (!content?.gallery?.[albumId]) {
        return res.status(404).json({ error: 'Album not found' });
    }

    const imageIndex = content.gallery[albumId].images.findIndex(img => img.id === imageId);
    if (imageIndex === -1) {
        return res.status(404).json({ error: 'Image not found' });
    }

    content.gallery[albumId].images.splice(imageIndex, 1);

    if (writeJsonFile(CONTENT_FILE, content)) {
        res.json({ message: 'Image deleted' });
    } else {
        res.status(500).json({ error: 'Failed to save' });
    }
});

// ==========================================================================
// PREVIEW MODE
// ==========================================================================

// Get preview mode status
app.get('/api/preview', authenticateToken, (req, res) => {
    const content = readJsonFile(CONTENT_FILE);
    res.json({
        previewMode: content?.previewMode || false,
        hasDrafts: !!(content?.drafts && Object.keys(content.drafts).length > 0)
    });
});

// Toggle preview mode
app.post('/api/preview/toggle', authenticateToken, (req, res) => {
    const content = readJsonFile(CONTENT_FILE);
    content.previewMode = !content.previewMode;

    if (writeJsonFile(CONTENT_FILE, content)) {
        res.json({ previewMode: content.previewMode });
    } else {
        res.status(500).json({ error: 'Failed to save' });
    }
});

// Publish all drafts (merge drafts into live content)
app.post('/api/preview/publish', authenticateToken, (req, res) => {
    const content = readJsonFile(CONTENT_FILE);

    if (!content.drafts || Object.keys(content.drafts).length === 0) {
        return res.json({ message: 'No drafts to publish' });
    }

    // Merge drafts into content
    if (content.drafts.news && content.drafts.news.length > 0) {
        content.news = [...(content.news || []), ...content.drafts.news];
    }
    if (content.drafts.trainers && content.drafts.trainers.length > 0) {
        content.trainers = [...(content.trainers || []), ...content.drafts.trainers];
    }
    if (content.drafts.gyms && content.drafts.gyms.length > 0) {
        content.gyms = [...(content.gyms || []), ...content.drafts.gyms];
    }
    if (content.drafts.gallery) {
        content.gallery = { ...(content.gallery || {}), ...content.drafts.gallery };
    }

    // Clear drafts and turn off preview mode
    content.drafts = {};
    content.previewMode = false;

    if (writeJsonFile(CONTENT_FILE, content)) {
        res.json({ message: 'All drafts published successfully' });
    } else {
        res.status(500).json({ error: 'Failed to publish' });
    }
});

// Save as draft instead of live
app.post('/api/drafts/:type', authenticateToken, (req, res) => {
    const content = readJsonFile(CONTENT_FILE);
    const { type } = req.params;

    if (!content.drafts) content.drafts = {};
    if (!content.drafts[type]) content.drafts[type] = Array.isArray(req.body) ? [] : {};

    if (Array.isArray(req.body)) {
        content.drafts[type].push(...req.body);
    } else {
        if (type === 'gallery') {
            content.drafts[type] = { ...content.drafts[type], ...req.body };
        } else {
            content.drafts[type].push(req.body);
        }
    }

    if (writeJsonFile(CONTENT_FILE, content)) {
        res.json({ message: `Draft saved for ${type}`, data: content.drafts[type] });
    } else {
        res.status(500).json({ error: 'Failed to save draft' });
    }
});

// ==========================================================================
// START SERVER
// ==========================================================================
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║           OVERFIGHT SERVER RUNNING                        ║
╠═══════════════════════════════════════════════════════════╣
║   URL: http://localhost:${PORT}                             ║
║   Admin: Click padlock icon in footer                     ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
