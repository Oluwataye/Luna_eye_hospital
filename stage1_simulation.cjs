const API_BASE_URL = 'http://127.0.0.1:3200/api';

const nativeFetch = globalThis.fetch;
let token = '';
async function login() {
  const res = await nativeFetch(`${API_BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin' })
  });
  const data = await res.json();
  token = data.token;
}

async function fetchWithAuth(url, options = {}) {
  if (!token) await login();
  options.headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`
  };
  return nativeFetch(url, options);
}

async function runStage1() {
  console.log("--- STAGE 1: PATIENT REGISTRATION SIMULATION ---");

  const aminaDetails = {
    full_name: "Amina Bello",
    gender: "Female",
    dob: "1988-03-15",
    phone: "08034567890",
    alternate_phone: "07012345678",
    address: "24 Bosso Road, Minna, Niger State",
    occupation: "Teacher",
    next_of_kin: "Musa Bello",
    next_of_kin_phone: "08056781234",
    marital_status: "Married",
    blood_group: "O+",
    genotype: "AA",
    allergies: "Penicillin",
    medical_alerts: "Hypertensive",
    payment_category: "Cash",
    department: "General"
  };

  // Action 1.2: Test duplicate detection (Before)
  // Simulation: Frontend would call api.getPatients() and filter
  console.log("\nAction 1.2: Testing duplicate detection before registration...");
  const patientsBeforeRes = await fetchWithAuth(`${API_BASE_URL}/patients`);
  const patientsBefore = await patientsBeforeRes.json();
  const duplicateBefore = patientsBefore.find(p => p.phone === aminaDetails.phone);
  
  if (!duplicateBefore) {
    console.log("SUCCESS: No duplicate found with phone 08034567890.");
  } else {
    console.log(`WARNING: Duplicate found before registration! ID: ${duplicateBefore.id}`);
  }

  // Action 1.3: Fill and submit the registration form
  console.log("\nAction 1.3: Registering Amina Bello...");
  const regRes = await fetchWithAuth(`${API_BASE_URL}/patients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(aminaDetails)
  });

  if (!regRes.ok) {
    const err = await regRes.json();
    console.log(`FAILED: Registration failed. ${err.error || err.message}`);
    return;
  }

  const patient = await regRes.json();
  console.log(`SUCCESS: Patient Amina Bello has been registered successfully. File No: ${patient.id}`);
  const fileNo = patient.id;

  // Action 1.4: Test duplicate detection after registration (Backend check)
  console.log("\nAction 1.4: Testing duplicate detection after registration (POST check)...");
  const dupRes = await fetchWithAuth(`${API_BASE_URL}/patients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(aminaDetails)
  });

  if (dupRes.status === 409) {
    const err = await dupRes.json();
    console.log(`SUCCESS: Duplicate detected by backend. Error: "${err.error}" - ${err.message}`);
  } else {
    console.log(`FAILED: Duplicate NOT detected by backend! Status: ${dupRes.status}`);
  }

  // Action 1.5: Verify patient appears in search
  console.log("\nAction 1.5: Verifying patient appears in search (simulating LiveSearch)...");
  const patientsAfterRes = await fetchWithAuth(`${API_BASE_URL}/patients`);
  const patientsAfter = await patientsAfterRes.json();
  
  // Simulate typing "Ami"
  const query = "Ami".toLowerCase();
  const searchResults = patientsAfter.filter(p => 
    p.full_name.toLowerCase().includes(query) || 
    p.id.toLowerCase().includes(query) ||
    p.phone.includes(query)
  );

  const aminaSearch = searchResults.find(p => p.full_name === "Amina Bello");
  
  if (aminaSearch) {
    console.log(`SUCCESS: Amina Bello found in search results for "Ami". ID: ${aminaSearch.id}`);
  } else {
    console.log("FAILED: Amina Bello not found in search results.");
  }

  console.log("\n--- STAGE 1 COMPLETE ---");
  console.log(`RECORDED FILE NUMBER: ${fileNo}`);
}

runStage1();
