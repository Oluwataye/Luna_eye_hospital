const http = require('http');

const data = JSON.stringify({
  full_name: "Amina Bello",
  gender: "Female",
  dob: "1988-03-15",
  phone: "08034567890",
  address: "24 Bosso Road, Minna",
  occupation: "Teacher",
  department: "General",
  payment_category: "Cash"
});

const options = {
  hostname: 'localhost',
  port: 3200,
  path: '/api/patients',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`BODY: ${body}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
