# TitanPDF — Product Vision

## What It Is

TitanPDF is a professional PDF form editor built exclusively for ServiceTitan field technicians. It solves one specific problem: field technicians need to fill out, sign, and submit PDF forms while on the job site — without printing, scanning, emailing, or fighting with generic tools that aren't connected to their work orders.

The app pulls job data directly from ServiceTitan, presents the PDF forms attached to each job, lets technicians fill and sign them on a tablet or desktop, saves drafts to Google Drive for continuity, and uploads completed forms back into ServiceTitan.

**Current customer:** Mr. Backflow TX (backflow prevention service company)

---

## Who Uses It

**Primary user: Field Technicians**
- Working on a tablet or laptop at a job site
- Logged in with their existing ServiceTitan credentials
- Needing to fill out forms for the current job quickly and accurately
- May be in areas with spotty connectivity (drafts support this)

**Secondary user: Office Admin / Owner**
- Reviews completed forms in Google Drive
- Monitors which jobs have drafts vs. completed submissions
- No direct app interaction — just sees the output

---

## Core Features (Current)

### Authentication
- Technicians log in with their ServiceTitan username + phone number
- Server-to-server OAuth2 — no separate accounts to manage
- Session lasts 12 hours (rolling — resets on each page load), persists across browser close

### Jobs Dashboard
- Shows technician's jobs from the past 3 days + upcoming
- Grouped by appointment date (Today / Yesterday / date labels)
- Status icons: Scheduled, Dispatched, Working, Completed
- Jobs sorted by priority within each day

### PDF Form Editing
- PDFs pulled directly from ServiceTitan job attachments
- Rendered in-browser with PDF.js
- Drag-to-place form fields: text, signature, date, timestamp, checkbox
- Signature capture via touch-optimized canvas
- Color picker for text fields
- Multi-page PDF support

### Draft & Upload Workflow
- **Save as Draft** → generates filled PDF → saves to Google Drive (organized by Job ID)
- **Upload** → promotes draft to Completed folder → uploads back to ServiceTitan
- Draft/Completed status visible per job in the Attachments view
- Can re-open and continue editing any draft

### Backflow Testing Module
- Full TCEQ-compliant backflow prevention assembly test workflow
- Supports device types: DC, RPZ, DCDA, RPDA, Type II, PVB, SVB
- Photo capture with serial number naming
- GPS auto-capture for device location
- PDF generation (TCEQ template + city-specific forms)
- Quote-needed flagging for failed devices
- Job notes compilation

### Theme
- Light/dark mode toggle in the header
- Preference persisted across sessions (localStorage)
- Defaults to system preference on first visit

---

## What It Is NOT

- Not a general-purpose PDF editor (Adobe, DocuSign, etc.)
- Not a form builder (forms come from ServiceTitan)
- Not a customer-facing tool
- Not a reporting or analytics tool
- Not multi-tenant (built for one company: Mr. Backflow TX)

---

## Architecture Philosophy

**Keep it simple.**

- No database — Google Drive is storage
- No user accounts — ServiceTitan is auth
- No microservices — one FastAPI backend
- TypeScript on the frontend (strict mode, pragmatic `any` for API shapes)
- No Redux — React state + localStorage

The app is intentionally thin. Its job is to be a bridge: ServiceTitan data in → filled PDFs out.

---

## Roadmap / Planned Features

### Near Term
- [ ] Offline mode with local draft queue (sync when back online)
- [ ] Pre-fill form fields from job data (customer name, address, date)
- [ ] Form field templates (save common field layouts per form type)
- [ ] Push notifications when a job's form has been reviewed

### Medium Term
- [ ] Multi-technician support with form assignment
- [ ] Signature request workflow (send form to customer for e-signature)
- [ ] Form completion analytics (avg time to complete, completion rates)
- [ ] Integration with ServiceTitan's native forms API (when available)

### Long Term
- [ ] Expand to other ServiceTitan customers (multi-tenant)
- [ ] AI-assisted form filling (pull values from job notes automatically)
- [ ] iOS App Store app via Capacitor (wraps existing web UI — no rewrite needed)
- [ ] City portal auto-submission for TCEQ backflow reports

---

## Success Metrics

- Technician can fill and submit a form in < 3 minutes
- Zero paper forms needed in the field
- All completed forms appear in ServiceTitan within 5 minutes of upload
- Drafts survive browser refresh / device switch
- Zero login friction (existing ServiceTitan credentials)
