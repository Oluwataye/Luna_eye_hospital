const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../../server/luna_eye_hospital.db');
const db = new sqlite3.Database(dbPath);

db.all("SELECT username, role FROM users WHERE role IN ('admin', 'management') LIMIT 5", [], (err, rows) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(JSON.stringify(rows));
  db.close();
});
