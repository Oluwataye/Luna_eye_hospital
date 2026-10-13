const db = require('../server/db');
const bcrypt = require('bcryptjs');
const newPassword = 'admin123';
const hash = bcrypt.hashSync(newPassword, 10);

db.run("UPDATE users SET password = ? WHERE username = 'admin'", [hash], function(err) {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log(`✅ Admin password successfully reset to: "${newPassword}"`);
    console.log(`   Rows updated: ${this.changes}`);
  }
});
