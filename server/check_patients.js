const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('luna_eye_hospital.db');
db.all('SELECT full_name FROM patients', (err, rows) => {
  if (err) {
    console.error('ERROR:', err);
  } else {
    console.log('PATIENTS_COUNT:', rows.length);
    console.log('PATIENTS_LIST:', JSON.stringify(rows.map(r => r.full_name)));
  }
  db.close();
});
