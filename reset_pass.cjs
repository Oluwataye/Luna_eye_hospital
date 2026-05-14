const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./server/database.sqlite');
db.run("UPDATE users SET password = 'password' WHERE username = 'admin'", function(err) {
  if (err) console.error(err);
  else console.log('Password reset to plain text "password". (Backend auth accepts plain text if hash fails).');
});
