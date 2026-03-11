const { getDb } = require('../db/setup');

function requireAuth(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.redirect('/login.html?error=not_logged_in');
    }
    next();
}

function requireOwner(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.redirect('/login.html?error=not_logged_in');
    }
    if (req.session.user.role !== 'owner') {
        return res.redirect('/admin/dashboard?error=forbidden');
    }
    next();
}

function requireNotFirstLogin(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.redirect('/login.html?error=not_logged_in');
    }
    if (req.session.user.is_first_login) {
        return res.redirect('/set-password.html');
    }
    next();
}

function logAction(adminUsername, action, target, detail = '') {
    try {
        const db = getDb();
        db.prepare(`
      INSERT INTO admin_logs (admin_username, action, target, detail)
      VALUES (?, ?, ?, ?)
    `).run(adminUsername, action, target, detail);
        db.close();
    } catch (e) {
        console.error('Log action error:', e.message);
    }
}

module.exports = { requireAuth, requireOwner, requireNotFirstLogin, logAction };
