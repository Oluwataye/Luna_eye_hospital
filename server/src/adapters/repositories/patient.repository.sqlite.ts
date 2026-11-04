import db from '../../infrastructure/database/sqlite';
import { Patient } from '../../domain/entities/patient.entity';
import { IPatientRepository } from '../../domain/repositories/patient.repository';

export class PatientRepositorySqlite implements IPatientRepository {
  findById(id: string): Promise<Patient | null> {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT p.*, f.family_name, f.family_card_number, f.contact_person_name as family_contact_name, f.contact_person_phone as family_contact_phone
         FROM patients p
         LEFT JOIN families f ON p.family_id = f.id
         WHERE p.id = ?`,
        [id],
        (err, row: any) => {
          if (err) return reject(err);
          resolve(row || null);
        }
      );
    });
  }

  create(patient: Patient): Promise<Patient> {
    return new Promise((resolve, reject) => {
      const {
        id, full_name, gender, dob, phone, alternate_phone, address,
        occupation, next_of_kin, next_of_kin_phone, marital_status,
        blood_group, genotype, allergies, medical_alerts, payment_category,
        tribe, religion, state_of_origin, next_of_kin_address,
        family_id, relationship_to_family, registration_type
      } = patient;
      db.run(
        `INSERT INTO patients (
          id, full_name, gender, dob, phone, alternate_phone, address, 
          occupation, next_of_kin, next_of_kin_phone, marital_status, 
          blood_group, genotype, allergies, medical_alerts, payment_category,
          tribe, religion, state_of_origin, next_of_kin_address,
          family_id, relationship_to_family, registration_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, full_name, gender, dob, phone, alternate_phone || null, address || null,
          occupation || null, next_of_kin || null, next_of_kin_phone || null, marital_status || null,
          blood_group || null, genotype || null, allergies || null, medical_alerts || null, payment_category || null,
          tribe || null, religion || null, state_of_origin || null, next_of_kin_address || null,
          family_id || null, relationship_to_family || null, registration_type || 'INDIVIDUAL'
        ],
        (err) => {
          if (err) return reject(err);
          resolve(patient);
        }
      );
    });
  }

  update(id: string, patient: Partial<Patient>): Promise<void> {
    return new Promise((resolve, reject) => {
      const keys = Object.keys(patient);
      if (keys.length === 0) return resolve();
      const setClause = keys.map(k => `${k} = ?`).join(', ');
      const values = Object.values(patient);
      db.run(`UPDATE patients SET ${setClause} WHERE id = ?`, [...values, id], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  findAll(filters: { search?: string; limit: number; offset: number }): Promise<Patient[]> {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT p.*, f.family_name, f.family_card_number, f.contact_person_name as family_contact_name, f.contact_person_phone as family_contact_phone
        FROM patients p
        LEFT JOIN families f ON p.family_id = f.id
      `;
      const params: any[] = [];
      if (filters.search) {
        query += ` WHERE p.full_name LIKE ? OR p.phone LIKE ? OR p.id LIKE ? OR f.family_name LIKE ? OR f.family_card_number LIKE ?`;
        const likePattern = `%${filters.search}%`;
        params.push(likePattern, likePattern, likePattern, likePattern, likePattern);
      }
      query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
      params.push(filters.limit, filters.offset);

      db.all(query, params, (err, rows: Patient[]) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  generateNextFileNumber(): Promise<string> {
    return new Promise((resolve, reject) => {
      const currentYear = new Date().getFullYear().toString().slice(-2);
      db.all(
        `SELECT id as card_num FROM patients WHERE id LIKE ?
         UNION
         SELECT family_card_number as card_num FROM families WHERE family_card_number LIKE ?`,
        [`%/${currentYear}/LEH`, `%/${currentYear}/LEH`],
        (err, rows: any[]) => {
          if (err) return reject(err);
          let maxNumber = 0;
          if (rows && rows.length > 0) {
            for (const r of rows) {
              const parts = (r.card_num || '').split('/');
              const num = parseInt(parts[0], 10);
              if (!isNaN(num) && num > maxNumber) {
                maxNumber = num;
              }
            }
          }
          const nextNumber = maxNumber + 1;
          const paddedCount = String(nextNumber).padStart(4, '0');
          resolve(`${paddedCount}/${currentYear}/LEH`);
        }
      );
    });
  }
}
