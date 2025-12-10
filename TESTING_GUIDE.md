# Backflow Testing Module - Testing Guide

## 🚀 Quick Start

### 1. Start the Application

**Option 1: Run Both Together (Recommended)**
```bash
# Install all dependencies (first time only)
npm run install:all

# Run both frontend and backend concurrently
npm run dev
```

**Option 2: Run Separately**
```bash
# Terminal 1 - Backend
cd backend
npm install
npm start

# Terminal 2 - Frontend (in new terminal)
npm install
npm start
```

The app will open at `http://localhost:3003`
Backend runs on `http://localhost:3004`

### 2. Login

Use your ServiceTitan technician credentials:
- Username: Your ServiceTitan login name
- Phone: Your registered phone number

### 3. Test the Backflow Module

1. **Navigate to a Job**
   - Select any job from the jobs list
   - Click on "Attachments" tab

2. **Start Backflow Testing**
   - Click "Start Backflow Testing" button
   - You'll see the backflow testing interface

3. **Add a Device**
   - Click "+ Add Device"
   - Fill in device information:
     - Type: DC, RPZ, DCDA, RPDA, PVB, SVB, or Type II variants
     - Manufacturer, Model, Serial Number
     - Size, Location, Serves
   - GPS coordinates are captured automatically
   - Save the device

4. **Record Test Data**
   - Fill in test date and time
   - Enter test readings (fields adapt based on device type)
   - Mark as Passed or Failed
   - If failed, check "Quote Needed" if applicable
   - Add repairs if performed
   - Save the test

5. **Upload Photos**
   - Click "Add Photos"
   - Select photo(s) from your device
   - Photos are automatically:
     - Named with device serial number
     - Prefixed with "Failed-" if device failed
     - Uploaded directly to ServiceTitan as job attachments
   - You'll see a ✓ badge when upload is complete

6. **Generate Forms**
   - Click "Generate Forms & Update Job Notes"
   - Select city/jurisdiction
   - System will:
     - Fill actual TCEQ PDF template with all test data
     - Save PDF to Google Drive "v2 demo" folder
     - Update job notes with test summary

7. **Generate Online Reference (Optional)**
   - Click "Generate Online Reference Report"
   - Creates easy-to-read reference sheet
   - For manual entry into city online portals
   - Also saved to Google Drive

## ✅ What to Verify

### Photos
- [ ] Photos upload to ServiceTitan job attachments
- [ ] Filenames use device serial number (SN-12345.jpg)
- [ ] Failed device photos have "Failed-" prefix
- [ ] Photos appear in ServiceTitan job attachments list

### PDFs
- [ ] TCEQ PDF is filled with correct data
- [ ] All device types work (DC, RPZ, DCDA, etc.)
- [ ] Failed devices show in summary
- [ ] PDFs save to Google Drive "v2 demo" folder
- [ ] Online reference report generates correctly

### Job Notes
- [ ] Summary includes device count
- [ ] Failed devices listed with details
- [ ] Quote needed flag appears when checked
- [ ] Notes update in ServiceTitan job

### GPS
- [ ] Coordinates captured automatically when adding device
- [ ] Location data saved with device

## 🔧 Troubleshooting

### "ServiceTitan authentication failed"
- Check .env file has correct credentials
- Verify ServiceTitan API credentials are valid

### "No technician found"
- Username must match ServiceTitan loginName field
- Phone number must match technician record

### Photos not uploading
- Check internet connection
- Verify ServiceTitan Forms API permissions
- Look for upload status in browser console

### PDFs not in Google Drive
- Check Google Drive credentials in .env
- Verify "v2 demo" folder exists or can be created
- Check Google Drive API permissions

## 📊 Test Data Flow

```
1. Login → ServiceTitan validates technician
2. Select Job → Load job data
3. Add Device → GPS auto-captured, saved to memory
4. Record Test → Conditional fields based on device type
5. Upload Photos → Direct to ServiceTitan as attachments
6. Generate PDF → Fill TCEQ template, save to Google Drive
7. Job Notes → Update ServiceTitan with summary
```

## 🎯 All Requirements Implemented

From `App Next Steps.docx`:

1. ✅ Tech profile using ServiceTitan API
2. ✅ Generic form for all test info
3. ✅ "Quote Needed" tagging
4. ✅ Bypass information linked to main device
5. ✅ Notes compiled into job summary
6. ✅ Fill city paper forms
7. ✅ Photos linked with serial number naming
8. ✅ Photos uploaded to ServiceTitan
9. ✅ Online forms reference report
10. ✅ Geolocation (GPS coordinates)

**Status: 10/10 Complete** 🎉

## 📝 Notes

- **No local storage**: Photos go to ServiceTitan, PDFs to Google Drive
- **In-memory data**: All test data stored in memory during session
- **Session-based**: Data resets when backend restarts (this is expected)
- **Custom fields**: Falls back to placeholders if not configured

## 🐛 Known Issues

1. **PDF field mapping**: Generic field names may need adjustment for actual TCEQ submissions
2. **Custom fields**: Add in ServiceTitan for license/gauge data (currently uses placeholders)
3. **Database**: No persistent storage (data lost on restart) - add PostgreSQL/MongoDB if needed

---

**Last Updated**: December 10, 2025
**Version**: 2.1 (Backflow Module Complete)
