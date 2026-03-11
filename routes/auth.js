const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/setup');
const router = express.Router();

const SECRET_GATE = 'KELAS2026';

// POST /auth/secret-check — validate secret code gate
router.post('/secret-check', (req, res) => {
    const { code } = req.body;
    if (code === SECRET_GATE) {
        return res.json({ success: true });
    }
    return res.json({ success: false, message: 'Kode rahasia salah! Coba lagi.' });
});

// POST /auth/login
router.post('/login', (req, res) => {
    const { username, password, one_time_code } = req.body;
    const db = getDb();

    try {
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

        if (!user) {
            return res.json({ success: false, message: 'Username tidak ditemukan.' });
        }

        // Owner: login directly with password
        if (user.role === 'owner') {
            const valid = bcrypt.compareSync(password, user.password_hash);
            if (!valid) return res.json({ success: false, message: 'Password salah.' });

            req.session.user = {
                id: user.id,
                username: user.username,
                role: user.role,
                is_first_login: user.is_first_login,
            };
            return res.json({ success: true, redirect: '/admin/dashboard' });
        }

        // Regular admin — must have a valid one-time code for first login
        if (user.is_first_login) {
            if (!one_time_code) {
                return res.json({ success: false, message: 'Masukkan kode akses yang diberikan Owner.' });
            }

            // Check if code matches what owner generated for this user
            const codeRow = db.prepare(`
        SELECT * FROM one_time_codes
        WHERE code = ? AND assigned_to = ? AND used = 0
      `).get(one_time_code, username);

            if (!codeRow) {
                return res.json({ success: false, message: 'Kode akses tidak valid atau sudah digunakan.' });
            }

            // Mark code as used
            db.prepare('UPDATE one_time_codes SET used = 1 WHERE id = ?').run(codeRow.id);

            req.session.user = {
                id: user.id,
                username: user.username,
                role: user.role,
                is_first_login: 1,
            };
            return res.json({ success: true, redirect: '/set-password.html' });
        }

        // Regular admin, not first login — normal password check
        const valid = bcrypt.compareSync(password, user.password_hash);
        if (!valid) return res.json({ success: false, message: 'Password salah.' });

        req.session.user = {
            id: user.id,
            username: user.username,
            role: user.role,
            is_first_login: 0,
        };
        return res.json({ success: true, redirect: '/admin/dashboard' });

    } finally {
        db.close();
    }
});

// POST /auth/set-password — forced first-login password change
router.post('/set-password', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.json({ success: false, message: 'Sesi tidak valid.' });
    }
    const { password, confirm_password } = req.body;

    if (!password || password.length < 8) {
        return res.json({ success: false, message: 'Password minimal 8 karakter.' });
    }
    if (password !== confirm_password) {
        return res.json({ success: false, message: 'Konfirmasi password tidak cocok.' });
    }

    const db = getDb();
    try {
        const hash = bcrypt.hashSync(password, 10);
        db.prepare(`
      UPDATE users SET password_hash = ?, is_first_login = 0 WHERE id = ?
    `).run(hash, req.session.user.id);

        req.session.user.is_first_login = 0;
        return res.json({ success: true, redirect: '/admin/dashboard' });
    } finally {
        db.close();
    }
});

// GET /auth/logout
router.get('/logout', (req, res) => {
    if (req.session && req.session.destroy) {
        req.session.destroy(() => res.redirect('/login.html'));
    } else {
        req.session = null;
        res.redirect('/login.html');
    }
});

// GET /auth/me — returns current session user info (used by frontend)
router.get('/me', (req, res) => {
    if (req.session && req.session.user) {
        return res.json({ user: req.session.user });
    }
    return res.json({ user: null });
});

module.exports = router;
