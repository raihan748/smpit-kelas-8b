const express = require('express');
const router = express.Router();
const { getDb } = require('../db/setup');
const { requireAuth, requireNotFirstLogin, requireOwner, logAction } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// All admin routes require auth + not first login
router.use(requireAuth, requireNotFirstLogin);

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

router.get('/dashboard-stats', (req, res) => {
    const db = getDb();
    const studentCount = db.prepare('SELECT COUNT(*) as cnt FROM students').get().cnt;
    const assignmentCount = db.prepare('SELECT COUNT(*) as cnt FROM assignments').get().cnt;
    const gradeCount = db.prepare('SELECT COUNT(*) as cnt FROM grades').get().cnt;
    const recentLogs = db.prepare('SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT 5').all();
    db.close();
    res.json({ studentCount, assignmentCount, gradeCount, recentLogs, user: req.session.user });
});

// ─── STUDENTS ─────────────────────────────────────────────────────────────────

router.get('/students', (req, res) => {
    const db = getDb();
    const students = db.prepare('SELECT * FROM students ORDER BY points DESC').all();
    db.close();
    res.json(students);
});

router.post('/students', (req, res) => {
    const { name, nis, class: cls, points } = req.body;
    const db = getDb();
    try {
        const result = db.prepare(
            `INSERT INTO students (name, nis, class, points) VALUES (?, ?, ?, ?)`
        ).run(name, nis, cls || '8B Ahmad bin Hambal', points || 0);
        logAction(req.session.user.username, 'CREATE', `Student: ${name}`, `NIS: ${nis}`);
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (e) {
        res.json({ success: false, message: e.message });
    } finally { db.close(); }
});

router.put('/students/:id', (req, res) => {
    const { name, nis, class: cls, points } = req.body;
    const db = getDb();
    try {
        db.prepare(`UPDATE students SET name=?, nis=?, class=?, points=? WHERE id=?`)
            .run(name, nis, cls, points, req.params.id);
        logAction(req.session.user.username, 'EDIT', `Student ID: ${req.params.id}`, `${name}, pts: ${points}`);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, message: e.message });
    } finally { db.close(); }
});

router.delete('/students/:id', (req, res) => {
    const db = getDb();
    const student = db.prepare('SELECT name FROM students WHERE id = ?').get(req.params.id);
    db.prepare('DELETE FROM students WHERE id = ?').run(req.params.id);
    logAction(req.session.user.username, 'DELETE', `Student: ${student ? student.name : req.params.id}`);
    db.close();
    res.json({ success: true });
});

// ─── ASSIGNMENTS ──────────────────────────────────────────────────────────────

router.get('/assignments', (req, res) => {
    const db = getDb();
    const assignments = db.prepare('SELECT * FROM assignments ORDER BY created_at DESC').all();
    db.close();
    res.json(assignments);
});

router.post('/assignments', (req, res) => {
    const { title, subject, description, due_date } = req.body;
    const db = getDb();
    try {
        const result = db.prepare(
            `INSERT INTO assignments (title, subject, description, due_date, created_by) VALUES (?, ?, ?, ?, ?)`
        ).run(title, subject, description, due_date, req.session.user.username);
        logAction(req.session.user.username, 'CREATE', `Assignment: ${title}`);
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (e) {
        res.json({ success: false, message: e.message });
    } finally { db.close(); }
});

router.put('/assignments/:id', (req, res) => {
    const { title, subject, description, due_date } = req.body;
    const db = getDb();
    db.prepare(`UPDATE assignments SET title=?, subject=?, description=?, due_date=? WHERE id=?`)
        .run(title, subject, description, due_date, req.params.id);
    logAction(req.session.user.username, 'EDIT', `Assignment ID: ${req.params.id}`, title);
    db.close();
    res.json({ success: true });
});

router.delete('/assignments/:id', (req, res) => {
    const db = getDb();
    const a = db.prepare('SELECT title FROM assignments WHERE id = ?').get(req.params.id);
    db.prepare('DELETE FROM assignments WHERE id = ?').run(req.params.id);
    logAction(req.session.user.username, 'DELETE', `Assignment: ${a ? a.title : req.params.id}`);
    db.close();
    res.json({ success: true });
});

// ─── GRADES ───────────────────────────────────────────────────────────────────

function calcPoints(score) {
    if (score >= 90) return 50;
    if (score >= 80) return 35;
    if (score >= 70) return 20;
    if (score >= 60) return 10;
    return 5;
}

router.get('/grades', (req, res) => {
    const db = getDb();
    const grades = db.prepare(`
    SELECT g.*, s.name as student_name, s.nis, a.title as assignment_title, a.subject
    FROM grades g
    JOIN students s ON s.id = g.student_id
    JOIN assignments a ON a.id = g.assignment_id
    ORDER BY g.graded_at DESC
  `).all();
    db.close();
    res.json(grades);
});

router.post('/grades', (req, res) => {
    const { student_id, assignment_id, score } = req.body;
    const pts = calcPoints(parseFloat(score));
    const db = getDb();
    try {
        db.prepare(`
      INSERT INTO grades (student_id, assignment_id, score, points_awarded, graded_by)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(student_id, assignment_id) DO UPDATE SET score=excluded.score, points_awarded=excluded.points_awarded, graded_by=excluded.graded_by, graded_at=datetime('now','localtime')
    `).run(student_id, assignment_id, parseFloat(score), pts, req.session.user.username);

        // Sync student points
        db.prepare(`
      UPDATE students SET points = (
        SELECT COALESCE(SUM(points_awarded), 0) FROM grades WHERE student_id = ?
      ) WHERE id = ?
    `).run(student_id, student_id);

        const student = db.prepare('SELECT name FROM students WHERE id=?').get(student_id);
        const assign = db.prepare('SELECT title FROM assignments WHERE id=?').get(assignment_id);
        logAction(req.session.user.username, 'GRADE', `${student ? student.name : student_id}`, `${assign ? assign.title : assignment_id}: ${score} -> ${pts} pts`);
        res.json({ success: true, points_awarded: pts });
    } catch (e) {
        res.json({ success: false, message: e.message });
    } finally { db.close(); }
});

router.delete('/grades/:id', (req, res) => {
    const db = getDb();
    const g = db.prepare('SELECT student_id FROM grades WHERE id = ?').get(req.params.id);
    db.prepare('DELETE FROM grades WHERE id = ?').run(req.params.id);
    if (g) {
        db.prepare(`UPDATE students SET points = (SELECT COALESCE(SUM(points_awarded),0) FROM grades WHERE student_id=?) WHERE id=?`)
            .run(g.student_id, g.student_id);
    }
    logAction(req.session.user.username, 'DELETE', `Grade ID: ${req.params.id}`);
    db.close();
    res.json({ success: true });
});

// ─── FORUM MODERATION ─────────────────────────────────────────────────────────

router.delete('/forum/posts/:id', (req, res) => {
    const db = getDb();
    const p = db.prepare('SELECT title FROM forum_posts WHERE id=?').get(req.params.id);
    db.prepare('DELETE FROM forum_posts WHERE id = ?').run(req.params.id);
    logAction(req.session.user.username, 'DELETE', `Forum Post: ${p ? p.title : req.params.id}`);
    db.close();
    res.json({ success: true });
});

router.delete('/forum/replies/:id', (req, res) => {
    const db = getDb();
    db.prepare('DELETE FROM forum_replies WHERE id = ?').run(req.params.id);
    logAction(req.session.user.username, 'DELETE', `Forum Reply ID: ${req.params.id}`);
    db.close();
    res.json({ success: true });
});

// ─── GALLERY (OWNER ONLY) — URL-based (no file uploads) ──────────────────────

router.get('/gallery', requireOwner, (req, res) => {
    const db = getDb();
    const images = db.prepare('SELECT * FROM gallery ORDER BY uploaded_at DESC').all();
    db.close();
    res.json(images);
});

router.post('/gallery', requireOwner, (req, res) => {
    const { image_url, caption } = req.body;
    if (!image_url) return res.json({ success: false, message: 'URL gambar diperlukan!' });
    const db = getDb();
    const result = db.prepare(
        `INSERT INTO gallery (filename, caption, uploaded_by) VALUES (?, ?, ?)`
    ).run(image_url, caption || '', req.session.user.username);
    logAction(req.session.user.username, 'ADD_GALLERY', `URL: ${image_url.substring(0, 50)}...`, caption || '');
    db.close();
    res.json({ success: true, id: result.lastInsertRowid });
});

router.delete('/gallery/:id', requireOwner, (req, res) => {
    const db = getDb();
    db.prepare('DELETE FROM gallery WHERE id = ?').run(req.params.id);
    logAction(req.session.user.username, 'DELETE', `Gallery ID: ${req.params.id}`);
    db.close();
    res.json({ success: true });
});

// ─── KISI-KISI UJIAN (OWNER ONLY) ────────────────────────────────────────────

router.get('/kisi-kisi', (req, res) => {
    const db = getDb();
    const settings = db.prepare('SELECT * FROM app_settings WHERE id = 1').get();
    db.close();
    res.json({ is_kisi_mode: settings ? settings.is_kisi_mode : 0 });
});

router.post('/kisi-kisi', requireOwner, (req, res) => {
    const { enabled } = req.body;
    const db = getDb();
    db.prepare('UPDATE app_settings SET is_kisi_mode = ? WHERE id = 1').run(enabled ? 1 : 0);
    logAction(req.session.user.username, 'TOGGLE', 'Kisi-Kisi Mode', enabled ? 'ON' : 'OFF');
    db.close();
    res.json({ success: true, is_kisi_mode: enabled ? 1 : 0 });
});

// ─── ADMIN LOGS (OWNER ONLY) ─────────────────────────────────────────────────

router.get('/logs', requireOwner, (req, res) => {
    const db = getDb();
    const logs = db.prepare('SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT 200').all();
    db.close();
    res.json(logs);
});

// ─── ONE-TIME CODE ACCESS MANAGER (OWNER ONLY) ───────────────────────────────

router.get('/access/codes', requireOwner, (req, res) => {
    const db = getDb();
    const codes = db.prepare(`
    SELECT c.*, u.is_first_login FROM one_time_codes c
    LEFT JOIN users u ON u.username = c.assigned_to
    ORDER BY c.created_at DESC
  `).all();
    const admins = db.prepare(`SELECT username, is_first_login FROM users WHERE role='admin'`).all();
    db.close();
    res.json({ codes, admins });
});

router.post('/access/generate', requireOwner, (req, res) => {
    const { assigned_to } = req.body;
    if (!assigned_to) return res.json({ success: false, message: 'assigned_to required' });
    const db = getDb();
    // Check admin exists
    const admin = db.prepare('SELECT id FROM users WHERE username=? AND role=?').get(assigned_to, 'admin');
    if (!admin) { db.close(); return res.json({ success: false, message: 'Admin not found.' }); }

    const code = `AF-${uuidv4().substring(0, 8).toUpperCase()}`;
    db.prepare('INSERT INTO one_time_codes (code, assigned_to) VALUES (?, ?)').run(code, assigned_to);
    logAction(req.session.user.username, 'GENERATE_CODE', `For: ${assigned_to}`, code);
    db.close();
    res.json({ success: true, code });
});

// ─── USERS API (for admin list) ───────────────────────────────────────────────

router.get('/users', requireOwner, (req, res) => {
    const db = getDb();
    const users = db.prepare('SELECT id, username, role, is_first_login, created_at FROM users ORDER BY role DESC, username').all();
    db.close();
    res.json(users);
});

module.exports = router;
