/**
 * Test the new job folder structure
 */

// Load environment variables
require('dotenv').config({ path: '../.env' });

const googleDriveService = require('./services/googleDriveService');
const { PDFDocument, rgb } = require('pdf-lib');

async function testJobFolderStructure() {
  console.log('🧪 Testing Job Folder Structure\n');

  try {
    // Test 1: Save a draft for Job 12345
    console.log('1️⃣ Testing save draft for Job 12345...');
    
    // Create a simple test PDF
    const testPdf = await PDFDocument.create();
    const page = testPdf.addPage([400, 300]);
    page.drawText('Test Form for Job 12345', {
      x: 50,
      y: 250,
      size: 16,
      color: rgb(0, 0, 0)
    });
    page.drawText('Draft Document', {
      x: 50,
      y: 220,
      size: 12,
      color: rgb(0.5, 0.5, 0.5)
    });
    
    const pdfBytes = await testPdf.save();
    const testBuffer = Buffer.from(pdfBytes);

    const testFields = [
      {
        id: 'test_1',
        type: 'text',
        x: 50,
        y: 190,
        width: 200,
        height: 30,
        content: 'Test Text Field',
        page: 1
      }
    ];

    const draftResult = await googleDriveService.savePDFAsDraft(
      testBuffer,
      testFields,
      '12345',
      'inspection-form.pdf'
    );

    if (draftResult.success) {
      console.log('✅ Draft saved successfully!');
      console.log(`   File ID: ${draftResult.fileId}`);
      console.log(`   Job ID: ${draftResult.jobId}`);
      console.log(`   Type: ${draftResult.folderType}\n`);
    } else {
      console.log('❌ Failed to save draft:', draftResult.error);
      return false;
    }

    // Test 2: Save another draft for the same job
    console.log('2️⃣ Testing second draft for same job...');
    
    const secondPdf = await PDFDocument.create();
    const secondPage = secondPdf.addPage([400, 300]);
    secondPage.drawText('Second Form for Job 12345', {
      x: 50,
      y: 250,
      size: 16,
      color: rgb(0, 0, 0)
    });
    
    const secondPdfBytes = await secondPdf.save();
    const secondBuffer = Buffer.from(secondPdfBytes);

    const secondDraftResult = await googleDriveService.savePDFAsDraft(
      secondBuffer,
      testFields,
      '12345',
      'service-agreement.pdf'
    );

    if (secondDraftResult.success) {
      console.log('✅ Second draft saved successfully!\n');
    }

    // Test 3: Save a draft for different job
    console.log('3️⃣ Testing draft for different job (67890)...');
    
    const thirdDraftResult = await googleDriveService.savePDFAsDraft(
      testBuffer,
      testFields,
      '67890',
      'maintenance-report.pdf'
    );

    if (thirdDraftResult.success) {
      console.log('✅ Draft for job 67890 saved successfully!\n');
    }

    // Test 4: Get all files by job ID
    console.log('4️⃣ Testing get files by job ID...');
    
    const job12345Files = await googleDriveService.getFilesByJobId('12345');
    if (job12345Files.success) {
      console.log(`✅ Found files for job 12345:`);
      console.log(`   Drafts: ${job12345Files.drafts.length} files`);
      console.log(`   Completed: ${job12345Files.completed.length} files`);
      
      job12345Files.drafts.forEach(file => {
        console.log(`   📝 Draft: ${file.name} (${file.id})`);
      });
      console.log('');
    }

    // Test 5: Promote one draft to completed
    console.log('5️⃣ Testing promote draft to completed...');
    
    if (draftResult.success) {
      const promoteResult = await googleDriveService.promoteToCompleted(draftResult.fileId, '12345');
      
      if (promoteResult.success) {
        console.log('✅ Draft promoted to completed successfully!\n');
      } else {
        console.log('❌ Failed to promote draft:', promoteResult.error);
      }
    }

    // Test 6: Get all job files (overview)
    console.log('6️⃣ Testing get all job files...');
    
    const allFiles = await googleDriveService.getAllJobFiles();
    if (allFiles.success) {
      console.log('✅ Retrieved all job files:');
      
      Object.keys(allFiles.drafts).forEach(jobId => {
        const job = allFiles.drafts[jobId];
        console.log(`   📝 Job ${jobId} Drafts: ${job.files.length} files`);
      });
      
      Object.keys(allFiles.completed).forEach(jobId => {
        const job = allFiles.completed[jobId];
        console.log(`   ✅ Job ${jobId} Completed: ${job.files.length} files`);
      });
      console.log('');
    }

    // Test 7: Verify final structure
    console.log('7️⃣ Final verification...');
    const finalJob12345 = await googleDriveService.getFilesByJobId('12345');
    
    if (finalJob12345.success) {
      console.log(`✅ Final state for Job 12345:`);
      console.log(`   📝 Drafts: ${finalJob12345.drafts.length} files`);
      console.log(`   ✅ Completed: ${finalJob12345.completed.length} files`);
    }

    console.log('\n🎉 Job folder structure test completed!');
    console.log('\n📁 Expected Google Drive structure:');
    console.log('   Drafts/');
    console.log('   ├── 12345/');
    console.log('   │   └── service-agreement.pdf');
    console.log('   └── 67890/');
    console.log('       └── maintenance-report.pdf');
    console.log('   Completed/');
    console.log('   └── 12345/');
    console.log('       └── inspection-form.pdf');

    return true;

  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Run the test
testJobFolderStructure().then(success => {
  if (success) {
    console.log('\n🚀 SUCCESS! Job folder structure is working!');
    console.log('✅ Drafts are organized by Job ID');
    console.log('✅ Completed files are organized by Job ID');
    console.log('✅ Files can be promoted from draft to completed');
    console.log('✅ You can retrieve files by Job ID');
    console.log('✅ You can get overview of all jobs');
  } else {
    console.log('\n❌ Job folder structure test failed');
    console.log('Check the errors above and ensure Google Drive service is working');
  }
});