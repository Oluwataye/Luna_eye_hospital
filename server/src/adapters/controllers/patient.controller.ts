import { Request, Response } from 'express';
import { PatientUseCase } from '../../usecases/patient/patient.usecase';

export class PatientController {
  constructor(private patientUseCase: PatientUseCase) {}

  async getPatients(req: Request, res: Response): Promise<void> {
    try {
      const search = req.query.search as string | undefined;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      const patients = await this.patientUseCase.getPatients({ search, limit, offset });
      res.status(200).json(patients);
    } catch (err: any) {
      console.error('[PATIENTS] Get patients error:', err.message);
      res.status(500).json({ error: 'Failed to retrieve patients' });
    }
  }

  async getPatientById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const patient = await this.patientUseCase.getPatientById(id as string);
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
