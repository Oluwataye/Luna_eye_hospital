# VisionCare EMR - End-to-End Regression Test Log
**Date:** 10 May 2026
**Patient:** Amina Bello
**Secondary Patient:** Ibrahim Tanko

## Stage 1: Patient Registration (Amina Bello)
- [x] Action 1.1: Login as Receptionist (Success)
- [x] Action 1.2: Navigate to Patients > Register (Success)
- [x] Action 1.3: Fill and submit form (Success)
- [x] Action 1.4: Verify File No assignment (Success: 0016/26/LEH)

## Stage 2: Check-in (Amina Bello)
- [x] Action 2.1: Navigate to Dashboard/Patients (Success)
- [x] Action 2.2: Check-in patient for General Consultation (Success: Automatic on registration)
- [x] Action 2.3: Verify appearance in Nursing queue (Success: Amina Bello visible in Triage)

## Stage 3: Triage (Amina Bello)
- [x] Action 3.1: Login as Nurse (Success)
- [x] Action 3.2: Record vitals (Success: BP 120/80, Pulse 72, Temp 37.0, VA 6/18, 6/9)
- [x] Action 3.3: Verify appearance in Optometry/Doctor queue (Success: "Sent to Waiting for Consultation")

## Stage 4: Clinical Consultation (Amina Bello)
- [x] Action 4.1: Login as Doctor/Optometrist (Success)
- [x] Action 4.2: Record clinical findings & diagnosis (Success)
- [x] Action 4.3: Prescribe drugs & frames (Success)
- [x] Action 4.4: Finalize consultation (Success)

## Stage 5: Billing & Payment (Amina Bello)
- [x] Action 5.1: Login as Cashier/Receptionist (Success)
- [x] Action 5.2: Generate bill based on prescriptions (Success)
- [x] Action 5.3: Process payment (Cash) (Success)
- [x] Action 5.4: Verify stock deduction in Inventory tab (Success)

## Stage 6: Admission Lifecycle (Ibrahim Tanko)
- [x] Action 6.1: Register Ibrahim Tanko (Success: 0017/26/LEH)
- [x] Action 6.2: Perform Triage (Success)
- [x] Action 6.3: Flag for Admission during Consultation (Success)
- [x] Action 6.4: Formal Admission to Eye Ward (Success)
- [x] Action 6.5: Discharge patient & synchronize status (Success)

## Stage 7: Reports & Analytics Audit
- [x] Action 7.1: Verify Inventory stock accuracy (Success)
- [x] Action 7.2: Verify Sales & Revenue data (Success: ₦276,250)
- [x] Action 7.3: Verify Patient status (Discharged) (Success: Ibrahim Tanko)
- [x] Action 7.4: Verify Audit Logs integrity (Success)

## Stage 8: System Backup
- [x] Action 8.1: Perform manual backup (Success: manual_regression_backup_2026-05-11T10-42-44-564Z.sqlite)
- [x] Action 8.2: Verify backup success and file persistence (Success)
