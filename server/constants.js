const PatientStatus = {
  REGISTERED: 'Registered',
  WAITING_FOR_TRIAGE: 'Waiting for Triage',
  IN_TRIAGE: 'In Triage',
  WAITING_FOR_CONSULTATION: 'Waiting for Consultation',
  IN_CONSULTATION: 'In Consultation',
  CONSULTATION_COMPLETE: 'Consultation Complete',
  AWAITING_BILLING: 'Awaiting Billing',
  PARTIALLY_PAID: 'Partially Paid',
  PAID: 'Paid',
  ADMITTED: 'Admitted',
  AWAITING_SURGERY: 'Awaiting Surgery',
  SCHEDULED_FOR_FOLLOW_UP: 'Scheduled for Follow-Up',
  DISCHARGED: 'Discharged',
  CANCELLED: 'Cancelled'
};

module.exports = { PatientStatus };
