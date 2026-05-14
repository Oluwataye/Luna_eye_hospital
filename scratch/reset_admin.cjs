const db = require('../server/db');
db.run("UPDATE users SET password = 'password' WHERE username = 'admin'", function(err) {
  if (err) {
    console.error(err);
    process.exit(1);
  } else {
    console.log('Password reset successfully to "password".');
    process.exit(0);
  }
});
