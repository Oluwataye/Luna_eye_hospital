const db = require('./server/db');
db.serialize(() => {
  db.run('PRAGMA foreign_keys = OFF');
  db.run('DELETE FROM admissions WHERE patient_id IN (SELECT id FROM patients WHERE full_name = "Ibrahim Tanko")');
  db.run('DELETE FROM visits WHERE patient_id IN (SELECT id FROM patients WHERE full_name = "Ibrahim Tanko")');
  db.run('DELETE FROM patients WHERE full_name = "Ibrahim Tanko"');
  db.run('PRAGMA foreign_keys = ON');
  console.log('Ibrahim Tanko cleanup complete.');
});
