const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('server/luna_eye_hospital.db');

const qty = 1;
const id = 'INV-1777896626068';

db.serialize(() => {
  db.get('SELECT stock FROM inventory WHERE id = ?', [id], (err, row) => {
    console.log('Current Stock:', row.stock);
    
    const invStmt = db.prepare('UPDATE inventory SET stock = stock - ? WHERE id = ? AND stock >= ?');
    invStmt.run(qty, id, qty, function(err2) {
      if (err2) {
        console.error('Update Error:', err2);
      } else {
        console.log('Update Changes:', this.changes);
        if (this.changes === 0) {
          console.log('FAILED: No rows updated. Check ID or Stock condition.');
        } else {
          console.log('SUCCESS: Stock updated.');
        }
      }
      db.close();
    });
    invStmt.finalize();
  });
});
