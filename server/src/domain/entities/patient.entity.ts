export interface Patient {
  id: string; // e.g. 0001/26/LEH
  full_name: string;
  gender: string;
  dob: string;
  phone: string;
  alternate_phone?: string;
  address?: string;
  occupation?: string;
  next_of_kin?: string;
  next_of_kin_phone?: string;
  marital_status?: string;
  blood_group?: string;
  genotype?: string;
  allergies?: string;
  medical_alerts?: string;
  payment_category?: string;
  created_at?: string;
}
