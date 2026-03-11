const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'views', 'admin');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

files.forEach(f => {
    const p = path.join(dir, f);
    let code = fs.readFileSync(p, 'utf8');

    // Replace standard endpoints
    code = code.replace(/fetch\('\/admin\//g, "fetch('/admin/api/");

    // Replace template literal endpoints
    code = code.replace(/fetch\(\`\/admin\//g, "fetch(`/admin/api/");

    // Replace specific known concatenation endpoints in students, assignments, grades, gallery
    code = code.replace(/\/admin\/students\/\`/g, "/admin/api/students/`");
    code = code.replace(/\/admin\/assignments\/\`/g, "/admin/api/assignments/`");

    fs.writeFileSync(p, code);
});

console.log("Done successfully!");
