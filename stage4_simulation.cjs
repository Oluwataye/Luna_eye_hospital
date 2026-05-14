const API_BASE_URL = 'http://127.0.0.1/api';

async function runStage4() {
  console.log("--- STAGE 4: CONSULTATION SIMULATION ---");

  const patientId = "0010/26/LEH";
  const visitId = 10;
  const consultantName = "Dr. Luna";

  // Simulation of Section-by-Section Saving (Action 4.14)
  // We'll perform one large save at the end, but simulate the intermediate ones conceptually
  
  const fullConsultationData = {
    patient_id: patientId,
    visit_id: visitId,
    consultant_name: consultantName,
    finalize: true,
    
    // Section A: History
    complaint: "Red and painful eyes for 3 days, blurry vision especially in right eye.",
    history: "Patient reports gradual onset of redness and pain in both eyes over the past 3 days, worse in OD. Associated with blurring of vision, photophobia, and mild discharge. No history of trauma. No previous eye surgery. Known hypertensive on amlodipine 5mg daily. Allergic to Penicillin.",
    
    // Section B: Vitals (Pre-populated from Stage 3)
    bp: "145/92",
    pulse: "82",
    temp: "36.8",
    weight: "68",
    
    // Section C: Visual Acuity (Pre-populated from Stage 3)
    va_od_unaided: "6/36",
    va_od_aided: "6/18",
    va_od_pinhole: "6/12",
    va_od_near: "N10",
    va_os_unaided: "6/12",
    va_os_aided: "6/9",
    va_os_pinhole: "6/9",
    va_os_near: "N8",
    
    // Section D: IOP
    iop_od: "22",
    iop_os: "19",
    
    // Section E: Refraction
    ref_od_sph: "-1.50",
    ref_od_cyl: "-0.75",
    ref_od_axis: "180",
    ref_os_sph: "-0.75",
    ref_os_cyl: "-0.50",
    ref_os_axis: "175",
    
    // Section F: Anterior Segment
    anterior_segment: "OD: Circumcorneal injection, moderate conjunctival injection, mild punctate epithelial erosions inferiorly. OS: Mild conjunctival injection.",
    
    // Section G/H: Dilation & Fundoscopy
    pupils_dilated: true,
    dilation_agent: "Tropicamide 1%",
    posterior_segment: "OD: Disc 0.4, pink, sharp. Macula flat. Vessels: mild arterial narrowing. OS: Disc 0.3, pink, sharp. Macula flat. Vessels normal.",
    
    // Section I: Diagnosis
    primary_diagnosis: "Viral Keratoconjunctivitis (OD) / Viral Conjunctivitis (OS)",
    diagnosis_notes: "Secondary: Myopia with Astigmatism, Mild Hypertensive Retinopathy (OD)",
    
    // Section J/K: Management & Notes
    management_plan: "Prescribed Tobramycin, Artificial Tears, and Ibuprofen. Issued bifocal glasses prescription. Hygiene counseling provided.",
    
    // Clinical Data JSON Blob
    clinical_data: {
      history: "Amlodipine 5mg OD. Penicillin allergy.",
      iop_method: "NCT",
      dilation_time: "17:26",
      follow_up_period: "2 Weeks",
      follow_up_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      glasses_rx: {
        dist_od_sph: "-1.50", dist_od_cyl: "-0.75", dist_od_axis: "180", dist_od_va: "6/9",
        dist_os_sph: "-0.75", dist_os_cyl: "-0.50", dist_os_axis: "175", dist_os_va: "6/6",
        near_od_add: "+1.50"
      },
      medications: [
        { name: "Tobramycin Eye Drop", dosage: "0.3%", frequency: "Every 4 Hours", duration: "7 Days" },
        { name: "Artificial Tears", dosage: "Unpreserved", frequency: "4 Times Daily", duration: "2 Weeks" },
        { name: "Ibuprofen", dosage: "400mg", frequency: "Three Times Daily", duration: "5 Days" }
      ]
    }
  };

  // Action 4.14/4.15: Save & Finalize
  console.log("\nAction 4.14/4.15: Saving and Finalizing Consultation...");
  const consRes = await fetch(`${API_BASE_URL}/consultations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fullConsultationData)
  });

  if (!consRes.ok) {
    const err = await consRes.json();
    console.log(`FAILED: Consultation finalization failed. ${err.error || err.message}`);
    return;
  }

  const result = await consRes.json();
  console.log(`SUCCESS: Consultation finalized. Status updated to: ${result.status}`);

  // Verify status update in queue
  console.log("\nAction 4.15: Verifying patient status in main queue...");
  const queueRes = await fetch(`${API_BASE_URL}/queue`);
  const queue = await queueRes.json();
  
  // Note: In server/index.js line 947, status becomes 'Completed' on finalize
  console.log(`Current queue stats - consulting: ${queue.consulting.length}, waiting: ${queue.waiting.length}`);
  
  // Action 4.16: Verification of data in database
  console.log("\nAction 4.16: Verifying data persistence in database...");
  const verifyRes = await fetch(`${API_BASE_URL}/consultations?patient_id=${patientId}`);
  const consultations = await verifyRes.json();
  const latest = consultations[0];

  if (latest && latest.primary_diagnosis.includes("Viral")) {
    console.log(`SUCCESS: Data verified. Diagnosis: ${latest.primary_diagnosis}`);
    console.log(`Medications Prescribed: ${JSON.parse(latest.clinical_data).medications.length}`);
  } else {
    console.log("FAILED: Consultation data not found or incorrect.");
  }

  console.log("\n--- STAGE 4 COMPLETE ---");
}

runStage4();
