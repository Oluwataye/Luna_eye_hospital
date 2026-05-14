const db = require('./server/db');
db.serialize(() => {
  // Disable FK temporarily or delete in order
  db.run('PRAGMA foreign_keys = OFF');
  db.run('DELETE FROM visits WHERE patient_id IN (SELECT id FROM patients WHERE phone = "08034567890" OR full_name = "Amina Bello")');
  db.run('DELETE FROM patients WHERE phone = "08034567890" OR full_name = "Amina Bello"');
  db.run('PRAGMA foreign_keys = ON');
  console.log('Cleanup complete.');
});
