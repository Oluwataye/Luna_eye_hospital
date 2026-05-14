export enum PatientStatus {
  REGISTERED = 'Registered',
  WAITING_FOR_TRIAGE = 'Waiting for Triage',
  IN_TRIAGE = 'In Triage',
  WAITING_FOR_CONSULTATION = 'Waiting for Consultation',
  IN_CONSULTATION = 'In Consultation',
  CONSULTATION_COMPLETE = 'Consultation Complete',
  AWAITING_BILLING = 'Awaiting Billing',
  PARTIALLY_PAID = 'Partially Paid',
  PAID = 'Paid',
  ADMITTED = 'Admitted',
  AWAITING_SURGERY = 'Awaiting Surgery',
  SCHEDULED_FOR_FOLLOW_UP = 'Scheduled for Follow-Up',
  DISCHARGED = 'Discharged',
  CANCELLED = 'Cancelled'
}

export const StatusLabels: Record<PatientStatus, string> = {
  [PatientStatus.REGISTERED]: 'Registered',
  [PatientStatus.WAITING_FOR_TRIAGE]: 'Waiting for Triage',
  [PatientStatus.IN_TRIAGE]: 'In Triage',
  [PatientStatus.WAITING_FOR_CONSULTATION]: 'Waiting for Consultation',
  [PatientStatus.IN_CONSULTATION]: 'In Consultation',
  [PatientStatus.CONSULTATION_COMPLETE]: 'Consultation Complete',
  [PatientStatus.AWAITING_BILLING]: 'Awaiting Billing',
  [PatientStatus.PARTIALLY_PAID]: 'Partially Paid',
  [PatientStatus.PAID]: 'Paid',
  [PatientStatus.ADMITTED]: 'Admitted',
  [PatientStatus.AWAITING_SURGERY]: 'Awaiting Surgery',
  [PatientStatus.SCHEDULED_FOR_FOLLOW_UP]: 'Scheduled for Follow-Up',
  [PatientStatus.DISCHARGED]: 'Discharged',
  [PatientStatus.CANCELLED]: 'Cancelled'
};
