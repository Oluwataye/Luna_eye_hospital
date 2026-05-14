const API_BASE_URL = 'http://127.0.0.1/api';

async function simulateConsultation() {
  console.log("--- Phase 3: Consultation Simulation ---");
  
  // 1. Fetch Queue to confirm Amaka is there
  console.log("1. Fetching queue for Consultation...");
  const queueRes = await fetch(`${API_BASE_URL}/queue`);
  const queue = await queueRes.json();
  const amakaInQueue = queue.waiting_for_consultation.find(p => p.patient_id === '0009/26/LEH');
  
  if (amakaInQueue) {
    console.log(`SUCCESS: Found ${amakaInQueue.full_name} (${amakaInQueue.patient_id}) in Consultation Queue.`);
  } else {
    console.log("FAILED: Amaka Nwosu not found in Consultation Queue.");
    return;
  }

  // 2. Submit Consultation Notes
  console.log("2. Submitting Consultation Notes for Amaka Nwosu...");
  const consultData = {
    patient_id: '0009/26/LEH',
    visit_id: amakaInQueue.id,
    bp: '130/85',
    complaint: 'Persistent blurred vision in both eyes, mild headaches.',
    primary_diagnosis: 'Refractive Error (Myopia)',
    diagnosis_notes: 'Bilateral myopia confirmed via objective refraction.',
    management_plan: 'Prescribe spectacles, follow up in 6 months.',
    clinical_data: {
      history: 'No previous history of eye surgery. Family history of glaucoma.',
      iop_method: 'iCare',
      medications: 'None',
      glasses_rx: 'OD: -1.50 DS, OS: -1.75 DS'
    },
    consultant_name: 'Dr. Sarah Connor',
    finalize: true
  };

  const consultRes = await fetch(`${API_BASE_URL}/consultations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(consultData)
  });

  if (consultRes.ok) {
    const result = await consultRes.json();
    console.log(`SUCCESS: Consultation finalized. New status: ${result.status}`);
  } else {
    const error = await consultRes.json();
    console.log(`FAILED: Could not finalize consultation. Error: ${error.error}`);
    return;
  }

  // 3. Verify Visit Status is 'Completed'
  console.log("3. Verifying visit status after consultation...");
  const statusRes = await fetch(`${API_BASE_URL}/queue`);
  const updatedQueue = await statusRes.json();
  // Since she is finalized, she should not be in waiting_for_consultation
  const stillWaiting = updatedQueue.waiting_for_consultation.find(p => p.patient_id === '0009/26/LEH');
  
  if (!stillWaiting) {
    console.log("SUCCESS: Amaka Nwosu moved out of the Consultation Queue.");
  } else {
    console.log("FAILED: Amaka Nwosu still in Consultation Queue.");
  }
}

simulateConsultation();
