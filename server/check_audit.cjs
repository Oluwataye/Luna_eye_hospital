const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'luna_eye_hospital.db');
const db = new sqlite3.Database(dbPath);

db.all('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 30', (err, rows) => {
  if (err) {
    console.error(err);
  } else {
    console.log(JSON.stringify(rows, null, 2));
  }
  db.close();
});
