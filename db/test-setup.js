const { setupDatabase, getDb } = require('./setup');
console.log('Setting up DB...');
setupDatabase();
console.log('Setup done!');

const db = getDb();
const u = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
console.log('Users count:', u ? u.cnt : 'N/A');

const s = db.prepare('SELECT COUNT(*) as cnt FROM students').get();
console.log('Students count:', s ? s.cnt : 'N/A');

console.log('All OK!');
