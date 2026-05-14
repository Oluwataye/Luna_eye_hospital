export enum PatientStatus {
  REGISTERED = 'REGISTERED',
  CHECKED_IN = 'CHECKED_IN',
  WAITING_FOR_TRIAGE = 'WAITING_FOR_TRIAGE',
  TRIAGE_COMPLETE = 'TRIAGE_COMPLETE',
  WAITING_FOR_CONSULTATION = 'WAITING_FOR_CONSULTATION',
  IN_CONSULTATION = 'IN_CONSULTATION',
  CONSULTATION_COMPLETE = 'CONSULTATION_COMPLETE',
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PAID = 'PAID',
  DISCHARGED = 'DISCHARGED'
}

export const StatusLabels: Record<PatientStatus, string> = {
  [PatientStatus.REGISTERED]: 'Registered',
  [PatientStatus.CHECKED_IN]: 'Checked In',
  [PatientStatus.WAITING_FOR_TRIAGE]: 'Waiting for Triage',
  [PatientStatus.TRIAGE_COMPLETE]: 'Triage Complete',
  [PatientStatus.WAITING_FOR_CONSULTATION]: 'Waiting for Consultation',
  [PatientStatus.IN_CONSULTATION]: 'In Consultation',
  [PatientStatus.CONSULTATION_COMPLETE]: 'Consultation Complete',
  [PatientStatus.PENDING_PAYMENT]: 'Pending Payment',
  [PatientStatus.PAID]: 'Paid',
  [PatientStatus.DISCHARGED]: 'Discharged'
};
