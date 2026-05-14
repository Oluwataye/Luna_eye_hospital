const db = require('./server/db');
db.all('SELECT username, role FROM users', (err, rows) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log(JSON.stringify(rows, null, 2));
});
