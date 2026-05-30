import { Patient } from '../entities/patient.entity';

export interface IPatientRepository {
  findById(id: string): Promise<Patient | null>;
  create(patient: Patient): Promise<Patient>;
  update(id: string, patient: Partial<Patient>): Promise<void>;
  findAll(filters: { search?: string; limit: number; offset: number }): Promise<Patient[]>;
  generateNextFileNumber(): Promise<string>;
}
