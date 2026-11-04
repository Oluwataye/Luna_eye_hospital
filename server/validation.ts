import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// ── Custom XSS Sanitizer Preprocessor Helper ──
export const sanitizedString = (message?: string) => {
  const schema = message ? z.string().min(1, message) : z.string();
  return z.preprocess((val) => {
    if (typeof val !== 'string') return val;
    // Strip script tags and escape html chars, then trim whitespace
    return val
      .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .trim();
  }, schema);
};

// ── Password Strength Enforcer Schema ──
export const PasswordPolicySchema = z.string().superRefine((val, ctx) => {
  const hasMinLength = val.length >= 8;
  const hasUppercase = /[A-Z]/.test(val);
  const hasLowercase = /[a-z]/.test(val);
  const hasDigit = /\d/.test(val);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(val);

  if (!hasMinLength || !hasUppercase || !hasLowercase || !hasDigit || !hasSymbol) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.'
    });
  }
});

// ── Admin Password Strength Schema (Relaxed: min 4 chars) ──
export const AdminPasswordSchema = z.string().min(4, 'Password must be at least 4 characters long');

// ── Validation Schema Registry ──

// Login Schema
export const LoginSchema = z.object({
  username: sanitizedString('Username is required'),
  password: z.string().min(1, 'Password is required')
});

// Create User Schema
export const CreateUserSchema = z.object({
  username: sanitizedString('Username is required'),
  email: z.string().email('Valid email address required').optional().nullable().or(z.literal('')),
  password: AdminPasswordSchema,
  full_name: sanitizedString('Full name is required'),
  role: z.enum(['Admin', 'Receptionist', 'Nurse', 'Optometrist', 'Consultant', 'Doctor', 'Pharmacist']),
  phone_number: sanitizedString().optional().nullable(),
  department: sanitizedString().optional().nullable()
});

// Update User Schema
export const UpdateUserSchema = z.object({
  username: sanitizedString().optional(),
  email: z.string().email('Valid email address required').optional().nullable().or(z.literal('')),
  password: AdminPasswordSchema.optional().nullable().or(z.literal('')),
  full_name: sanitizedString().optional(),
  role: z.enum(['Admin', 'Receptionist', 'Nurse', 'Optometrist', 'Consultant', 'Doctor', 'Pharmacist']).optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
  phone_number: sanitizedString().optional().nullable(),
  department: sanitizedString().optional().nullable()
});

// Change Password Schema
export const ChangePasswordSchema = z.object({
  user_id: z.coerce.number(),
  current_password: z.string().min(1, 'Current password is required'),
  new_password: PasswordPolicySchema
});

// Create Patient Schema
export const CreatePatientSchema = z.object({
  hospital_number: sanitizedString().optional().nullable(),
  full_name: sanitizedString('Full name is required'),
  gender: z.enum(['Male', 'Female', 'Other']),
  dob: sanitizedString('Date of birth is required'),
  phone: sanitizedString('Phone number is required'),
  alternate_phone: sanitizedString().optional().nullable(),
  address: sanitizedString().optional().nullable(),
  occupation: sanitizedString().optional().nullable(),
  next_of_kin: sanitizedString().optional().nullable(),
  next_of_kin_phone: sanitizedString().optional().nullable(),
  marital_status: sanitizedString().optional().nullable(),
  blood_group: sanitizedString().optional().nullable(),
  genotype: sanitizedString().optional().nullable(),
  allergies: sanitizedString().optional().nullable(),
  medical_alerts: sanitizedString().optional().nullable(),
  payment_category: sanitizedString().optional().nullable().default('Private'),
  department: sanitizedString().optional().nullable().default('General'),
  // Extended demographic & family fields
  tribe: sanitizedString().optional().nullable(),
  religion: sanitizedString().optional().nullable(),
  state_of_origin: sanitizedString().optional().nullable(),
  next_of_kin_address: sanitizedString().optional().nullable(),
  family_id: z.coerce.number().optional().nullable(),
  relationship_to_family: sanitizedString().optional().nullable(),
  registration_type: z.enum(['INDIVIDUAL', 'FAMILY_MEMBER']).optional().nullable().default('INDIVIDUAL')
});

export const UpdatePatientSchema = CreatePatientSchema.partial();

// Family Household Validation Schemas
export const CreateFamilySchema = z.object({
  family_name: sanitizedString('Family name (surname) is required'),
  contact_person_name: sanitizedString('Contact person name is required'),
  contact_person_phone: sanitizedString('Contact person phone number is required'),
  residential_address: sanitizedString().optional().nullable(),
  tribe: sanitizedString().optional().nullable(),
  state_of_origin: sanitizedString().optional().nullable(),
  // Used when capturing an existing manual cardholder into the EMR — preserves their physical card number
  existing_card_number: sanitizedString().optional().nullable(),
  confirm_duplicate: z.boolean().optional().default(false)
});

export const UpdateFamilySchema = CreateFamilySchema.partial();

export const LinkPatientFamilySchema = z.object({
  patient_id: sanitizedString('Patient ID is required'),
  relationship_to_family: sanitizedString('Relationship to family is required')
});

// ── Date and Pagination Query Schemas ──
export const dateString = z.preprocess((val) => {
  if (val === '' || val === undefined || val === null) return undefined;
  return val;
}, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional());

export const PaginationQuerySchema = z.object({
  limit: z.preprocess((val) => {
    if (val === '' || val === undefined || val === null) return 200;
    const parsed = Number(val);
    return isNaN(parsed) ? 200 : Math.min(Math.max(parsed, 1), 500);
  }, z.number().int().default(200)),
  offset: z.preprocess((val) => {
    if (val === '' || val === undefined || val === null) return 0;
    const parsed = Number(val);
    return isNaN(parsed) ? 0 : Math.max(parsed, 0);
  }, z.number().int().default(0)),
  start_date: dateString,
  end_date: dateString
});

export const AuditLogQuerySchema = PaginationQuerySchema.extend({
  user_id: z.preprocess((val) => {
    if (val === '' || val === undefined || val === null) return undefined;
    const parsed = Number(val);
    return isNaN(parsed) ? undefined : parsed;
  }, z.number().optional()),
  action_type: sanitizedString().optional()
});

export const PatientListQuerySchema = PaginationQuerySchema.extend({
  search: sanitizedString().optional(),
  id: sanitizedString().optional(),
  file_no: sanitizedString().optional()
});

export const CategoryQuerySchema = PaginationQuerySchema.extend({
  category: sanitizedString().optional()
});

export const ReprintQuerySchema = z.object({
  limit: z.preprocess((val) => {
    if (val === '' || val === undefined || val === null) return 200;
    const parsed = Number(val);
    return isNaN(parsed) ? 200 : Math.min(Math.max(parsed, 1), 500);
  }, z.number().int().default(200)),
  offset: z.preprocess((val) => {
    if (val === '' || val === undefined || val === null) return 0;
    const parsed = Number(val);
    return isNaN(parsed) ? 0 : Math.max(parsed, 0);
  }, z.number().int().default(0)),
  from_date: dateString,
  to_date: dateString,
  user_name: sanitizedString().optional(),
  search: sanitizedString().optional(),
  flagged_only: z.preprocess((val) => val === 'true' || val === '1', z.boolean().optional())
});

export const BillingSearchQuerySchema = PaginationQuerySchema.extend({
  search: sanitizedString().optional()
});

export const RequiredReportQuerySchema = z.object({
  limit: z.preprocess((val) => {
    if (val === '' || val === undefined || val === null) return 200;
    const parsed = Number(val);
    return isNaN(parsed) ? 200 : Math.min(Math.max(parsed, 1), 500);
  }, z.number().int().default(200)),
  offset: z.preprocess((val) => {
    if (val === '' || val === undefined || val === null) return 0;
    const parsed = Number(val);
    return isNaN(parsed) ? 0 : Math.max(parsed, 0);
  }, z.number().int().default(0)),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'start_date must be in YYYY-MM-DD format'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'end_date must be in YYYY-MM-DD format'),
  cashier: sanitizedString().optional()
});

// ── Transaction Creation Schema ──
export const CreateTransactionSchema = z.object({
  patient_id: z.string().optional().nullable(),
  billing_type: z.enum(['patient', 'family', 'walk_in']).optional().default('patient'),
  family_id: z.union([z.number().int(), z.string()]).transform(val => (val !== undefined && val !== null && val !== '') ? Number(val) : null).optional().nullable(),
  visit_id: z.union([z.number().int(), z.string()]).transform(val => (val !== undefined && val !== null && val !== '') ? Number(val) : null).optional().nullable(),
  amount_paid: z.union([z.number().nonnegative(), z.string()]).transform(val => parseFloat(String(val)) || 0).default(0),
  discount: z.union([z.number().nonnegative(), z.string()]).transform(val => parseFloat(String(val)) || 0).default(0),
  payment_method: sanitizedString('Payment method is required'),
  payment_details: z.any().optional(),
  cashier: sanitizedString().optional(),
  supervisor_username: sanitizedString().optional(),
  supervisor_password: z.string().optional(),
  discount_reason: sanitizedString().optional(),
  discount_note: sanitizedString().optional(),
  is_insurance_bill: z.union([z.boolean(), z.number(), z.string()]).transform(val => val === true || val === 1 || val === '1' || val === 'true').optional().default(false),
  payer_id: z.union([z.number().int(), z.string()]).transform(val => (val !== undefined && val !== null && val !== '') ? Number(val) : null).optional().nullable(),
  claim_id: z.union([z.number().int(), z.string()]).transform(val => (val !== undefined && val !== null && val !== '') ? Number(val) : null).optional().nullable(),
  patient_portion: z.union([z.number().nonnegative(), z.string()]).transform(val => (val !== undefined && val !== null && val !== '') ? parseFloat(String(val)) : null).optional().nullable(),
  payer_portion: z.union([z.number().nonnegative(), z.string()]).transform(val => (val !== undefined && val !== null && val !== '') ? parseFloat(String(val)) : null).optional().nullable(),
  items: z.array(z.object({
    inventory_id: z.string().optional().nullable(),
    item_id: z.union([z.string(), z.number()]).optional().nullable(),
    description: z.string().optional().nullable(),
    name: z.string().optional().nullable(),
    qty: z.union([z.number(), z.string()]).transform(val => Number(val) || 1),
    unit_price: z.union([z.number(), z.string()]).transform(val => parseFloat(String(val)) || 0)
  })).min(1, 'At least one item must be billed')
}).superRefine((data, ctx) => {
  if (data.billing_type === 'patient' && (!data.patient_id || !data.patient_id.trim())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['patient_id'],
      message: 'patient_id is required when billing_type is patient'
    });
  }
});

// ── Generic Schema Validation Middleware ──
export interface ValidationSchemas {
  body?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  params?: z.ZodTypeAny;
}

export const validateRequest = (schemas: ValidationSchemas) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.body && req.body) {
        req.sanitizedBody = schemas.body.parse(req.body);
      } else {
        req.sanitizedBody = req.sanitizedBody || req.body;
      }

      if (schemas.query && req.query) {
        req.sanitizedQuery = schemas.query.parse(req.query);
      } else {
        req.sanitizedQuery = req.sanitizedQuery || req.query;
      }

      if (schemas.params && req.params) {
        req.sanitizedParams = schemas.params.parse(req.params);
      } else {
        req.sanitizedParams = req.sanitizedParams || req.params;
      }

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Return first validation error's message or a structured list of errors
        const formattedErrors = error.issues.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));

        return res.status(400).json({
          error: error.issues[0]?.message || 'Validation failed',
          details: formattedErrors
        });
      }
      next(error);
    }
  };
};
