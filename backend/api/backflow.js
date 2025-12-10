const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const excelParser = require('../services/excelParser');

// Configure multer for photo uploads (memory storage - upload directly to ServiceTitan)
const upload = multer({ storage: multer.memoryStorage() });

// In-memory storage for demo (replace with database in production)
let devices = [];
let testRecords = [];
let photos = [];
let generatedPDFs = [];

let deviceIdCounter = 1;
let testIdCounter = 1;
let photoIdCounter = 1;
let pdfIdCounter = 1;

// Get all devices for a job
router.get('/job/:jobId/backflow-devices', async (req, res) => {
  try {
    const jobId = req.params.jobId;
    const jobDevices = devices.filter(d => d.jobId === jobId);
    res.json({ success: true, data: jobDevices });
  } catch (error) {
    console.error('Error getting devices:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create a new device
router.post('/job/:jobId/backflow-devices', async (req, res) => {
  try {
    const jobId = req.params.jobId;
    const deviceData = req.body;

    const newDevice = {
      id: `device-${deviceIdCounter++}`,
      jobId,
      ...deviceData,
      createdAt: new Date().toISOString()
    };

    devices.push(newDevice);
    res.json({ success: true, data: newDevice });
  } catch (error) {
    console.error('Error creating device:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update a device
router.put('/backflow-devices/:deviceId', async (req, res) => {
  try {
    const deviceId = req.params.deviceId;
    const deviceData = req.body;

    const index = devices.findIndex(d => d.id === deviceId);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }

    devices[index] = {
      ...devices[index],
      ...deviceData,
      updatedAt: new Date().toISOString()
    };

    res.json({ success: true, data: devices[index] });
  } catch (error) {
    console.error('Error updating device:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all test records for a job
router.get('/job/:jobId/backflow-tests', async (req, res) => {
  try {
    const jobId = req.params.jobId;
    const jobTests = testRecords.filter(t => t.jobId === jobId);
    res.json({ success: true, data: jobTests });
  } catch (error) {
    console.error('Error getting test records:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save a test record
router.post('/backflow-tests/save', async (req, res) => {
  try {
    const { device, test } = req.body;

    // First save/update device if needed
    let savedDevice;
    if (device.id && device.id.startsWith('device-')) {
      // Update existing device
      const deviceIndex = devices.findIndex(d => d.id === device.id);
      if (deviceIndex !== -1) {
        devices[deviceIndex] = { ...devices[deviceIndex], ...device };
        savedDevice = devices[deviceIndex];
      }
    } else {
      // Create new device
      savedDevice = {
        id: `device-${deviceIdCounter++}`,
        ...device,
        createdAt: new Date().toISOString()
      };
      devices.push(savedDevice);
    }

    // Save test record
    const newTest = {
      id: `test-${testIdCounter++}`,
      deviceId: savedDevice.id,
      ...test,
      createdAt: new Date().toISOString()
    };

    // Check if test already exists for this device
    const existingIndex = testRecords.findIndex(t => t.deviceId === savedDevice.id);
    if (existingIndex !== -1) {
      testRecords[existingIndex] = { ...testRecords[existingIndex], ...newTest };
      res.json({ success: true, data: testRecords[existingIndex] });
    } else {
      testRecords.push(newTest);
      res.json({ success: true, data: newTest });
    }
  } catch (error) {
    console.error('Error saving test:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get photos for a test record
router.get('/backflow-tests/:testId/photos', async (req, res) => {
  try {
    const testId = req.params.testId;
    const testPhotos = photos.filter(p => p.testRecordId === testId);
    res.json({ success: true, data: testPhotos });
  } catch (error) {
    console.error('Error getting photos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload photo directly to ServiceTitan
router.post('/backflow-photos/upload', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const generatedFileName = req.body.generatedFileName;
    const jobId = req.body.jobId;

    const photoData = {
      id: `photo-${photoIdCounter++}`,
      testRecordId: req.body.testRecordId,
      deviceId: req.body.deviceId,
      jobId: jobId,
      originalFileName: req.file.originalname,
      generatedFileName: generatedFileName,
      isFailedPhoto: req.body.isFailedPhoto === 'true',
      createdAt: new Date().toISOString(),
      uploadedToServiceTitan: false
    };

    // Upload photo to ServiceTitan as job attachment
    try {
      const tokenResult = await global.serviceTitan.getAccessToken();

      if (!tokenResult) {
        throw new Error('ServiceTitan authentication failed');
      }

      const fetch = (await import('node-fetch')).default;
      const FormData = require('form-data');
      const tenantId = global.serviceTitan.tenantId;
      const appKey = global.serviceTitan.appKey;

      // Create form data with file buffer from memory
      const formData = new FormData();
      formData.append('file', req.file.buffer, {
        filename: generatedFileName,
        contentType: req.file.mimetype
      });

      // Upload to ServiceTitan
      const uploadUrl = `${global.serviceTitan.apiBaseUrl}/forms/v2/tenant/${tenantId}/jobs/${jobId}/attachments`;

      console.log(`📤 Uploading photo to ServiceTitan: ${generatedFileName}`);

      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenResult}`,
          'ST-App-Key': appKey,
          ...formData.getHeaders()
        },
        body: formData
      });

      if (uploadResponse.ok) {
        const result = await uploadResponse.json();
        console.log(`✅ Photo uploaded to ServiceTitan: ${generatedFileName}`);
        photoData.uploadedToServiceTitan = true;
        photoData.serviceTitanAttachmentId = result.id;
      } else {
        const errorText = await uploadResponse.text();
        console.error(`❌ Failed to upload photo to ServiceTitan: ${uploadResponse.status} - ${errorText}`);
        throw new Error(`ServiceTitan upload failed: ${uploadResponse.statusText}`);
      }
    } catch (uploadErr) {
      console.error('Error uploading to ServiceTitan:', uploadErr);
      // Return error instead of continuing - photo upload is required
      return res.status(500).json({
        success: false,
        error: `Failed to upload photo to ServiceTitan: ${uploadErr.message}`
      });
    }

    // Store photo metadata in memory (no local file storage)
    photos.push(photoData);

    res.json({ success: true, data: photoData });
  } catch (error) {
    console.error('Error uploading photo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get photo by ID - photos are in ServiceTitan, return metadata only
router.get('/backflow-photos/:photoId', async (req, res) => {
  try {
    const photoId = req.params.photoId;
    const photo = photos.find(p => p.id === photoId);

    if (!photo) {
      return res.status(404).json({ success: false, error: 'Photo not found' });
    }

    res.json({ success: true, data: photo });
  } catch (error) {
    console.error('Error getting photo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete photo - remove from ServiceTitan
router.delete('/backflow-photos/:photoId', async (req, res) => {
  try {
    const photoId = req.params.photoId;
    const photoIndex = photos.findIndex(p => p.id === photoId);

    if (photoIndex === -1) {
      return res.status(404).json({ success: false, error: 'Photo not found' });
    }

    const photo = photos[photoIndex];

    // Delete from ServiceTitan if uploaded
    if (photo.serviceTitanAttachmentId) {
      try {
        const tokenResult = await global.serviceTitan.getAccessToken();
        if (tokenResult) {
          const fetch = (await import('node-fetch')).default;
          const tenantId = global.serviceTitan.tenantId;
          const appKey = global.serviceTitan.appKey;

          const deleteUrl = `${global.serviceTitan.apiBaseUrl}/forms/v2/tenant/${tenantId}/jobs/${photo.jobId}/attachments/${photo.serviceTitanAttachmentId}`;

          await fetch(deleteUrl, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${tokenResult}`,
              'ST-App-Key': appKey
            }
          });

          console.log(`✅ Photo deleted from ServiceTitan: ${photo.generatedFileName}`);
        }
      } catch (err) {
        console.error('Error deleting from ServiceTitan:', err);
      }
    }

    photos.splice(photoIndex, 1);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate PDF for a test - Fill actual TCEQ PDF template
router.post('/backflow-pdfs/generate', async (req, res) => {
  try {
    const { deviceId, testRecordId, jobId, technicianId, cityCode } = req.body;

    // Get device and test data
    const device = devices.find(d => d.id === deviceId);
    const test = testRecords.find(t => t.id === testRecordId);

    if (!device || !test) {
      return res.status(404).json({ success: false, error: 'Device or test not found' });
    }

    // Load the TCEQ PDF template
    const templatePath = path.join(__dirname, '../forms/TCEQ.pdf');
    const templateBytes = await fs.readFile(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const form = pdfDoc.getForm();

    // Get city information for PWS fields
    const cityInfo = excelParser.getCityInfo(cityCode);

    // Fill form fields based on TCEQ-20700 form structure
    // Note: Field names are generic ("Text Field", "Text Field_1", etc.)
    // Mapping based on visual order in TCEQ Form Excel Match.pdf

    try {
      // PWS Information (Fields 0-3)
      const pwsNameField = form.getTextField('Text Field');
      pwsNameField.setText(cityInfo?.pwsName || cityCode);

      const pwsIdField = form.getTextField('Text Field_1');
      pwsIdField.setText(cityInfo?.pwsId || '');

      const pwsAddressField = form.getTextField('Text Field_2');
      pwsAddressField.setText(cityInfo?.pwsAddress || '');

      const pwsContactField = form.getTextField('Text Field_3');
      pwsContactField.setText(cityInfo?.pwsContact || '');

      // Service Address (Field 4)
      const serviceAddressField = form.getTextField('Text Field_4');
      serviceAddressField.setText(device.bpaLocation || '');

      // Device Type Checkboxes (Fields 7-15) - Map device type to checkbox
      const deviceTypeMap = {
        'DC': 'Check Box',
        'RPZ': 'Check Box_1',
        'DCDA': 'Check Box_2',
        'RPDA': 'Check Box_2_1',
        'DCDA Type II': 'Check Box_2_2',
        'RPDA Type II': 'Check Box_2_3',
        'PVB': 'Check Box_2_4',
        'SVB': 'Check Box_2_5'
      };

      const deviceTypeCheckbox = deviceTypeMap[device.typeMain];
      if (deviceTypeCheckbox) {
        const checkbox = form.getCheckBox(deviceTypeCheckbox);
        checkbox.check();
      }

      // Main Device Information (Fields 5, 6, etc.)
      // Manufacturer
      const manufacturerField = form.getTextField('Text Field_5');
      manufacturerField.setText(device.manufacturerMain || '');

      // Model
      const modelField = form.getTextField('Text Field_6');
      modelField.setText(device.modelMain || '');

      // Serial Number
      const serialField = form.getTextField('Text Field_7');
      serialField.setText(device.serialMain || '');

      // Size
      const sizeField = form.getTextField('Text Field_8');
      sizeField.setText(device.sizeMain || '');

      // Test Date
      const testDateField = form.getTextField('Text Field_9');
      testDateField.setText(test.testDateInitial || '');

      // Test Time
      const testTimeField = form.getTextField('Text Field_10');
      testTimeField.setText(test.testTimeInitial || '');

      // BPA Location/Serves
      const bpaLocationField = form.getTextField('Text Field_11');
      bpaLocationField.setText(device.bpaLocation || '');

      const bpaServesField = form.getTextField('Text Field_12');
      bpaServesField.setText(device.bpaServes || '');

      // Test Readings - Map based on device type
      if (test.firstCheckReadingInitial) {
        const firstCheckField = form.getTextField('Text Field_13');
        firstCheckField.setText(test.firstCheckReadingInitial.toString());
      }

      if (test.secondCheckReadingInitial) {
        const secondCheckField = form.getTextField('Text Field_14');
        secondCheckField.setText(test.secondCheckReadingInitial.toString());
      }

      if (test.reliefValveReadingInitial) {
        const reliefValveField = form.getTextField('Text Field_15');
        reliefValveField.setText(test.reliefValveReadingInitial.toString());
      }

      // Test Result - Pass/Fail checkboxes
      if (test.testResult === 'Passed') {
        const passCheckbox = form.getCheckBox('Check Box_2_6');
        passCheckbox.check();
      } else if (test.testResult === 'Failed') {
        const failCheckbox = form.getCheckBox('Check Box_2_7');
        failCheckbox.check();
      }

      // Repairs if any
      if (test.repairsMain) {
        const repairsField = form.getTextField('Text Field_16');
        repairsField.setText(test.repairsMain);
      }

      // Remarks
      if (test.remarks) {
        const remarksField = form.getTextField('Text Field_17');
        remarksField.setText(test.remarks);
      }

      // Technician information (from technician record)
      // These would come from the authenticated technician
      // Placeholder for now - would need to pass technician data

    } catch (fieldError) {
      console.warn('Error filling some PDF fields:', fieldError.message);
      // Continue even if some fields fail
    }

    // Flatten the form to make it non-editable
    form.flatten();

    // Generate PDF bytes (no local file storage - goes directly to Google Drive)
    const pdfBytes = await pdfDoc.save();
    const fileName = `TCEQ-20700_${device.serialMain}_${test.testDateInitial}.pdf`;

    const pdfRecord = {
      id: `pdf-${pdfIdCounter++}`,
      deviceId,
      testRecordId,
      jobId,
      fileName,
      pdfBytes: Array.from(pdfBytes), // For Google Drive upload
      cityCode,
      createdAt: new Date().toISOString()
    };

    generatedPDFs.push(pdfRecord);

    res.json({ success: true, data: pdfRecord });
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get PDF data (for download from Google Drive)
router.get('/backflow-pdfs/:pdfId', async (req, res) => {
  try {
    const pdfId = req.params.pdfId;
    const pdf = generatedPDFs.find(p => p.id === pdfId);

    if (!pdf) {
      return res.status(404).json({ success: false, error: 'PDF not found' });
    }

    // Return PDF bytes for client to download
    const pdfBuffer = Buffer.from(pdf.pdfBytes);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdf.fileName}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error getting PDF:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add job note (proxy to ServiceTitan)
router.post('/job/:jobId/notes', async (req, res) => {
  try {
    const jobId = req.params.jobId;
    const { note } = req.body;

    // In production, this would call ServiceTitan API to add job note
    console.log(`Adding job note to job ${jobId}:`, note);

    // For now, just return success
    res.json({ success: true, message: 'Job note added' });
  } catch (error) {
    console.error('Error adding job note:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all cities with form types
router.get('/cities', async (req, res) => {
  try {
    const cities = excelParser.getAllCities();
    res.json({ success: true, data: cities });
  } catch (error) {
    console.error('Error getting cities:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get city information including PWS data
router.get('/cities/:cityName', async (req, res) => {
  try {
    const cityName = req.params.cityName;
    const cityInfo = excelParser.getCityInfo(cityName);

    if (!cityInfo) {
      return res.status(404).json({ success: false, error: 'City not found' });
    }

    res.json({ success: true, data: cityInfo });
  } catch (error) {
    console.error('Error getting city info:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get form field definitions
router.get('/form-fields', async (req, res) => {
  try {
    const fields = excelParser.parseFormFields();
    res.json({ success: true, data: fields });
  } catch (error) {
    console.error('Error getting form fields:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate online forms reference report
router.post('/backflow-pdfs/generate-online-reference', async (req, res) => {
  try {
    const { deviceId, testRecordId, jobId, cityCode } = req.body;

    // Get device and test data
    const device = devices.find(d => d.id === deviceId);
    const test = testRecords.find(t => t.id === testRecordId);

    if (!device || !test) {
      return res.status(404).json({ success: false, error: 'Device or test not found' });
    }

    // Get city information
    const cityInfo = excelParser.getCityInfo(cityCode);

    // Create a simple, easy-to-read PDF for manual data entry
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]); // Letter size
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const { width, height } = page.getSize();
    let y = height - 50;

    // Helper function to draw a field
    const drawField = (label, value) => {
      page.drawText(label, { x: 50, y, size: 10, font: boldFont });
      page.drawText(value || 'N/A', { x: 250, y, size: 10, font: font });
      y -= 20;
      if (y < 50) {
        // Add new page if needed
        const newPage = pdfDoc.addPage([612, 792]);
        y = height - 50;
        return newPage;
      }
      return page;
    };

    // Title
    page.drawText('Online Form Reference Sheet', {
      x: 50, y, size: 16, font: boldFont, color: rgb(0, 0, 0.6)
    });
    y -= 25;

    page.drawText(`City: ${cityCode} | Device: ${device.serialMain}`, {
      x: 50, y, size: 11, font: font
    });
    y -= 30;

    // Instructions
    page.drawText('Use this sheet to manually enter data into the online city portal:', {
      x: 50, y, size: 9, font: font, color: rgb(0.3, 0.3, 0.3)
    });
    y -= 25;

    // Draw divider line
    page.drawLine({
      start: { x: 50, y: y },
      end: { x: width - 50, y: y },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7)
    });
    y -= 25;

    // Section 1: PWS Information
    page.drawText('PUBLIC WATER SUPPLIER INFORMATION', {
      x: 50, y, size: 12, font: boldFont, color: rgb(0, 0, 0.6)
    });
    y -= 25;

    drawField('Public Water Supplier:', cityInfo?.pwsName || cityCode);
    drawField('PWS ID#:', cityInfo?.pwsId || '');
    drawField('PWS Mailing Address:', cityInfo?.pwsAddress || '');
    drawField('PWS Contact Person:', cityInfo?.pwsContact || '');
    y -= 10;

    // Section 2: Service Location
    page.drawText('SERVICE LOCATION', {
      x: 50, y, size: 12, font: boldFont, color: rgb(0, 0, 0.6)
    });
    y -= 25;

    drawField('Address of Service:', device.bpaLocation || '');
    drawField('BPA Serves:', device.bpaServes || '');
    y -= 10;

    // Section 3: Device Information
    page.drawText('BACKFLOW DEVICE INFORMATION', {
      x: 50, y, size: 12, font: boldFont, color: rgb(0, 0, 0.6)
    });
    y -= 25;

    drawField('Type of Backflow:', device.typeMain);
    drawField('Manufacturer:', device.manufacturerMain || '');
    drawField('Model Number:', device.modelMain || '');
    drawField('Serial Number:', device.serialMain);
    drawField('Size:', device.sizeMain || '');

    // Bypass info if applicable
    if (device.typeBypass) {
      y -= 10;
      page.drawText('BYPASS DEVICE (if applicable)', {
        x: 50, y, size: 11, font: boldFont
      });
      y -= 20;
      drawField('Bypass Type:', device.typeBypass);
      drawField('Bypass Manufacturer:', device.manufacturerBypass || '');
      drawField('Bypass Model:', device.modelBypass || '');
      drawField('Bypass Serial:', device.serialBypass || '');
    }
    y -= 10;

    // Section 4: Test Information
    page.drawText('TEST INFORMATION', {
      x: 50, y, size: 12, font: boldFont, color: rgb(0, 0, 0.6)
    });
    y -= 25;

    drawField('Test Date:', test.testDateInitial || '');
    drawField('Test Time:', test.testTimeInitial || '');
    drawField('Reason for Test:', test.reasonForTest || '');
    drawField('Installed Per Code:', test.installedPerCode || '');
    y -= 10;

    // Section 5: Test Readings
    page.drawText('INITIAL TEST READINGS', {
      x: 50, y, size: 12, font: boldFont, color: rgb(0, 0, 0.6)
    });
    y -= 25;

    // Show readings based on device type
    if (test.firstCheckReadingInitial) {
      drawField('1st Check Reading:', `${test.firstCheckReadingInitial} PSI (${test.firstCheckClosedTightInitial || ''})`);
    }
    if (test.secondCheckReadingInitial) {
      drawField('2nd Check Reading:', `${test.secondCheckReadingInitial} PSI (${test.secondCheckClosedTightInitial || ''})`);
    }
    if (test.reliefValveReadingInitial) {
      drawField('Relief Valve Reading:', `${test.reliefValveReadingInitial} PSI (${test.reliefValveDidNotOpenInitial || ''})`);
    }
    if (test.airInletReadingInitial) {
      drawField('Air Inlet Reading:', `${test.airInletReadingInitial} PSI (${test.airInletOpenedInitial || ''})`);
    }
    if (test.checkValveReadingInitial) {
      drawField('Check Valve Reading:', `${test.checkValveReadingInitial} PSI (${test.checkValveHeldInitial || ''})`);
    }
    y -= 10;

    // Section 6: Repairs (if any)
    if (test.repairsMain || test.repairsBypass) {
      page.drawText('REPAIRS PERFORMED', {
        x: 50, y, size: 12, font: boldFont, color: rgb(0.8, 0, 0)
      });
      y -= 25;

      if (test.repairsMain) {
        drawField('Main Device Repairs:', test.repairsMain);
      }
      if (test.repairsBypass) {
        drawField('Bypass Device Repairs:', test.repairsBypass);
      }
      y -= 10;

      // Post-repair readings if available
      if (test.firstCheckReadingFinal) {
        page.drawText('POST-REPAIR TEST READINGS', {
          x: 50, y, size: 12, font: boldFont, color: rgb(0, 0, 0.6)
        });
        y -= 25;

        if (test.firstCheckReadingFinal) {
          drawField('1st Check Reading (Final):', `${test.firstCheckReadingFinal} PSI`);
        }
        if (test.secondCheckReadingFinal) {
          drawField('2nd Check Reading (Final):', `${test.secondCheckReadingFinal} PSI`);
        }
        if (test.reliefValveReadingFinal) {
          drawField('Relief Valve Reading (Final):', `${test.reliefValveReadingFinal} PSI`);
        }
        y -= 10;
      }
    }

    // Section 7: Test Result
    page.drawText('TEST RESULT', {
      x: 50, y, size: 12, font: boldFont,
      color: test.testResult === 'Passed' ? rgb(0, 0.6, 0) : rgb(0.8, 0, 0)
    });
    y -= 25;

    drawField('Result:', test.testResult || 'Not Tested');
    if (test.quoteNeeded) {
      drawField('Quote Needed:', 'YES');
    }
    y -= 10;

    // Section 8: Remarks
    if (test.remarks) {
      page.drawText('REMARKS', {
        x: 50, y, size: 12, font: boldFont, color: rgb(0, 0, 0.6)
      });
      y -= 25;

      // Word wrap remarks
      const maxWidth = width - 100;
      const words = test.remarks.split(' ');
      let line = '';

      for (const word of words) {
        const testLine = line + word + ' ';
        const textWidth = font.widthOfTextAtSize(testLine, 10);

        if (textWidth > maxWidth && line.length > 0) {
          page.drawText(line.trim(), { x: 50, y, size: 10, font: font });
          y -= 15;
          line = word + ' ';
        } else {
          line = testLine;
        }
      }

      if (line.length > 0) {
        page.drawText(line.trim(), { x: 50, y, size: 10, font: font });
        y -= 20;
      }
    }

    // Footer
    y = 50;
    page.drawLine({
      start: { x: 50, y: y + 15 },
      end: { x: width - 50, y: y + 15 },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7)
    });

    page.drawText('This reference sheet is for manual online form entry only.', {
      x: 50, y, size: 8, font: font, color: rgb(0.4, 0.4, 0.4)
    });

    // Generate PDF bytes (no local file storage - goes directly to Google Drive)
    const pdfBytes = await pdfDoc.save();
    const fileName = `Online_Reference_${device.serialMain}_${test.testDateInitial}.pdf`;

    const pdfRecord = {
      id: `pdf-${pdfIdCounter++}`,
      deviceId,
      testRecordId,
      jobId,
      fileName,
      pdfBytes: Array.from(pdfBytes), // For Google Drive upload
      cityCode,
      isOnlineReference: true,
      createdAt: new Date().toISOString()
    };

    generatedPDFs.push(pdfRecord);

    res.json({ success: true, data: pdfRecord });
  } catch (error) {
    console.error('Error generating online reference:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
