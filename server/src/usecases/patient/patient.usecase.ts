import { Patient } from '../../domain/entities/patient.entity';
import { IPatientRepository } from '../../domain/repositories/patient.repository';

export class PatientUseCase {
  constructor(private patientRepository: IPatientRepository) {}

  async getPatients(filters: { search?: string; limit: number; offset: number }): Promise<Patient[]> {
    return this.patientRepository.findAll(filters);
  }

  async getPatientById(id: string): Promise<Patient | null> {
    return this.patientRepository.findById(id);
  }

  async registerPatient(patientData: Omit<Patient, 'id' | 'created_at'>): Promise<Patient> {
    // Check for duplicates
    const existingPatients = await this.patientRepository.findAll({ search: patientData.full_name, limit: 100, offset: 0 });
    const duplicate = existingPatients.find(
      p => p.full_name === patientData.full_name && (p.phone === patientData.phone || p.dob === patientData.dob)
    );
    if (duplicate) {
      throw new Error(`Duplicate patient detected: A patient named ${patientData.full_name} with similar details already exists (ID: ${duplicate.id}).`);
    }

    const nextId = await this.patientRepository.generateNextFileNumber();
    const newPatient: Patient = {
      ...patientData,
      id: nextId
    };

    return this.patientRepository.create(newPatient);
  }

  async updatePatient(id: string, patientData: Partial<Patient>): Promise<void> {
    const existing = await this.patientRepository.findById(id);
    if (!existing) {
      throw new Error('Patient not found');
    }
    return this.patientRepository.update(id, patientData);
  }
}
