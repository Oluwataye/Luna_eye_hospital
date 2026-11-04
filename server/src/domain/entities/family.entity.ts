import { Patient } from './patient.entity';

export interface Family {
  id: number;
  family_card_number: string; // e.g. 0002/26/LEH
  family_name: string;        // surname only e.g. "Taiwo"
  contact_person_name: string;
  contact_person_phone: string;
  residential_address?: string;
  tribe?: string;
  state_of_origin?: string;
  is_active?: number;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  updated_by?: string;
  members_count?: number;
  members?: Patient[];
}
