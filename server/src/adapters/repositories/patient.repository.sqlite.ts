import db from '../../infrastructure/database/sqlite';
import { Patient } from '../../domain/entities/patient.entity';
import { IPatientRepository } from '../../domain/repositories/patient.repository';

export class PatientRepositorySqlite implements IPatientRepository {
  findById(id: string): Promise<Patient | null> {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM patients WHERE id = ?', [id], (err, row: any) => {
        if (err) return reject(err);
        resolve(row || null);
      });
    });
  }

  create(patient: Patient): Promise<Patient> {
    return new Promise((resolve, reject) => {
      const {
        id, full_name, gender, dob, phone, alternate_phone, address,
        occupation, next_of_kin, next_of_kin_phone, marital_status,
        blood_group, genotype, allergies, medical_alerts, payment_category
      } = patient;
      db.run(
        `INSERT INTO patients (
          id, full_name, gender, dob, phone, alternate_phone, address, 
          occupation, next_of_kin, next_of_kin_phone, marital_status, 
          blood_group, genotype, allergies, medical_alerts, payment_category
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, full_name, gender, dob, phone, alternate_phone || null, address || null,
          occupation || null, next_of_kin || null, next_of_kin_phone || null, marital_status || null,
          blood_group || null, genotype || null, allergies || null, medical_alerts || null, payment_category || null
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
      let query = 'SELECT * FROM patients';
      const params: any[] = [];
      if (filters.search) {
        query += ' WHERE full_name LIKE ? OR phone LIKE ? OR id LIKE ?';
        const likePattern = `%${filters.search}%`;
        params.push(likePattern, likePattern, likePattern);
      }
      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
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
      db.get(
        "SELECT id FROM patients WHERE id LIKE ? ORDER BY id DESC LIMIT 1",
        [`%/${currentYear}/LETH`],
        (err, lastPatient: any) => {
          if (err) return reject(err);
          let nextNumber = 1;
          if (lastPatient) {
            const lastIdParts = lastPatient.id.split('/');
            nextNumber = parseInt(lastIdParts[0]) + 1;
          }
          const paddedCount = String(nextNumber).padStart(4, '0');
          resolve(`${paddedCount}/${currentYear}/LETH`);
        }
      );
    });
  }
}
