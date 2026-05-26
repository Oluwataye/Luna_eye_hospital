const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const db = new sqlite3.Database('./server/database.sqlite');
const hashedPassword = bcrypt.hashSync('password', 10);
db.run("UPDATE users SET password = ? WHERE username = 'admin'", [hashedPassword], function(err) {
  if (err) console.error(err);
  else console.log('Password reset to hashed "password".');
});
