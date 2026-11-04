import { Request, Response } from 'express';
import { FamilyUseCase } from '../../usecases/family/family.usecase';

const getParam = (param: string | string[] | undefined): string => {
  if (Array.isArray(param)) return param.join('/');
  return param || '';
};

export class FamilyController {
  constructor(private familyUseCase: FamilyUseCase) {}

  async getFamilies(req: Request, res: Response): Promise<void> {
    try {
      const q: any = (req as any).sanitizedQuery || req.query || {};
      const search = q.search as string | undefined;
      const limit = typeof q.limit === 'number' ? q.limit : (parseInt(q.limit as string) || 100);
      const offset = typeof q.offset === 'number' ? q.offset : (parseInt(q.offset as string) || 0);

      const families = await this.familyUseCase.getFamilies({ search, limit, offset });
      res.status(200).json(families);
    } catch (err: any) {
      console.error('[FAMILIES] Get families error:', err.message);
      res.status(500).json({ error: 'Failed to retrieve families' });
    }
  }

  async getFamilyById(req: Request, res: Response): Promise<void> {
    try {
      const rawParam = getParam(req.params.id) || (req.query as any)?.id || (req.query as any)?.card_no;
      if (!rawParam) {
        res.status(400).json({ error: 'Family ID or card number is required' });
        return;
      }

      const family = await this.familyUseCase.getFamilyById(decodeURIComponent(String(rawParam)).trim());
      if (!family) {
        res.status(404).json({ error: 'Family not found' });
        return;
      }

      res.status(200).json(family);
    } catch (err: any) {
      console.error('[FAMILIES] Get family error:', err.message);
      res.status(500).json({ error: 'Failed to retrieve family details' });
    }
  }

  async createFamily(req: Request, res: Response): Promise<void> {
    try {
      const body = (req as any).sanitizedBody || req.body || {};
      const createdBy = (req as any).user?.full_name || 'System';

      const result = await this.familyUseCase.createFamily({
        ...body,
        created_by: createdBy
      });

      if (result.warning === 'duplicate_surname_detected') {
        res.status(200).json({
          warning: 'duplicate_surname_detected',
          message: `Existing families registered under surname "${body.family_name}" were found. Please confirm if you wish to register a new household.`,
          matches: result.matches
        });
        return;
      }

      res.status(201).json(result.family);
    } catch (err: any) {
      console.error('[FAMILIES] Create family error:', err.message);
      if (err.message.includes('Duplicate family detected')) {
        res.status(409).json({ error: 'Duplicate family detected', message: err.message });
      } else {
        res.status(400).json({ error: err.message || 'Failed to register family' });
      }
    }
  }

  async updateFamily(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(getParam(req.params.id), 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Valid Family ID is required' });
        return;
      }

      const body = (req as any).sanitizedBody || req.body || {};
      const updatedBy = (req as any).user?.full_name || 'System';

      await this.familyUseCase.updateFamily(id, body, updatedBy);
      res.status(200).json({ message: 'Family details updated successfully' });
    } catch (err: any) {
      console.error('[FAMILIES] Update family error:', err.message);
      res.status(500).json({ error: err.message || 'Failed to update family details' });
    }
  }

  async deactivateFamily(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(getParam(req.params.id), 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Valid Family ID is required' });
        return;
      }

      const updatedBy = (req as any).user?.full_name || 'System';
      await this.familyUseCase.deactivateFamily(id, updatedBy);
      res.status(200).json({ message: 'Family household deactivated successfully' });
    } catch (err: any) {
      console.error('[FAMILIES] Deactivate family error:', err.message);
      res.status(400).json({ error: err.message || 'Failed to deactivate family' });
    }
  }

  async addMember(req: Request, res: Response): Promise<void> {
    try {
      const familyId = parseInt(getParam(req.params.id), 10);
      if (isNaN(familyId)) {
        res.status(400).json({ error: 'Valid Family ID is required' });
        return;
      }

      const body = (req as any).sanitizedBody || req.body || {};
      const createdBy = (req as any).user?.full_name || 'System';

      const newMember = await this.familyUseCase.addMember(familyId, body, createdBy);
      res.status(201).json(newMember);
    } catch (err: any) {
      console.error('[FAMILIES] Add member error:', err.message);
      res.status(400).json({ error: err.message || 'Failed to add family member' });
    }
  }

  async linkPatient(req: Request, res: Response): Promise<void> {
    try {
      const familyId = parseInt(getParam(req.params.id), 10);
      if (isNaN(familyId)) {
        res.status(400).json({ error: 'Valid Family ID is required' });
        return;
      }

      const body = (req as any).sanitizedBody || req.body || {};
      const { patient_id, relationship_to_family } = body;

      if (!patient_id) {
        res.status(400).json({ error: 'patient_id is required' });
        return;
      }

      await this.familyUseCase.linkPatient(familyId, patient_id, relationship_to_family || 'Other');
      res.status(200).json({ message: 'Patient linked to family successfully' });
    } catch (err: any) {
      console.error('[FAMILIES] Link patient error:', err.message);
      res.status(400).json({ error: err.message || 'Failed to link patient to family' });
    }
  }

  async removeMember(req: Request, res: Response): Promise<void> {
    try {
      const familyId = parseInt(getParam(req.params.id), 10);
      const rawPatientId = getParam(req.params.patientId);
      const patientId = decodeURIComponent(rawPatientId).trim();

      if (isNaN(familyId) || !patientId) {
        res.status(400).json({ error: 'Valid Family ID and Patient ID are required' });
        return;
      }

      await this.familyUseCase.removeMember(familyId, patientId);
      res.status(200).json({ message: 'Member detached from family successfully (medical history preserved)' });
    } catch (err: any) {
      console.error('[FAMILIES] Remove member error:', err.message);
      res.status(400).json({ error: err.message || 'Failed to remove member from family' });
    }
  }
}
