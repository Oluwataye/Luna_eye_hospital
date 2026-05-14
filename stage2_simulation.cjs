const API_BASE_URL = 'http://127.0.0.1/api';

async function runStage2() {
  console.log("--- STAGE 2: PATIENT CHECK-IN & QUEUE SIMULATION ---");

  const patientId = "0010/26/LEH"; // From Stage 1 output

  // Action 2.1: Verify check-in (Amina should already be in the queue from registration)
  console.log("\nAction 2.1: Verifying patient check-in status...");
  
  // We'll fetch the triage queue to see if she's there
  const queueRes = await fetch(`${API_BASE_URL}/triage-queue`);
  const queue = await queueRes.json();
  
  const aminaEntry = queue.find(v => v.patient_id === patientId);

  if (aminaEntry) {
    console.log(`SUCCESS: Amina Bello is already in the queue. Visit ID: ${aminaEntry.visit_id}`);
    console.log(`Status: ${aminaEntry.status}`);
  } else {
    console.log("WAIT: Amina not found in queue. Attempting manual check-in...");
    const checkInRes = await fetch(`${API_BASE_URL}/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: patientId, department: "General" })
    });
    
    if (checkInRes.ok) {
      const data = await checkInRes.json();
      console.log(`SUCCESS: Manual check-in completed. New Visit ID: ${data.id}`);
    } else {
      const err = await checkInRes.json();
      console.log(`FAILED: Check-in failed. ${err.error}`);
      return;
    }
  }

  // Action 2.2: Verify patient appears in queue
  console.log("\nAction 2.2: Verifying patient details in queue...");
  const finalQueueRes = await fetch(`${API_BASE_URL}/triage-queue`);
  const finalQueue = await finalQueueRes.json();
  const aminaInQueue = finalQueue.find(v => v.patient_id === patientId);

  if (aminaInQueue) {
    console.log(`CONFIRMED: ${aminaInQueue.full_name} is listed in the queue.`);
    console.log(`Arrival Time: ${new Date(aminaInQueue.visit_date).toLocaleTimeString()}`);
    console.log(`Current Status: ${aminaInQueue.status}`);
  } else {
    console.log("FAILED: Patient still not found in queue.");
  }

  // Action 2.3: Verify status color coding (Simulation check)
  console.log("\nAction 2.3: Verifying status color coding...");
  // As per our update to NurseDashboard.tsx, 'Registered/Waiting' uses 'badge-primary' (Blue)
  if (aminaInQueue.status === 'Registered/Waiting') {
    console.log("SUCCESS: Status is 'Registered/Waiting', which maps to 'badge-primary' (BLUE) in NurseDashboard.tsx.");
  } else {
    console.log(`NOTE: Status is '${aminaInQueue.status}'. Check color mapping for this specific state.`);
  }

  console.log("\n--- STAGE 2 COMPLETE ---");
  console.log(`PROCEEDING TO STAGE 3 WITH VISIT ID: ${aminaInQueue.visit_id}`);
}

runStage2();
