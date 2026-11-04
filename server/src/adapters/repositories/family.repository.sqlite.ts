import db from '../../infrastructure/database/sqlite';
import { Family } from '../../domain/entities/family.entity';
import { Patient } from '../../domain/entities/patient.entity';
import { IFamilyRepository } from '../../domain/repositories/family.repository';

export class FamilyRepositorySqlite implements IFamilyRepository {
  findById(id: number): Promise<Family | null> {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM families WHERE id = ?', [id], (err, row: any) => {
        if (err) return reject(err);
        resolve(row || null);
      });
    });
  }

  findByCardNumber(cardNumber: string): Promise<Family | null> {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM families WHERE family_card_number = ?', [cardNumber], (err, row: any) => {
        if (err) return reject(err);
        resolve(row || null);
      });
    });
  }

  findExactDuplicate(familyName: string, phone: string): Promise<Family | null> {
    return new Promise((resolve, reject) => {
      const cleanName = (familyName || '').trim().toLowerCase();
      const cleanPhone = (phone || '').replace(/\s+/g, '');
      db.get(
        'SELECT * FROM families WHERE LOWER(TRIM(family_name)) = ? AND REPLACE(contact_person_phone, " ", "") = ? AND is_active = 1',
        [cleanName, cleanPhone],
        (err, row: any) => {
          if (err) return reject(err);
          resolve(row || null);
        }
      );
    });
  }

  findBySurname(familyName: string): Promise<Family[]> {
    return new Promise((resolve, reject) => {
      const cleanName = (familyName || '').trim().toLowerCase();
      db.all(
        'SELECT * FROM families WHERE LOWER(TRIM(family_name)) = ? AND is_active = 1',
        [cleanName],
        (err, rows: any[]) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });
  }

  create(family: Partial<Family>): Promise<Family> {
    return new Promise((resolve, reject) => {
      const {
        family_card_number,
        family_name,
        contact_person_name,
        contact_person_phone,
        residential_address,
        tribe,
        state_of_origin,
        created_by
      } = family;

      db.run(
        `INSERT INTO families (
          family_card_number, family_name, contact_person_name, contact_person_phone,
          residential_address, tribe, state_of_origin, is_active, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))`,
        [
          family_card_number,
          (family_name || '').trim(),
          (contact_person_name || '').trim(),
          (contact_person_phone || '').trim(),
          residential_address || null,
          tribe || null,
          state_of_origin || null,
          created_by || 'System'
        ],
        function(this: any, err) {
          if (err) return reject(err);
          const newId = this.lastID;
          db.get('SELECT * FROM families WHERE id = ?', [newId], (fetchErr, row: any) => {
            if (fetchErr) return reject(fetchErr);
            resolve(row);
          });
        }
      );
    });
  }

  update(id: number, family: Partial<Family>): Promise<void> {
    return new Promise((resolve, reject) => {
      const allowedKeys = [
        'family_name', 'contact_person_name', 'contact_person_phone',
        'residential_address', 'tribe', 'state_of_origin', 'updated_by'
      ];
      const updates: string[] = [];
      const values: any[] = [];

      allowedKeys.forEach(key => {
        if ((family as any)[key] !== undefined) {
          updates.push(`${key} = ?`);
          values.push((family as any)[key]);
        }
      });

      if (updates.length === 0) return resolve();

      updates.push("updated_at = datetime('now')");
      values.push(id);

      db.run(`UPDATE families SET ${updates.join(', ')} WHERE id = ?`, values, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  deactivate(id: number, updatedBy = 'System'): Promise<void> {
    return new Promise((resolve, reject) => {
      db.run(
        "UPDATE families SET is_active = 0, updated_by = ?, updated_at = datetime('now') WHERE id = ?",
        [updatedBy, id],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  findAll(filters: { search?: string; limit: number; offset: number }): Promise<Family[]> {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT f.*, COUNT(p.id) AS members_count
        FROM families f
        LEFT JOIN patients p ON p.family_id = f.id
        WHERE f.is_active = 1
      `;
      const params: any[] = [];

      if (filters.search) {
        const like = `%${filters.search.trim()}%`;
        query += ` AND (f.family_name LIKE ? OR f.family_card_number LIKE ? OR f.contact_person_name LIKE ? OR f.contact_person_phone LIKE ?)`;
        params.push(like, like, like, like);
      }

      query += ` GROUP BY f.id ORDER BY f.created_at DESC LIMIT ? OFFSET ?`;
      params.push(filters.limit, filters.offset);

      db.all(query, params, (err, rows: any[]) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  getFamilyMembers(familyId: number): Promise<Patient[]> {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT p.*, f.family_name, f.family_card_number
         FROM patients p
         JOIN families f ON p.family_id = f.id
         WHERE p.family_id = ?
         ORDER BY p.created_at ASC`,
        [familyId],
        (err, rows: any[]) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });
  }

  hasClinicalHistory(familyId: number): Promise<{ hasHistory: boolean; count: number; details: string }> {
    return new Promise((resolve, reject) => {
      // Find all patient IDs in this family
      db.all('SELECT id FROM patients WHERE family_id = ?', [familyId], (err, patientRows: any[]) => {
        if (err) return reject(err);
        if (!patientRows || patientRows.length === 0) {
          return resolve({ hasHistory: false, count: 0, details: 'No registered members' });
        }

        const patientIds = patientRows.map(r => r.id);
        const placeholders = patientIds.map(() => '?').join(',');

        const checkSql = `
          SELECT 
            (SELECT COUNT(*) FROM visits WHERE patient_id IN (${placeholders})) AS visits_count,
            (SELECT COUNT(*) FROM consultations WHERE patient_id IN (${placeholders})) AS consults_count,
            (SELECT COUNT(*) FROM investigations WHERE patient_id IN (${placeholders})) AS inv_count,
            (SELECT COUNT(*) FROM transactions WHERE patient_id IN (${placeholders})) AS trans_count
        `;

        db.get(checkSql, [...patientIds, ...patientIds, ...patientIds, ...patientIds], (checkErr, counts: any) => {
          if (checkErr) return reject(checkErr);
          const totalRecords = (counts?.visits_count || 0) + 
                               (counts?.consults_count || 0) + 
                               (counts?.inv_count || 0) + 
                               (counts?.trans_count || 0);
          
          if (totalRecords > 0) {
            resolve({
              hasHistory: true,
              count: totalRecords,
              details: `${counts.visits_count || 0} visits, ${counts.consults_count || 0} consultations, ${counts.inv_count || 0} investigations, ${counts.trans_count || 0} billing records`
            });
          } else {
            resolve({ hasHistory: false, count: 0, details: 'No clinical history recorded' });
          }
        });
      });
    });
  }

  generateNextFamilyCardNumber(): Promise<string> {
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
