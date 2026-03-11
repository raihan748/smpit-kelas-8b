const initSqlJs = require('sql.js');
const path = require('path');

async function test() {
    const SQL = await initSqlJs({
        locateFile: f => path.join(__dirname, '../node_modules/sql.js/dist/', f)
    });
    const db = new SQL.Database();
    db.run('CREATE TABLE test (id INTEGER, val TEXT)');
    db.run('INSERT INTO test VALUES (1, "hello")');
    const result = db.exec('SELECT * FROM test');
    console.log('sql.js works! Result:', JSON.stringify(result));
}
test().catch(console.error);
