const API_BASE_URL = 'http://127.0.0.1/api';

async function runStage3() {
  console.log("--- STAGE 3: TRIAGE SIMULATION ---");

  const patientId = "0010/26/LEH";
  const visitId = 10; // From Stage 2 output

  const triageData = {
    patient_id: patientId,
    visit_id: visitId,
    bp_systolic: 145,
    bp_diastolic: 92,
    pulse_rate: 82,
    temperature: 36.8,
    weight: 68,
    va_od_unaided: "6/36",
    va_od_aided: "6/18",
    va_od_pinhole: "6/12",
    va_od_near_unaided: "N10",
    va_od_near_aided: "N8",
    va_os_unaided: "6/12",
    va_os_aided: "6/9",
    va_os_pinhole: "6/9",
    va_os_near_unaided: "N8",
    va_os_near_aided: "N6",
    iop_od: "16", // Optional, but good to have
    iop_os: "16",
    iop_method: "NCT",
    complaint: "Red and painful eyes for 3 days. Blurry vision in the right eye.",
    triaged_by: "Nurse Joy" // Placeholder
  };

  // Action 3.5: Save triage record
  console.log("\nAction 3.5: Saving triage record for Amina Bello...");
  const triageRes = await fetch(`${API_BASE_URL}/triage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(triageData)
  });

  if (!triageRes.ok) {
    const err = await triageRes.json();
    console.log(`FAILED: Triage recording failed. ${err.error || err.message}`);
    return;
  }

  const result = await triageRes.json();
  console.log(`SUCCESS: Vital signs and VA recorded. Response: "${result.message || 'Saved'}"`);

  // Action 3.6: Verify patient status update
  console.log("\nAction 3.6: Verifying patient status update...");
  
  // Check triage queue (should be gone)
  const triageQueueRes = await fetch(`${API_BASE_URL}/triage-queue`);
  const triageQueue = await triageQueueRes.json();
  const stillInTriage = triageQueue.find(v => v.visit_id === visitId);
  
  if (!stillInTriage) {
    console.log("SUCCESS: Patient removed from Triage Queue.");
  } else {
    console.log("FAILED: Patient STILL in Triage Queue!");
  }

  // Check general queue for 'Waiting for Consultation' status
  const queueRes = await fetch(`${API_BASE_URL}/queue`);
  const queue = await queueRes.json();
  
  const waitingForDoc = queue.waiting_for_consultation.find(v => v.patient_id === patientId);
  
  if (waitingForDoc) {
    console.log(`SUCCESS: Patient found in Consultation Queue. Status: ${waitingForDoc.status}`);
  } else {
    console.log("FAILED: Patient NOT found in Consultation Queue.");
    // Let's check all visits to see what happened
    const allVisitsRes = await fetch(`${API_BASE_URL}/queue`); // This returns stats, let's look at raw data if possible
    console.log("Current stats:", JSON.stringify(queue, null, 2));
  }

  console.log("\n--- STAGE 3 COMPLETE ---");
}

runStage3();
