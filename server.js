const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const path = require('path');
const { initDb, getDb } = require('./db/setup');

// ─── Async bootstrap ──────────────────────────────────────────────────────────
async function startServer() {
    // 1. Init database (pure-JS sql.js, no native build needed)
    await initDb();
    console.log('✅ Database ready');

    // 2. Seed owner account if first run
    const db = getDb();
    const ownerExists = db.prepare("SELECT id FROM users WHERE username = 'raihan'").get();
    if (!ownerExists) {
        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync('REHANsukaRAISA12#$', 10);
        db.prepare("INSERT INTO users (username, password_hash, role, is_first_login) VALUES (?, ?, 'owner', 0)")
            .run('raihan', hash);

        const tempHash = bcrypt.hashSync('TEMP_LOCKED', 10);
        ['harisal', 'fakhri', 'kaizuran', 'radhi', 'fathir'].forEach(name => {
            db.prepare("INSERT OR IGNORE INTO users (username, password_hash, role, is_first_login) VALUES (?, ?, 'admin', 1)")
                .run(name, tempHash);
        });
        console.log('✅ Default accounts created');
    }

    // ─── Express + HTTP Server ─────────────────────────────────────────────────
    const app = express();
    const server = http.createServer(app);
    const io = new Server(server, { cors: { origin: '*' } });

    // ─── Session ───────────────────────────────────────────────────────────────
    const FileStore = require('session-file-store')(session);
    app.use(session({
        store: new FileStore({ path: path.join(__dirname, 'db', 'sessions'), ttl: 86400, retries: 0 }),
        secret: 'alfityan-secret-key-2026',
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 24 * 60 * 60 * 1000 },
    }));

    // ─── Body Parsers ──────────────────────────────────────────────────────────
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // ─── Static Files ──────────────────────────────────────────────────────────
    app.use(express.static(path.join(__dirname, 'public')));

    // ─── Routes ────────────────────────────────────────────────────────────────
    const authRoutes = require('./routes/auth');
    const apiRoutes = require('./routes/api');
    const adminRoutes = require('./routes/admin');

    app.use('/auth', authRoutes);
    app.use('/api', apiRoutes);
    app.use('/admin/api', adminRoutes);

    // ─── Admin HTML pages ──────────────────────────────────────────────────────
    const { requireAuth, requireNotFirstLogin, requireOwner } = require('./middleware/auth');

    app.get('/admin/dashboard', requireAuth, requireNotFirstLogin, (req, res) => res.sendFile(path.join(__dirname, 'views/admin/dashboard.html')));
    app.get('/admin/students', requireAuth, requireNotFirstLogin, (req, res) => res.sendFile(path.join(__dirname, 'views/admin/students.html')));
    app.get('/admin/assignments', requireAuth, requireNotFirstLogin, (req, res) => res.sendFile(path.join(__dirname, 'views/admin/assignments.html')));
    app.get('/admin/grades', requireAuth, requireNotFirstLogin, (req, res) => res.sendFile(path.join(__dirname, 'views/admin/grades.html')));
    app.get('/admin/forum', requireAuth, requireNotFirstLogin, (req, res) => res.sendFile(path.join(__dirname, 'views/admin/forum.html')));
    app.get('/admin/gallery', requireAuth, requireNotFirstLogin, requireOwner, (req, res) => res.sendFile(path.join(__dirname, 'views/admin/gallery.html')));
    app.get('/admin/logs', requireAuth, requireNotFirstLogin, requireOwner, (req, res) => res.sendFile(path.join(__dirname, 'views/admin/logs.html')));
    app.get('/admin/access', requireAuth, requireNotFirstLogin, requireOwner, (req, res) => res.sendFile(path.join(__dirname, 'views/admin/access.html')));

    // ─── Socket.io Chat ────────────────────────────────────────────────────────
    const onlineUsers = new Map();
    const userColors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4', '#84cc16', '#a78bfa'];
    let colorIdx = 0;

    io.on('connection', socket => {
        socket.on('join', ({ username }) => {
            const color = userColors[(colorIdx++) % userColors.length];
            onlineUsers.set(socket.id, { username, color });
            socket.emit('color_assigned', { color });
            io.emit('online_count', { count: onlineUsers.size });
            io.emit('chat_message', { type: 'system', text: `${username} masuk ke chat 👋`, time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) });
        });

        socket.on('send_message', ({ message }) => {
            const user = onlineUsers.get(socket.id);
            if (!user || !message.trim()) return;
            const db = getDb();
            db.prepare('INSERT INTO chat_messages (username, message, color) VALUES (?, ?, ?)').run(user.username, message.trim(), user.color);
            db.close();
            const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            io.emit('chat_message', { type: 'user', username: user.username, color: user.color, message: message.trim(), time });
        });

        socket.on('disconnect', () => {
            const user = onlineUsers.get(socket.id);
            if (user) {
                onlineUsers.delete(socket.id);
                io.emit('online_count', { count: onlineUsers.size });
                io.emit('chat_message', { type: 'system', text: `${user.username} keluar dari chat`, time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) });
            }
        });
    });

    // ─── Start ─────────────────────────────────────────────────────────────────
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`\n🚀 SMPIT Al-Fityan berjalan di http://localhost:${PORT}`);
        console.log(`   Owner login: raihan / REHANsukaRAISA12#$`);
        console.log(`   Tekan Ctrl+C untuk berhenti.\n`);
    });
}

startServer().catch(err => {
    console.error('❌ Gagal memulai server:', err);
    process.exit(1);
});
