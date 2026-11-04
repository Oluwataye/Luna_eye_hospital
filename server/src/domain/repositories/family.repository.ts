import { Family } from '../entities/family.entity';
import { Patient } from '../entities/patient.entity';

export interface IFamilyRepository {
  findById(id: number): Promise<Family | null>;
  findByCardNumber(cardNumber: string): Promise<Family | null>;
  findExactDuplicate(familyName: string, phone: string): Promise<Family | null>;
  findBySurname(familyName: string): Promise<Family[]>;
  create(family: Partial<Family>): Promise<Family>;
  update(id: number, family: Partial<Family>): Promise<void>;
  deactivate(id: number, updatedBy?: string): Promise<void>;
  findAll(filters: { search?: string; limit: number; offset: number }): Promise<Family[]>;
  getFamilyMembers(familyId: number): Promise<Patient[]>;
  hasClinicalHistory(familyId: number): Promise<{ hasHistory: boolean; count: number; details: string }>;
  generateNextFamilyCardNumber(): Promise<string>;
}
