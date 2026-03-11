const bcrypt = require('bcryptjs');
const { initDb, getDb } = require('./setup');

async function seed() {
    console.log('🌱 Setting up database...');
    await initDb();
    const db = getDb();

    // ─── USERS ────────────────────────────────────────────────────────────────────

    const ownerHash = bcrypt.hashSync('REHANsukaRAISA12#$', 10);

    const upsertUser = db.prepare(`
  INSERT INTO users (username, password_hash, role, is_first_login)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(username) DO NOTHING
`);

    // Super Admin / Owner
    upsertUser.run('raihan', ownerHash, 'owner', 0);
    console.log('✅ Owner account: raihan');

    // Regular admins (locked until owner assigns one-time code)
    const tempHash = bcrypt.hashSync('TEMP_LOCKED', 10);
    const admins = ['harisal', 'fakhri', 'kaizuran', 'radhi', 'fathir'];
    admins.forEach(name => {
        upsertUser.run(name, tempHash, 'admin', 1);
        console.log(`✅ Admin account: ${name} (locked – awaiting one-time code)`);
    });

    // ─── STUDENTS ─────────────────────────────────────────────────────────────────

    const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4'];
    const studentData = [
        { name: 'Ahmad Rizky Pratama', nis: '2024001', points: 185 },
        { name: 'Siti Nurhaliza', nis: '2024002', points: 210 },
        { name: 'Muhammad Fauzi', nis: '2024003', points: 155 },
        { name: 'Annisa Rahmawati', nis: '2024004', points: 240 },
        { name: 'Daffa Ramadhan', nis: '2024005', points: 130 },
        { name: 'Putri Melati', nis: '2024006', points: 195 },
        { name: 'Rizal Firmansyah', nis: '2024007', points: 175 },
        { name: 'Khairunnisa Azzahra', nis: '2024008', points: 220 },
        { name: 'Bagas Setiawan', nis: '2024009', points: 145 },
        { name: 'Nadira Tsabita', nis: '2024010', points: 200 },
    ];

    const upsertStudent = db.prepare(`
  INSERT INTO students (name, nis, class, points, avatar_color)
  VALUES (?, ?, '8A', ?, ?)
  ON CONFLICT(nis) DO NOTHING
`);

    studentData.forEach((s, i) => {
        upsertStudent.run(s.name, s.nis, s.points, colors[i % colors.length]);
        console.log(`✅ Student: ${s.name}`);
    });

    // ─── ASSIGNMENTS ──────────────────────────────────────────────────────────────

    const assignmentData = [
        { title: 'Latihan Soal Aljabar', subject: 'Matematika', due: '2026-03-15', desc: 'Kerjakan soal aljabar halaman 45–50 dari buku paket.' },
        { title: 'Esai Kemerdekaan Indonesia', subject: 'Bahasa Indonesia', due: '2026-03-17', desc: 'Tulis esai minimal 2 halaman tentang perjuangan kemerdekaan.' },
        { title: 'Lab Report: Sel & Organisme', subject: 'IPA', due: '2026-03-20', desc: 'Buat laporan praktikum pengamatan sel tumbuhan dan hewan.' },
        { title: 'Peta Konsep Perang Dunia II', subject: 'IPS', due: '2026-03-22', desc: 'Buat mind map penyebab, jalannya, dan dampak Perang Dunia II.' },
        { title: 'Speaking Practice: My Dream', subject: 'Bahasa Inggris', due: '2026-03-25', desc: 'Record a 2-minute video about your dream job.' },
        { title: 'Proyek Coding Python Dasar', subject: 'TIK', due: '2026-03-28', desc: 'Buat program kalkulator sederhana menggunakan Python.' },
    ];

    const upsertAssignment = db.prepare(`
  INSERT INTO assignments (title, subject, description, due_date, created_by)
  VALUES (?, ?, ?, ?, 'raihan')
  ON CONFLICT DO NOTHING
`);

    // Check if assignments already seeded
    const existingAssignments = db.prepare('SELECT COUNT(*) as cnt FROM assignments').get();
    if (existingAssignments.cnt === 0) {
        assignmentData.forEach(a => {
            upsertAssignment.run(a.title, a.subject, a.desc, a.due);
            console.log(`✅ Assignment: ${a.title}`);
        });
    }

    // ─── SAMPLE GRADES ────────────────────────────────────────────────────────────

    function calcPoints(score) {
        if (score >= 90) return 50;
        if (score >= 80) return 35;
        if (score >= 70) return 20;
        if (score >= 60) return 10;
        return 5;
    }

    const upsertGrade = db.prepare(`
  INSERT OR IGNORE INTO grades (student_id, assignment_id, score, points_awarded, graded_by)
  VALUES (?, ?, ?, ?, 'raihan')
`);

    const existingGrades = db.prepare('SELECT COUNT(*) as cnt FROM grades').get();
    if (existingGrades.cnt === 0) {
        const students = db.prepare('SELECT id FROM students').all();
        const assignments = db.prepare('SELECT id FROM assignments').all();
        const scores = [95, 82, 75, 88, 60, 91, 78, 85, 70, 93];

        students.forEach((s, si) => {
            assignments.slice(0, 4).forEach((a, ai) => {
                const score = scores[(si + ai) % scores.length];
                const pts = calcPoints(score);
                upsertGrade.run(s.id, a.id, score, pts);
            });
        });
        console.log('✅ Sample grades inserted');
    }

    // Sync points totals from grades
    const syncPoints = db.prepare(`
  UPDATE students SET points = (
    SELECT COALESCE(SUM(points_awarded), 0) FROM grades WHERE student_id = students.id
  )
`);
    syncPoints.run();
    console.log('✅ Points synced from grades');

    // ─── FORUM POSTS ──────────────────────────────────────────────────────────────

    const forumData = [
        {
            title: 'Tips Belajar Matematika Lebih Mudah 🧮',
            body: 'Hai teman-teman! Share yuk tips belajar matematika supaya lebih mudah dipahami. Kalau aku biasanya bikin rangkuman rumus di flashcard.',
            author: 'Siti Nurhaliza',
            category: 'Tips Belajar',
        },
        {
            title: 'Rekomendasi Sumber Belajar IPA Online',
            body: 'Ada yang tahu website atau YouTube channel bagus buat belajar IPA? Aku sering nonton Khan Academy tapi kayaknya ada yang lebih bagus deh.',
            author: 'Ahmad Rizky Pratama',
            category: 'Sumber Belajar',
        },
        {
            title: 'Diskusi: Cara Menulis Esai yang Baik',
            body: 'Untuk tugas esai Bahasa Indonesia, kita perlu structure yang jelas. Ada tips dari teman-teman soal cara penulisan yang menarik?',
            author: 'Annisa Rahmawati',
            category: 'Tugas',
        },
    ];

    const existingForum = db.prepare('SELECT COUNT(*) as cnt FROM forum_posts').get();
    if (existingForum.cnt === 0) {
        const upsertPost = db.prepare(`INSERT INTO forum_posts (title, body, author, category) VALUES (?, ?, ?, ?)`);
        forumData.forEach(p => {
            upsertPost.run(p.title, p.body, p.author, p.category);
        });
        // Sample replies
        db.prepare(`INSERT INTO forum_replies (post_id, body, author) VALUES (1, 'Aku setuju! Selain flashcard, latihan soal setiap hari juga membantu banget. Konsistensi adalah kuncinya! 💪', 'Muhammad Fauzi')`).run();
        db.prepare(`INSERT INTO forum_replies (post_id, body, author) VALUES (1, 'Coba juga Quizlet untuk flashcard digital, lebih praktis!', 'Putri Melati')`).run();
        db.prepare(`INSERT INTO forum_replies (post_id, body, author) VALUES (2, 'Zenius juga bagus banget dan pakai bahasa Indonesia! Cocok untuk persiapan ujian', 'Khairunnisa Azzahra')`).run();
        console.log('✅ Forum seeded');
    }

    // ─── CHAT MESSAGES ────────────────────────────────────────────────────────────

    const existingChat = db.prepare('SELECT COUNT(*) as cnt FROM chat_messages').get();
    if (existingChat.cnt === 0) {
        const chatData = [
            { username: 'Annisa', message: 'Assalamualaikum teman-teman! 👋', color: '#ec4899' },
            { username: 'Ahmad Rizky', message: 'Waalaikumsalam! Ada PR Matematika hari ini ga?', color: '#6366f1' },
            { username: 'Siti', message: 'Ada! Soal aljabar halaman 45-50. Lumayan banyak 😅', color: '#10b981' },
            { username: 'Daffa', message: 'Semangat guys! Kita bisa! 💪🔥', color: '#f59e0b' },
        ];
        const insertChat = db.prepare(`INSERT INTO chat_messages (username, message, color) VALUES (?, ?, ?)`);
        chatData.forEach(c => insertChat.run(c.username, c.message, c.color));
        console.log('✅ Sample chat messages seeded');
    }

    db.close();
    console.log('\n🎉 Database seeded successfully!');
    console.log('👤 Owner login: raihan / REHANsukaRAISA12#$');
    console.log('🔒 Regular admins are locked until you generate one-time codes in the Admin Panel.');
}

seed().catch(console.error);
