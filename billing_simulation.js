const API_BASE_URL = 'http://127.0.0.1/api';

async function simulateBilling() {
  console.log("--- Phase 4: Billing Simulation ---");
  
  const patientId = '0009/26/LEH';
  const cashier = 'John Doe (Cashier)';

  // 1. Prepare items
  const items = [
    { description: 'Consultation Fee', qty: 1, unit_price: 2000 },
    { description: 'Refraction Fee', qty: 1, unit_price: 1000 },
    { inventory_id: 'INV-1777896626068', description: 'CR39 Single Vision', qty: 1, unit_price: 10000 }
  ];

  const total = items.reduce((sum, item) => sum + (item.qty * item.unit_price), 0);

  // 2. Process Transaction
  console.log(`2. Processing transaction for ${patientId}. Total Amount: ₦${total.toLocaleString()}`);
  
  const payload = {
    patient_id: patientId,
    amount_paid: total,
    discount: 0,
    payment_method: 'POS',
    payment_details: { card_type: 'Mastercard', last4: '1234' },
    cashier: cashier,
    items: items
  };

  const res = await fetch(`${API_BASE_URL}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    const result = await res.json();
    console.log(`SUCCESS: Transaction completed. Receipt No: ${result.receipt_no}`);
    console.log(`Status: ${result.status}, Balance: ₦${result.balance}`);
  } else {
    const error = await res.json();
    console.log(`FAILED: Could not process transaction. Error: ${error.error}`);
    return;
  }

  // 3. Verify Inventory Stock Reduction
  console.log("3. Verifying inventory stock reduction for 'CR39 Single Vision'...");
  const invRes = await fetch(`${API_BASE_URL}/inventory`);
  const inventory = await invRes.json();
  const lensItem = inventory.find(i => i.id === 'INV-1777896626068');
  
  if (lensItem) {
    console.log(`Current stock: ${lensItem.stock} (Initial was 10)`);
    if (lensItem.stock === 9) {
      console.log("SUCCESS: Inventory correctly decremented.");
    } else {
      console.log("FAILED: Inventory count mismatch.");
    }
  } else {
    console.log("FAILED: Could not find inventory item after transaction.");
  }
}

simulateBilling();
