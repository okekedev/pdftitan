# Backflow Testing Module - Implementation Progress

## ✅ Phase 1: COMPLETED (Initial Implementation)

### What Was Built:
1. ✅ Complete BackflowTesting page component with workflow
2. ✅ Device List, Test Form, Photo Capture, PDF Generator components
3. ✅ Backend API with 15+ endpoints
4. ✅ Photo upload with multer
5. ✅ Basic PDF generation
6. ✅ Integration with existing pdftitan app
7. ✅ "Start Backflow Testing" button in Attachments page
8. ✅ Routing and navigation
9. ✅ In-memory data storage

## ✅ Phase 2: IN PROGRESS (Excel Integration & Enhancements)

### Completed:
1. ✅ Excel parser service (`backend/services/excelParser.js`)
   - Parses City information.xlsx (68 cities)
   - Parses Form Fields.xlsx (61 field definitions)
   - Extracts validation rules
   - Categorizes fields by type

2. ✅ New API Endpoints:
   - GET `/api/cities` - Get all cities with form types
   - GET `/api/cities/:cityName` - Get city + PWS info
   - GET `/api/form-fields` - Get all field definitions with validation

3. ✅ Frontend API Client Methods:
   - `getCities()` - Fetch city list
   - `getCityInfo(cityName)` - Get PWS data for city
   - `getFormFields()` - Get form structure

4. ✅ Copied Reference Files to Project:
   - `backend/forms/City information.xlsx`
   - `backend/forms/Form Fields.xlsx`
   - `backend/forms/TCEQ.pdf` (blank template)
   - `backend/forms/TCEQ Form Excel Match.pdf` (field mapping)
   - `backend/forms/App Next Steps.docx` (requirements)

### In Progress:
- 🔄 Adding PWS fields to TestForm with city selection
- 🔄 Auto-population from city data

## 📋 Phase 3: NEXT STEPS (Remaining Requirements from "App Next Steps.docx")

### Priority 1 - Core Functionality:

#### 1. **Technician Profile Management**
**Status:** Not started
**Requirements:**
- Database/storage for each tech's:
  - License information (BPAT license #, expiration date)
  - Gauge information (make/model, serial, calibration date)
  - Company info (name, address, phone)
  - Digital signature
- Pre-populate test forms from tech profile
- License expiration validation

**Files to Create:**
- `src/pages/TechnicianProfile/TechnicianProfile.jsx`
- `backend/api/technicians.js`
- Backend storage for technician data

---

#### 2. **PWS Auto-Population from City Selection**
**Status:** 50% complete (parser done, UI integration needed)
**Requirements:**
- City dropdown in BackflowTesting workflow
- Auto-fill PWS fields when city selected:
  - Public Water Supplier Name
  - PWS ID#
  - PWS Mailing Address
  - PWS Contact Person

**Files to Modify:**
- `src/pages/BackflowTesting/BackflowTesting.jsx` - Add city selection step
- `src/pages/BackflowTesting/components/TestForm.jsx` - Add PWS fields section

---

#### 3. **Repairs → Post-Repair Test Workflow**
**Status:** Not started
**Requirements:**
- Show post-repair test fields ONLY if repairs documented
- Mirror initial test structure for after-repair readings
- Require date/time of post-repair test
- Validate post-repair data before marking as complete

**Files to Modify:**
- `src/pages/BackflowTesting/components/TestForm.jsx` - Add conditional post-repair section

---

#### 4. **Field Validation Rules**
**Status:** Parser complete, UI validation not implemented
**Requirements:**
- Numeric fields: one decimal place max
- Serial numbers: integers only
- Required fields (marked with *): company name, address, phone, license, gauge info
- Date validation: license not expired, gauge calibrated within 1 year
- Phone number formatting

**Files to Create:**
- `src/utils/formValidation.js` - Validation helper functions

**Files to Modify:**
- `src/pages/BackflowTesting/components/TestForm.jsx` - Add validation

---

#### 5. **Actual TCEQ PDF Filling (vs. Generating New PDF)**
**Status:** Not started
**Requirements:**
- Use pdf-lib to fill existing TCEQ.pdf template
- Map 61 data fields to PDF form fields using TCEQ Form Excel Match annotations
- Handle checkboxes for device types
- Fill text fields, date fields, signature fields
- Support both TCEQ and city-specific forms

**Files to Create:**
- `backend/services/pdfFiller.js` - PDF field mapping service
- `backend/services/tceqMapping.js` - TCEQ-20700 field mappings

**PDF Field Mapping (from TCEQ Form Excel Match.pdf):**
```javascript
const TCEQ_FIELD_MAPPING = {
  2: 'pwsName',
  3: 'pwsId',
  4: 'pwsMailingAddress',
  5: 'pwsContactPerson',
  6: 'addressOfService',
  7: 'typeOfBackflowCheckbox', // Device type checkboxes
  8: 'manufacturerMain',
  9: 'modelNumberMain',
  10: 'serialMain',
  // ... all 61 fields
};
```

---

### Priority 2 - Enhanced Features:

#### 6. **Quote Needed Job Tagging**
**Status:** UI exists (checkbox), ServiceTitan integration not implemented
**Requirements:**
- Tag failed devices with "Quote Needed" flag
- Push tag to ServiceTitan job when tests complete
- Show quote-needed devices in summary
- Include in job notes

**Files to Modify:**
- `backend/api/backflow.js` - Add ServiceTitan job tagging
- `src/pages/BackflowTesting/components/PDFGenerator.jsx` - Highlight quote-needed devices

---

#### 7. **Enhanced Job Notes Summary**
**Status:** Basic implementation exists, needs enrichment
**Current:**
```
10 backflows tested, 1 failed:
- 1/2" Watts 009 SN 123456 - needs full rebuild kit
```

**Requirements:**
- Include device location
- Include what it serves
- List repairs performed
- Flag quote-needed devices
- Format for easy reading in ServiceTitan

**Files to Modify:**
- `src/pages/BackflowTesting/components/PDFGenerator.jsx` - Enhance `generateJobNoteSummary()`

---

#### 8. **Link Bypass to Main DCDA Device**
**Status:** Data model supports it, UI needs improvement
**Requirements:**
- Visual indication of linked bypass
- Show bypass info when viewing main device
- Cannot delete main without handling bypass
- Repairs can be done on either/both

**Files to Modify:**
- `src/pages/BackflowTesting/components/DeviceList.jsx` - Show linked devices
- `src/pages/BackflowTesting/components/TestForm.jsx` - Improve bypass linking UI

---

#### 9. **Geolocation / GPS Coordinates**
**Status:** Data model has placeholder fields, UI not implemented
**Requirements:**
- Capture GPS coordinates for each device
- Allow pin placement on map
- Visual map showing all devices at location
- Store lat/long with device record

**Files to Create:**
- `src/pages/BackflowTesting/components/LocationPicker.jsx` - Map interface

**Libraries Needed:**
- `react-leaflet` or `google-maps-react` for map display

---

#### 10. **Equipment Linking to ServiceTitan**
**Status:** Not started (mentioned as "nice to have")
**Requirements:**
- Query ServiceTitan for existing equipment at location
- Link backflow devices to equipment records
- Maintain historical test records per device
- Show previous test results when testing device again

**Files to Create:**
- `backend/api/equipment.js` - ServiceTitan equipment integration

---

#### 11. **Online Form Integration**
**Status:** Not started (future phase)
**Requirements:**
- Identify cities with online submission portals
- Create structured export for copy/paste
- Consider web scraping/automation for direct submission
- Start with simple report format for manual entry

**Cities with Online Forms (from City info.xlsx):**
- Currently all marked "Paper"
- Need to research which have online portals
- Update City information.xlsx with portal URLs

---

### Priority 3 - Quality & Polish:

#### 12. **Size Dropdown Enhancement**
**Current:** Fixed 12 sizes
**Enhancement:** Add 12" option (missing from current list)

**Complete List (from Form Fields.xlsx):**
```
1/2", 3/4", 1", 1-1/4", 1-1/2", 2", 2-1/2", 3", 4", 6", 8", 10", 12"
```

---

#### 13. **City Data Enhancement**
**Current Issues:**
- Burleson listed twice
- Haltom City listed twice
- Several cities marked "Paper" with no specific form name
- Missing PWS information for most cities

**Needed:**
- Deduplicate entries
- Research PWS IDs and contact info
- Clarify "Paper" vs specific form names
- Add online portal URLs where available

---

#### 14. **Photo Enhancement**
**Current:** Basic upload with SN naming
**Enhancements Needed:**
- Display serial number prominently in filename
- Example: `Failed-SN-123456-Watts-009.jpg` (include manufacturer/model)
- Thumbnail preview before upload
- Photo gallery per device
- Ability to retake/replace photos

---

## 🗂️ File Structure Summary

```
pdftitan/
├── backend/
│   ├── api/
│   │   └── backflow.js (✅ Enhanced with Excel endpoints)
│   ├── services/
│   │   ├── excelParser.js (✅ NEW - Parses City & Form Fields)
│   │   ├── pdfFiller.js (❌ TODO - Fill TCEQ PDF template)
│   │   └── tceqMapping.js (❌ TODO - Field mappings)
│   └── forms/ (✅ NEW - Reference files)
│       ├── City information.xlsx
│       ├── Form Fields.xlsx
│       ├── TCEQ.pdf
│       ├── TCEQ Form Excel Match.pdf
│       └── App Next Steps.docx
│
├── src/
│   ├── pages/
│   │   ├── BackflowTesting/
│   │   │   ├── BackflowTesting.jsx (✅ Main controller)
│   │   │   └── components/
│   │   │       ├── DeviceList.jsx (✅ Device grid)
│   │   │       ├── TestForm.jsx (🔄 Needs PWS fields)
│   │   │       ├── PhotoCapture.jsx (✅ Basic upload)
│   │   │       └── PDFGenerator.jsx (🔄 Needs TCEQ mapping)
│   │   └── TechnicianProfile/ (❌ TODO - New page)
│   └── services/
│       └── apiClient.js (✅ Enhanced with city/field endpoints)
│
└── package.json (✅ multer & xlsx installed)
```

## 📊 Progress Metrics

**Overall Progress: 45% Complete**

- ✅ Phase 1 (Basic Module): 100%
- 🔄 Phase 2 (Excel Integration): 60%
- ❌ Phase 3 (Full Requirements): 15%

**By Feature:**
- Core Workflow: ✅ 100%
- Excel Parsing: ✅ 100%
- City/PWS Integration: 🔄 50%
- Technician Profiles: ❌ 0%
- PDF Field Mapping: ❌ 0%
- Validation Rules: ❌ 20%
- Geolocation: ❌ 5%
- Quote Tagging: 🔄 40%
- Job Notes: 🔄 60%
- Online Forms: ❌ 0%

## 🚀 Recommended Next Actions

### Immediate (This Session):
1. ✅ Complete PWS fields integration in TestForm
2. Create Technician Profile component
3. Implement repairs → post-repair test workflow
4. Add field validation

### Short-Term (Next Session):
1. Create PDF filling service for TCEQ template
2. Map all 61 fields to PDF positions
3. Enhance job notes summary
4. Add GPS coordinate capture

### Medium-Term:
1. ServiceTitan equipment linking
2. Quote tagging integration
3. Enhanced photo management
4. City data cleanup

### Long-Term:
1. Online form integration research
2. Geolocation map interface
3. Historical device test tracking
4. Multi-city form templates

## 📝 Notes

- **No Database:** User confirmed in-memory storage is acceptable (data lost on restart)
- **ServiceTitan Integration:** Partially implemented (job/customer data), needs enhancement for equipment and tagging
- **Form Fields:** All 61 fields defined in Excel, need UI implementation
- **PDF Strategy:** Use pdf-lib to fill actual TCEQ.pdf instead of generating new PDF
- **City Forms:** 33 cities use TCEQ, others need custom templates
- **Git Branch:** All work on `develop` branch

## 🔗 Key References

- Specification: `backflow-testing-spec.md`
- Requirements: `backend/forms/App Next Steps.docx`
- Field Definitions: `backend/forms/Form Fields.xlsx`
- City Mappings: `backend/forms/City information.xlsx`
- PDF Template: `backend/forms/TCEQ.pdf`
- Field Mapping Guide: `backend/forms/TCEQ Form Excel Match.pdf`
