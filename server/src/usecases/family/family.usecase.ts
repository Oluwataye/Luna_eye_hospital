import { IFamilyRepository } from '../../domain/repositories/family.repository';
import { IPatientRepository } from '../../domain/repositories/patient.repository';
import { Family } from '../../domain/entities/family.entity';
import { Patient } from '../../domain/entities/patient.entity';

export class FamilyUseCase {
  constructor(
    private familyRepository: IFamilyRepository,
    private patientRepository: IPatientRepository
  ) {}

  async getFamilies(filters: { search?: string; limit: number; offset: number }): Promise<Family[]> {
    return this.familyRepository.findAll(filters);
  }

  async getFamilyById(idOrCardNumber: number | string): Promise<Family | null> {
    let family: Family | null = null;
    const numericId = Number(idOrCardNumber);
    if (!isNaN(numericId) && numericId > 0 && String(numericId) === String(idOrCardNumber).trim()) {
      family = await this.familyRepository.findById(numericId);
    }
    if (!family) {
      family = await this.familyRepository.findByCardNumber(String(idOrCardNumber).trim());
    }
    if (!family) return null;

    // Attach members
    const members = await this.familyRepository.getFamilyMembers(family.id);
    return {
      ...family,
      members_count: members.length,
      members
    };
  }

  async createFamily(data: {
    family_name: string;
    contact_person_name: string;
    contact_person_phone: string;
    residential_address?: string;
    tribe?: string;
    state_of_origin?: string;
    existing_card_number?: string;
    confirm_duplicate?: boolean;
    created_by?: string;
  }): Promise<{ family?: Family; warning?: string; matches?: Family[] }> {
    const rawSurname = (data.family_name || '').trim();
    const cleanSurname = rawSurname.replace(/\s+family$/i, '').trim();
    const phone = (data.contact_person_phone || '').trim();

    // ── EXISTING CARD NUMBER CAPTURE PATH ──────────────────────────────────────
    // When the family already holds a physical card but isn't in the EMR yet.
    // Preserve their existing card number; skip auto-generation and surname checks.
    if (data.existing_card_number) {
      const existingCardNum = data.existing_card_number.trim().toUpperCase();

      // Guard: ensure this card number isn't already taken
      const alreadyRegistered = await this.familyRepository.findByCardNumber(existingCardNum);
      if (alreadyRegistered) {
        throw new Error(
          `Card number "${existingCardNum}" is already registered as "${alreadyRegistered.family_name} Family" (ID ${alreadyRegistered.id}). Use the lookup to update that existing record instead.`
        );
      }

      const created = await this.familyRepository.create({
        family_card_number: existingCardNum,
        family_name: cleanSurname,
        contact_person_name: data.contact_person_name.trim(),
        contact_person_phone: phone,
        residential_address: data.residential_address?.trim() || undefined,
        tribe: data.tribe?.trim() || undefined,
        state_of_origin: data.state_of_origin?.trim() || undefined,
        created_by: data.created_by || 'System'
      });

      return { family: created };
    }
    // ── END EXISTING CARD PATH ─────────────────────────────────────────────────

    // 1. Prevent exact duplicate: same surname + same contact phone
    const exactMatch = await this.familyRepository.findExactDuplicate(cleanSurname, phone);
    if (exactMatch) {
      throw new Error(
        `Duplicate family detected: A family under "${exactMatch.family_name} Family" with phone ${exactMatch.contact_person_phone} is already registered under Card Number ${exactMatch.family_card_number}.`
      );
    }

    // 2. Check for same surname matches if not confirmed
    if (!data.confirm_duplicate) {
      const surnameMatches = await this.familyRepository.findBySurname(cleanSurname);
      if (surnameMatches && surnameMatches.length > 0) {
        return {
          warning: 'duplicate_surname_detected',
          matches: surnameMatches
        };
      }
    }

    // 3. Generate unique card number (maintains exact existing scheme)
    const familyCardNumber = await this.familyRepository.generateNextFamilyCardNumber();

    const created = await this.familyRepository.create({
      family_card_number: familyCardNumber,
      family_name: cleanSurname,
      contact_person_name: data.contact_person_name.trim(),
      contact_person_phone: phone,
      residential_address: data.residential_address?.trim() || undefined,
      tribe: data.tribe?.trim() || undefined,
      state_of_origin: data.state_of_origin?.trim() || undefined,
      created_by: data.created_by || 'System'
    });

    return { family: created };
  }

  async updateFamily(id: number, data: Partial<Family>, updatedBy = 'System'): Promise<void> {
    const existing = await this.familyRepository.findById(id);
    if (!existing) {
      throw new Error('Family record not found');
    }

    const cleanData = { ...data };
    if (cleanData.family_name) {
      cleanData.family_name = cleanData.family_name.replace(/\s+family$/i, '').trim();
    }
    cleanData.updated_by = updatedBy;

    await this.familyRepository.update(id, cleanData);
  }

  async deactivateFamily(id: number, updatedBy = 'System'): Promise<void> {
    const existing = await this.familyRepository.findById(id);
    if (!existing) {
      throw new Error('Family record not found');
    }

    // Integrity Rule: A family cannot be deleted if members have clinical records
    const historyCheck = await this.familyRepository.hasClinicalHistory(id);
    if (historyCheck.hasHistory) {
      throw new Error(
        `Cannot deactivate "${existing.family_name} Family": Associated members have ${historyCheck.count} active clinical record(s) (${historyCheck.details}). Deletion is prohibited to preserve medical history integrity.`
      );
    }

    await this.familyRepository.deactivate(id, updatedBy);
  }

  async addMember(
    familyId: number,
    memberData: any,
    createdBy = 'System'
  ): Promise<Patient> {
    const family = await this.familyRepository.findById(familyId);
    if (!family) {
      throw new Error('Family household not found');
    }

    // Name formatting: handle first_name + last_name or full_name
    let fullName = (memberData.full_name || '').trim();
    if (!fullName && (memberData.first_name || memberData.last_name)) {
      const first = (memberData.first_name || '').trim();
      const last = (memberData.last_name || '').trim();
      fullName = `${last} ${first}`.trim();
    }
    if (!fullName) {
      throw new Error('Patient member name is required');
    }

    // Pre-fill demographics from family if not explicitly provided
    const address = memberData.address || family.residential_address || null;
    const tribe = memberData.tribe || family.tribe || null;
    const stateOfOrigin = memberData.state_of_origin || family.state_of_origin || null;

    // Generate next patient hospital ID
    const nextPatientId = await this.patientRepository.generateNextFileNumber();

    const newPatient: Patient = {
      id: nextPatientId,
      full_name: fullName,
      gender: memberData.gender || 'Other',
      dob: memberData.dob || '',
      phone: memberData.phone || family.contact_person_phone,
      alternate_phone: memberData.alternate_phone || null,
      address,
      occupation: memberData.occupation || null,
      next_of_kin: memberData.next_of_kin || family.contact_person_name,
      next_of_kin_phone: memberData.next_of_kin_phone || family.contact_person_phone,
      next_of_kin_address: memberData.next_of_kin_address || address,
      marital_status: memberData.marital_status || null,
      blood_group: memberData.blood_group || null,
      genotype: memberData.genotype || null,
      allergies: memberData.allergies || null,
      medical_alerts: memberData.medical_alerts || null,
      payment_category: memberData.payment_category || 'Standard',
      department: memberData.department || 'General',
      tribe,
      religion: memberData.religion || null,
      state_of_origin: stateOfOrigin,
      family_id: family.id,
      relationship_to_family: memberData.relationship_to_family || 'Other',
      registration_type: 'FAMILY_MEMBER'
    };

    return this.patientRepository.create(newPatient);
  }

  async linkPatient(
    familyId: number,
    patientId: string,
    relationshipToFamily: string
  ): Promise<void> {
    const family = await this.familyRepository.findById(familyId);
    if (!family) {
      throw new Error('Family household not found');
    }

    const patient = await this.patientRepository.findById(patientId);
    if (!patient) {
      throw new Error('Patient not found');
    }

    await this.patientRepository.update(patientId, {
      family_id: family.id,
      relationship_to_family: relationshipToFamily || 'Other',
      registration_type: 'FAMILY_MEMBER'
    });
  }

  async removeMember(familyId: number, patientId: string): Promise<void> {
    const patient = await this.patientRepository.findById(patientId);
    if (!patient) {
      throw new Error('Patient not found');
    }

    if (patient.family_id !== familyId) {
      throw new Error('Patient does not belong to this family');
    }

    // Detach from family without deleting any clinical data
    await this.patientRepository.update(patientId, {
      family_id: null,
      relationship_to_family: null,
      registration_type: 'INDIVIDUAL'
    });
  }
}
