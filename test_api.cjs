const http = require('http');

http.get('http://localhost:5000/api/reports/audit?start_date=2020-01-01&end_date=2030-01-01', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Audit Data:', data.substring(0, 500) + '...'));
}).on('error', err => console.error('Error fetching audit:', err.message));

http.get('http://localhost:5000/api/reports/audit/summary', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Audit Summary:', data));
}).on('error', err => console.error('Error fetching summary:', err.message));
