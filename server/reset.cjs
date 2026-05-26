const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const db = new sqlite3.Database('./luna_eye_hospital.db');
db.serialize(() => {
  // Reset admin to known password (hashed)
  const adminHash = bcrypt.hashSync('admin123', 10);
  db.run("UPDATE users SET password = ? WHERE username = 'admin'", [adminHash], function(err) {
    if (err) console.error('admin:', err.message);
    else console.log('admin password reset to: admin123 (hashed)');
  });
  // Also reset all others to password (hashed)
  const userHash = bcrypt.hashSync('password', 10);
  db.run("UPDATE users SET password = ? WHERE username IN ('doctor','nurse','pharmacist','reception','receptionist')", [userHash], function(err) {
    if (err) console.error('others:', err.message);
    else console.log('Other users reset to: password (hashed)');
  });
});
setTimeout(() => process.exit(0), 500);
