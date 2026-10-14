import { Request, Response } from 'express';
import { PatientUseCase } from '../../usecases/patient/patient.usecase';

export class PatientController {
  constructor(private patientUseCase: PatientUseCase) {}

  async getPatients(req: Request, res: Response): Promise<void> {
    try {
      const q: any = (req as any).sanitizedQuery || req.query || {};
      const id = q.id as string | undefined;

      if (id) {
        const decodedId = decodeURIComponent(id).trim();
        const patient = await this.patientUseCase.getPatientById(decodedId);
        res.status(200).json(patient ? [patient] : []);
        return;
      }

      const search = q.search as string | undefined;
      const limit = typeof q.limit === 'number' ? q.limit : (parseInt(q.limit as string) || 200);
      const offset = typeof q.offset === 'number' ? q.offset : (parseInt(q.offset as string) || 0);

      const patients = await this.patientUseCase.getPatients({ search, limit, offset });
      res.status(200).json(patients);
    } catch (err: any) {
      console.error('[PATIENTS] Get patients error:', err.message);
      res.status(500).json({ error: 'Failed to retrieve patients' });
    }
  }

  async getPatientById(req: Request, res: Response): Promise<void> {
    try {
      let rawId = (req.params as any).id ?? (req.params as any)[0] ?? req.query.id;
      if (Array.isArray(rawId)) {
        rawId = rawId.join('/');
      }
      if (!rawId) {
        res.status(400).json({ error: 'Patient ID is required' });
        return;
      }
      const id = decodeURIComponent(String(rawId)).trim();
      const patient = await this.patientUseCase.getPatientById(id);
      if (!patient) {
        res.status(404).json({ error: 'Patient not found' });
        return;
      }
      res.status(200).json(patient);
    } catch (err: any) {
      console.error('[PATIENTS] Get patient error:', err.message);
      res.status(500).json({ error: 'Failed to retrieve patient' });
    }
  }

  async registerPatient(req: Request, res: Response): Promise<void> {
    try {
      console.log('REGISTRATION_ATTEMPT:', JSON.stringify(req.body));
      const registered = await this.patientUseCase.registerPatient(req.body);
      res.status(201).json(registered);
    } catch (err: any) {
      console.error('[PATIENTS] Registration failure:', err.message);
      if (err.message.includes('Duplicate patient')) {
        res.status(409).json({ error: 'Duplicate patient detected', message: err.message });
      } else {
        res.status(500).json({ error: err.message || 'Failed to register patient' });
      }
    }
  }

  async updatePatient(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.patientUseCase.updatePatient(id as string, req.body);
      res.status(200).json({ message: 'Patient details updated successfully' });
    } catch (err: any) {
      console.error('[PATIENTS] Update failure:', err.message);
      res.status(500).json({ error: err.message || 'Failed to update patient details' });
    }
  }
}
