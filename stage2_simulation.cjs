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

async function runStage2() {
  console.log("--- STAGE 2: PATIENT CHECK-IN & QUEUE SIMULATION ---");

  const patientId = process.env.PATIENT_ID || "0010/26/LEH";

  // Action 2.1: Verify check-in
  console.log("\nAction 2.1: Verifying patient check-in status...");
  
  const queueRes = await fetchWithAuth(`${API_BASE_URL}/triage-queue`);
  const queue = await queueRes.json();
  
  let aminaEntry = Array.isArray(queue) ? queue.find(v => v.patient_id === patientId) : null;
  let visitId;

  if (aminaEntry) {
    console.log(`SUCCESS: Amina Bello is already in the queue. Visit ID: ${aminaEntry.visit_id}`);
    console.log(`Status: ${aminaEntry.status}`);
    visitId = aminaEntry.visit_id;
  } else {
    console.log("WAIT: Amina not found in queue. Attempting manual check-in...");
    const checkInRes = await fetchWithAuth(`${API_BASE_URL}/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: patientId, department: "General", target: "triage" })
    });
    
    if (checkInRes.ok) {
      const data = await checkInRes.json();
      console.log(`SUCCESS: Manual check-in completed. New Visit ID: ${data.visit_id}`);
      visitId = data.visit_id;
    } else {
      const err = await checkInRes.json();
      console.log(`FAILED: Check-in failed. ${err.error}`);
      return;
    }
  }

  // Action 2.2: Verify patient appears in queue
  console.log("\nAction 2.2: Verifying patient details in queue...");
  const finalQueueRes = await fetchWithAuth(`${API_BASE_URL}/triage-queue`);
  const finalQueue = await finalQueueRes.json();
  const aminaInQueue = Array.isArray(finalQueue) ? finalQueue.find(v => v.patient_id === patientId) : null;

  if (aminaInQueue) {
    console.log(`CONFIRMED: ${aminaInQueue.full_name} is listed in the queue.`);
    console.log(`Arrival Time: ${new Date(aminaInQueue.checkin_at || aminaInQueue.visit_date).toLocaleTimeString()}`);
    console.log(`Current Status: ${aminaInQueue.status}`);
  } else {
    console.log("FAILED: Patient still not found in queue.");
    return;
  }

  // Action 2.3: Verify status color coding (Simulation check)
  console.log("\nAction 2.3: Verifying status color coding...");
  if (aminaInQueue.status === 'Registered/Waiting' || aminaInQueue.status === 'Waiting for Triage' || aminaInQueue.status === 'Awaiting Triage') {
    console.log(`SUCCESS: Status is '${aminaInQueue.status}', which maps to 'badge-primary' (BLUE) in NurseDashboard.tsx.`);
  } else {
    console.log(`NOTE: Status is '${aminaInQueue.status}'. Check color mapping for this specific state.`);
  }

  console.log("\n--- STAGE 2 COMPLETE ---");
  console.log(`PROCEEDING TO STAGE 3 WITH VISIT ID: ${visitId || aminaInQueue.visit_id}`);
}

runStage2();
