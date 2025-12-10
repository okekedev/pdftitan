const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const excelParser = require('../services/excelParser');

// Configure multer for photo uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/backflow-photos');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'photo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

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

// Upload photo
router.post('/backflow-photos/upload', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const photoData = {
      id: `photo-${photoIdCounter++}`,
      testRecordId: req.body.testRecordId,
      deviceId: req.body.deviceId,
      jobId: req.body.jobId,
      filePath: req.file.path,
      originalFileName: req.file.originalname,
      generatedFileName: req.body.generatedFileName,
      isFailedPhoto: req.body.isFailedPhoto === 'true',
      createdAt: new Date().toISOString()
    };

    photos.push(photoData);
    res.json({ success: true, data: photoData });
  } catch (error) {
    console.error('Error uploading photo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get photo by ID
router.get('/backflow-photos/:photoId', async (req, res) => {
  try {
    const photoId = req.params.photoId;
    const photo = photos.find(p => p.id === photoId);

    if (!photo) {
      return res.status(404).json({ success: false, error: 'Photo not found' });
    }

    res.sendFile(photo.filePath);
  } catch (error) {
    console.error('Error getting photo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete photo
router.delete('/backflow-photos/:photoId', async (req, res) => {
  try {
    const photoId = req.params.photoId;
    const photoIndex = photos.findIndex(p => p.id === photoId);

    if (photoIndex === -1) {
      return res.status(404).json({ success: false, error: 'Photo not found' });
    }

    // Delete file from disk
    try {
      await fs.unlink(photos[photoIndex].filePath);
    } catch (err) {
      console.error('Error deleting file:', err);
    }

    photos.splice(photoIndex, 1);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate PDF for a test
router.post('/backflow-pdfs/generate', async (req, res) => {
  try {
    const { deviceId, testRecordId, jobId, technicianId, cityCode } = req.body;

    // Get device and test data
    const device = devices.find(d => d.id === deviceId);
    const test = testRecords.find(t => t.id === testRecordId);

    if (!device || !test) {
      return res.status(404).json({ success: false, error: 'Device or test not found' });
    }

    // Generate PDF (simplified for now - in production, use proper PDF templates)
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]); // Letter size
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const { width, height } = page.getSize();
    let yPosition = height - 50;

    // Title
    page.drawText('Backflow Prevention Assembly Test Report', {
      x: 50,
      y: yPosition,
      size: 16,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    yPosition -= 30;

    // Form type
    page.drawText(`Form Type: ${cityCode === 'TCEQ' ? 'TCEQ-20700' : cityCode + ' City Form'}`, {
      x: 50,
      y: yPosition,
      size: 12,
      font: font,
    });

    yPosition -= 30;

    // Device information
    const deviceInfo = [
      `Device Type: ${device.typeMain}`,
      `Manufacturer: ${device.manufacturerMain || 'N/A'}`,
      `Model: ${device.modelMain || 'N/A'}`,
      `Serial Number: ${device.serialMain}`,
      `Size: ${device.sizeMain || 'N/A'}`,
      `Location: ${device.bpaLocation || 'N/A'}`,
      `Serves: ${device.bpaServes || 'N/A'}`,
    ];

    deviceInfo.forEach(line => {
      page.drawText(line, { x: 50, y: yPosition, size: 10, font: font });
      yPosition -= 15;
    });

    yPosition -= 10;

    // Test information
    const testInfo = [
      `Test Date: ${test.testDateInitial}`,
      `Test Time: ${test.testTimeInitial}`,
      `Reason for Test: ${test.reasonForTest}`,
      `Installed Per Code: ${test.installedPerCode}`,
      `Test Result: ${test.testResult}`,
    ];

    testInfo.forEach(line => {
      page.drawText(line, { x: 50, y: yPosition, size: 10, font: font });
      yPosition -= 15;
    });

    // Add test readings based on device type
    if (test.firstCheckReadingInitial) {
      yPosition -= 10;
      page.drawText('Initial Test Readings:', { x: 50, y: yPosition, size: 11, font: boldFont });
      yPosition -= 15;

      if (test.firstCheckReadingInitial) {
        page.drawText(`First Check: ${test.firstCheckReadingInitial} PSI (${test.firstCheckClosedTightInitial})`, {
          x: 50, y: yPosition, size: 10, font: font
        });
        yPosition -= 15;
      }

      if (test.secondCheckReadingInitial) {
        page.drawText(`Second Check: ${test.secondCheckReadingInitial} PSI (${test.secondCheckClosedTightInitial})`, {
          x: 50, y: yPosition, size: 10, font: font
        });
        yPosition -= 15;
      }

      if (test.reliefValveReadingInitial) {
        page.drawText(`Relief Valve: ${test.reliefValveReadingInitial} PSI (${test.reliefValveDidNotOpenInitial})`, {
          x: 50, y: yPosition, size: 10, font: font
        });
        yPosition -= 15;
      }
    }

    // Repairs
    if (test.repairsMain || test.repairsBypass) {
      yPosition -= 10;
      page.drawText('Repairs:', { x: 50, y: yPosition, size: 11, font: boldFont });
      yPosition -= 15;

      if (test.repairsMain) {
        page.drawText(`Main: ${test.repairsMain}`, { x: 50, y: yPosition, size: 10, font: font });
        yPosition -= 15;
      }

      if (test.repairsBypass) {
        page.drawText(`Bypass: ${test.repairsBypass}`, { x: 50, y: yPosition, size: 10, font: font });
        yPosition -= 15;
      }
    }

    // Remarks
    if (test.remarks) {
      yPosition -= 10;
      page.drawText('Remarks:', { x: 50, y: yPosition, size: 11, font: boldFont });
      yPosition -= 15;
      page.drawText(test.remarks, { x: 50, y: yPosition, size: 10, font: font });
    }

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    const fileName = `Backflow_${device.serialMain}_${test.testDateInitial}.pdf`;
    const pdfPath = path.join(__dirname, '../uploads/backflow-pdfs', fileName);

    // Ensure directory exists
    await fs.mkdir(path.dirname(pdfPath), { recursive: true });
    await fs.writeFile(pdfPath, pdfBytes);

    const pdfRecord = {
      id: `pdf-${pdfIdCounter++}`,
      deviceId,
      testRecordId,
      jobId,
      fileName,
      filePath: pdfPath,
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

// Download PDF
router.get('/backflow-pdfs/:pdfId/download', async (req, res) => {
  try {
    const pdfId = req.params.pdfId;
    const pdf = generatedPDFs.find(p => p.id === pdfId);

    if (!pdf) {
      return res.status(404).json({ success: false, error: 'PDF not found' });
    }

    res.download(pdf.filePath, pdf.fileName);
  } catch (error) {
    console.error('Error downloading PDF:', error);
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

module.exports = router;
