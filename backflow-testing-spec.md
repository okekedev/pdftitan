# Backflow Testing Module – Feature Specification

## Overview
This document defines the proposed Backflow Testing module to be added to the existing pdftitan / ServiceTitan PDF editor application.​

The goal is to let field technicians capture all required backflow test data once, then automatically generate TCEQ and city-specific paper forms, attach photos, and push summarized results into ServiceTitan job notes.​

## Objectives
- Centralize backflow testing into the existing PDF app so techs do not need a separate tool.​
- Capture a generic backflow test record that can populate any required jurisdiction form (TCEQ or city-specific).​
- Link tests to ServiceTitan jobs, equipment, and technician profiles, including gauge and license info.​
- Streamline quoting and follow-up by flagging failed devices and generating concise job-note summaries.​
- Support photo capture per device and consistent naming/uploading to ServiceTitan.​

## Phase 1 Scope
Phase 1 focuses on a working end-to-end workflow for paper-based TCEQ and city forms.

**Included in Phase 1:**​

- New Backflow Test UI flow within the existing app.
- Generic Backflow Test Record data model based on Form-Fields.xlsx.
- Tech profile fields for licensing and gauge information used to auto-fill form sections.
- Device + bypass relationship capture for DCDA / RPDA and similar assemblies.
- PDF generation for:
  - TCEQ-20700 form.
  - City-specific paper forms, initially treated as templates mapped from a common schema.​
- Photo capture per device with file naming conventions:
  - Passed device: `SN-<serial>.jpg`.
  - Failed device: `Failed-SN-<serial>.jpg`.​
- Basic summary output for adding into ServiceTitan job notes (e.g., "10 backflows tested, 1 failed: …").​

**Out of scope for Phase 1 (future phases):**

- Direct filling and submission of online city portals.
- Full geolocation map UI (beyond optional storage of coordinates).
- Advanced ServiceTitan equipment sync logic (e.g., auto-discovery of all devices per site).

## Core User Flows

### 1. Start Backflow Testing Session
- Technician logs in via existing ServiceTitan integration and selects a job/location.
- Tech chooses "Backflow Testing" from available actions on that job.
- App loads:
  - Job/location details.
  - Technician profile (license, company, gauge info).​

### 2. Manage Devices on a Job
From the Backflow Testing screen, tech can:

- View list of existing devices for this location/job.
- Add a new device with fields:
  - Type of Backflow (Main): DC, RPZ, DCDA, RPDA, DCDA Type II, RPDA Type II, PVB, SVB.​
  - Manufacturer, model, serial, size (main and bypass where applicable).​
  - BPA location, BPA serves.​
  - Optionally link a bypass device to the main assembly for DCDA/RPDA configurations.​

### 3. Capture Test Data
For each device:

- Technician opens the device's test form.
- App pre-fills:
  - Address of service from the job.
  - Company, technician, license, and gauge info from Tech Profile.​
- Tech completes fields (see "Form Schema" section) including:
  - Reason for test (New/Existing/Replacement + optional old serial).​
  - Installation and auxiliary supply questions.
  - Initial test values for checks, relief valve, air inlet, etc., depending on assembly type.​
  - Repairs and materials used (main and bypass).​
  - Test-after-repair values where applicable.​
  - Test result (Passed/Failed).​
  - "Quote Needed" flag if the device failed and requires estimate/follow-up.​
- Tech can add freeform remarks that will be included in job notes and/or PDF remarks field.​

### 4. Attach Photos
Per device:

- Capture or upload one or more photos.
- App automatically names files:
  - `SN-<serial>.<ext>` for normal devices.
  - `Failed-SN-<serial>.<ext>` if Test Result is "Failed".​
- Photos are associated to the device and job for later upload to ServiceTitan.

### 5. Generate PDFs
From the Backflow session:

- Tech selects the city/jurisdiction.
- App resolves form type:
  - Uses City-information.xlsx mapping: city → TCEQ Form or city-specific form name.​
- App generates:
  - A TCEQ-20700 PDF using TCEQ-Form-Excel-Match.pdf as the reference mapping.​
  - Optionally, a city-branded form when available, populated from the same data.
- PDFs are attached to the job using the existing PDF storage/export pipeline.

### 6. Job Note Summary
When tests are completed for the job:

- App generates a concise, human-readable summary, e.g.:
  - *10 backflows tested, 1 failed: 1/2" Watts 009 SN 123456 – needs full rebuild kit.*​
- Summary is pushed into ServiceTitan job notes using existing integration patterns.

## Data Model (Conceptual)
These are conceptual entities; actual implementation should follow existing app conventions.

### TechnicianProfile
- id (existing)
- name
- companyName
- companyAddress
- companyPhone
- bpatLicenseNumber
- licenseExpirationDate
- gaugeMakeModel
- gaugeSerialNumber
- gaugeDateTestedForAccuracy
- signature (existing signature capture reused)​

### Job / Location (existing)
Reuse existing Job/Location models.

Required fields:
- pwsName (Public Water Supplier, if available / strategy TBD).​
- pwsId (optional, strategy TBD).​
- pwsMailingAddress (optional).​
- pwsContactPerson (optional).​
- serviceAddress (Address of Service).​

### BackflowDevice
- id
- jobId / locationId
- typeMain (enum: DC, RPZ, DCDA, RPDA, DCDA Type II, RPDA Type II, PVB, SVB).​
- manufacturerMain
- modelMain
- serialMain
- sizeMain (1/2", 3/4", 1", etc.).​
- manufacturerBypass (optional)
- modelBypass (optional)
- serialBypass (optional)
- sizeBypass (optional)​
- bpaLocation
- bpaServes
- geoLatitude (optional; for future geolocation features).​
- geoLongitude (optional).​

### BackflowTestRecord
One record per device per test event.

- id
- deviceId
- jobId
- technicianId
- testDateInitial
- testTimeInitial
- testDateAfterRepair (optional)
- testTimeAfterRepair (optional)​
- reasonForTest (New/Existing/Replacement + optional old serial).​
- installedPerCode (Yes/No).​
- installedOnNonPotableAuxiliary (Yes/No).​
- testResult (Passed/Failed).​

**Assembly-specific numeric and boolean fields (all optional, gated by device type):**​

- firstCheckReadingInitial
- firstCheckClosedTightInitial (Closed Tight/Leaked)
- secondCheckReadingInitial
- secondCheckClosedTightInitial
- reliefValveReadingInitial
- reliefValveDidNotOpenInitial (Did not open/Opened)
- typeIIBypassCheckReadingInitial
- typeIIBypassClosedTightInitial
- airInletReadingInitial
- airInletDidNotOpenInitial (Yes/No)
- airInletFullyOpenInitial (Yes/No)
- checkValveReadingInitial
- checkValveLeakedInitial (Yes/No)

**After-repair equivalents:**​

- firstCheckReadingAfterRepair
- firstCheckClosedTightAfterRepair
- secondCheckReadingAfterRepair
- secondCheckClosedTightAfterRepair
- reliefValveReadingAfterRepair
- typeIIBypassCheckReadingAfterRepair
- typeIIBypassClosedTightAfterRepair
- airInletReadingAfterRepair
- checkValveReadingAfterRepair

**Other fields:**​

- repairsMain (long text).
- repairsBypass (long text).
- differentialPressureGaugeType (Potable / Non-potable).​
- remarks (long text).
- quoteNeeded (boolean).​

### BackflowPhoto
- id
- deviceId
- testRecordId
- jobId
- filePath / url
- isFailedPhoto (boolean)
- originalFileName
- generatedFileName (e.g., Failed-SN-123456.jpg).​

### CityFormProfile
- cityName
- isOnline (for future use)
- formType (e.g., "TCEQ Form", "City Form", "Parker County SUD Form", etc.).​
- pdfTemplateId or path to the corresponding template in the app.
- Source list derived from City-information.xlsx.​

## Form Schema and Conditional Logic
The generic form presented to technicians should be schema-driven from Form-Fields.xlsx with conditional logic by device type.​

**Key rules:**​

- For DC/RPZ/DCDA/RPDA types:
  - Show first and second check readings and Closed Tight/Leaked fields (initial and after repair).
- For RPZ/RPDA:
  - Show Relief Valve Reading fields (initial and after repair).
- For DCDA/RPDA Type II:
  - Show Type II bypass check reading and status fields.
- For PVB/SVB:
  - Show Air Inlet and Check Valve reading/leak fields.

**Mandatory fields for completing a test (must be validated before allowing PDF generation):**​

- Test date/time.
- Reason for test.
- Test result.
- At least one applicable pressure/check reading per device type.
- Gauge and license fields marked as required in Form-Fields.xlsx (e.g., gauge make/model, serial, date tested, BPAT license, license expiration).​

## PDF Mapping

### TCEQ-20700
Use TCEQ-Form-Excel-Match.pdf as the mapping guide between the generic fields and specific TCEQ field positions.​

Implement a mapping layer:

```
BackflowTestRecord + BackflowDevice + TechnicianProfile + job/PWS fields
→ TCEQ form fields (by numeric index or named identifier).​
```

Ensure:
- All mandatory TCEQ fields are populated or clearly left blank only when allowed.
- Test values are placed in the correct section based on device type (RPBA, DCVA, PVB, SVB, etc.).​

### City Paper Forms
- For cities whose "Software/Form Name" is TCEQ Form, reuse the TCEQ template.​
- For cities with custom forms (e.g., "Hudson Oaks Form", "Parker County SUD Form"), create templates and map the same generic schema fields to the appropriate PDF fields.​
- If a city has only "Paper" with no specific form name, initially use TCEQ form if acceptable, or mark as "Generic TCEQ-style" until a custom template is added.​

## Integration Points

### ServiceTitan
Reuse existing ServiceTitan integration for:
- Technician authentication.
- Job selection and service address retrieval.
- Attaching generated PDFs to jobs.
- Uploading photo files with the generated naming convention.​

**New integration behaviors:**
- Push backflow job note summary.
- Optionally tag jobs with a custom field if any device is flagged as "Quote Needed".​

### Existing PDF Engine
Add new endpoints or front-end actions to:
- Generate backflow PDFs (TCEQ and city).
- Download or preview them from the job context.
- Follow the existing conventions for how PDF templates are stored and invoked.

## UI and Navigation
- Add a "Backflow Tests" entry point in the job view or PDF tools list.
- Backflow session screen components:
  - Device list (with status: Not Tested, Passed, Failed).
  - "Add Device" / "Edit Device" modal or page.
  - "Record Test" form per device using the schema from Form-Fields.xlsx.
  - Photo upload section per device.
  - Summary / completion bar (e.g., "3 of 5 devices tested").
  - "Generate Forms" button that leads to city selection and PDF generation.

## Future Enhancements (Phase 2+)
- Online form autofill for cities that use web portals instead of paper (e.g., by exporting a structured report for manual copy/paste or automating where permitted).​
- Interactive map view with device pins based on stored GPS coordinates.​
- Deeper ServiceTitan equipment sync:
  - Auto-matching devices to existing equipment records.
  - Keeping historical test records per device across years.
