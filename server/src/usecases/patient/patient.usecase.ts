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

  async registerPatient(patientData: Omit<Patient, 'id' | 'created_at'> & { hospital_number?: string }): Promise<Patient> {
    const rawNumber = (patientData as any).hospital_number;
    const manualNumber = typeof rawNumber === 'string' ? rawNumber.trim().toUpperCase() : '';

    if (manualNumber) {
      // Check if a patient already exists with this exact hospital number
      const existingByNumber = await this.patientRepository.findById(manualNumber);
      if (existingByNumber) {
        // Update existing patient record with new clinical / demographic data
        const { hospital_number, ...dataToUpdate } = patientData as any;
        await this.patientRepository.update(manualNumber, dataToUpdate);
        const updated = await this.patientRepository.findById(manualNumber);
        return updated!;
      }

      // Check for potential duplicate by name & phone / dob under a different number
      const existingPatients = await this.patientRepository.findAll({ search: patientData.full_name, limit: 100, offset: 0 });
      const duplicate = existingPatients.find(
        p => p.full_name.toLowerCase() === patientData.full_name.toLowerCase() && (p.phone === patientData.phone || p.dob === patientData.dob)
      );
      if (duplicate && duplicate.id !== manualNumber) {
        throw new Error(`Duplicate patient detected: A patient named ${patientData.full_name} is already registered under Hospital Number ${duplicate.id}.`);
      }

      const { hospital_number, ...cleanData } = patientData as any;
      const newPatient: Patient = {
        ...cleanData,
        id: manualNumber
      };
      return this.patientRepository.create(newPatient);
    }

    // Default New Patient workflow: check duplicates
    const existingPatients = await this.patientRepository.findAll({ search: patientData.full_name, limit: 100, offset: 0 });
    const duplicate = existingPatients.find(
      p => p.full_name.toLowerCase() === patientData.full_name.toLowerCase() && (p.phone === patientData.phone || p.dob === patientData.dob)
    );
    if (duplicate) {
      throw new Error(`Duplicate patient detected: A patient named ${patientData.full_name} with similar details already exists (ID: ${duplicate.id}).`);
    }

    const nextId = await this.patientRepository.generateNextFileNumber();
    const { hospital_number, ...cleanData } = patientData as any;
    const newPatient: Patient = {
      ...cleanData,
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
