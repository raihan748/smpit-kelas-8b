const express = require('express');
const serverless = require('serverless-http');
const cookieSession = require('cookie-session');
const { initDb, getDb } = require('../../db/setup');

const app = express();

// Cookie-based session (serverless compatible — no file storage needed)
app.use(cookieSession({
    name: 'alfityan_session',
    keys: ['alfityan-secret-key-2026', 'alfityan-backup-key'],
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount routes
app.use('/auth', require('../../routes/auth'));
app.use('/api', require('../../routes/api'));
app.use('/admin/api', require('../../routes/admin'));

let dbReady = false;
const handler = serverless(app);

exports.handler = async (event, context) => {
    if (!dbReady) {
        await initDb();
        // Seed default accounts if first run
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
        }
        dbReady = true;
    }
    return handler(event, context);
};
