const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./luna_eye_hospital.db');
db.serialize(() => {
  // Reset admin to known plain-text password
  db.run("UPDATE users SET password = 'admin123' WHERE username = 'admin'", function(err) {
    if (err) console.error('admin:', err.message);
    else console.log('admin password reset to: admin123');
  });
  // Also reset all others to plain-text for testing
  db.run("UPDATE users SET password = 'password' WHERE username IN ('doctor','nurse','pharmacist','reception','receptionist')", function(err) {
    if (err) console.error('others:', err.message);
    else console.log('Other users reset to: password');
  });
});
setTimeout(() => process.exit(0), 500);
