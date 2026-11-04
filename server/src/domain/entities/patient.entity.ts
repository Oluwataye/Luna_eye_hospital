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
  department?: string;
  created_at?: string;
  // Extended demographic & family fields
  tribe?: string;
  religion?: string;
  state_of_origin?: string;
  next_of_kin_address?: string;
  family_id?: number | null;
  relationship_to_family?: string | null;
  registration_type?: 'INDIVIDUAL' | 'FAMILY_MEMBER';
  // Joined Family context
  family_name?: string;
  family_card_number?: string;
  family_contact_name?: string;
  family_contact_phone?: string;
}
