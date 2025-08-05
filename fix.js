#!/usr/bin/env node

/**
 * Import Path Fix Script
 * 
 * This script fixes incorrect relative import paths in React components.
 * 
 * Current issues:
 * - Login.jsx: import ../../services/apiClient (WRONG - should be ../services/apiClient)
 * - Attachments.jsx: import ../../services/apiClient (WRONG - should be ../services/apiClient)  
 * - Attachments.jsx: import ../../components/PDFEditor/PDFEditor (WRONG - should be ./PDFEditor)
 * 
 * Usage: node fix-imports.js
 */

const fs = require('fs');
const path = require('path');

// Utility functions
function log(message, type = 'info') {
  const timestamp = new Date().toISOString().substring(11, 19);
  const prefix = {
    info: '🔧',
    success: '✅',
    warning: '⚠️',
    error: '❌'
  };
  
  console.log(`${timestamp} ${prefix[type]} ${message}`);
}

function createBackupDir() {
  const backupDir = path.join(__dirname, 'import-fix-backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    log(`Created backup directory: ${backupDir}`, 'success');
  }
  return backupDir;
}

function backupFile(filePath, backupDir) {
  if (!fs.existsSync(filePath)) {
    log(`File not found: ${filePath}`, 'warning');
    return false;
  }
  
  const fileName = path.basename(filePath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `${fileName}.${timestamp}.backup`);
  
  try {
    fs.copyFileSync(filePath, backupPath);
    log(`Backed up: ${fileName}`, 'success');
    return true;
  } catch (error) {
    log(`Failed to backup ${fileName}: ${error.message}`, 'error');
    return false;
  }
}

function fixImportPaths(filePath, componentName, importFixes) {
  if (!fs.existsSync(filePath)) {
    log(`File not found: ${filePath}`, 'warning');
    return false;
  }
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    
    log(`Analyzing ${componentName}...`, 'info');
    
    importFixes.forEach(({ from, to, description }) => {
      if (content.includes(from)) {
        content = content.replace(from, to);
        log(`✅ Fixed: ${description}`, 'success');
        log(`   ${from} → ${to}`, 'info');
        changed = true;
      }
    });
    
    if (changed) {
      fs.writeFileSync(filePath, content, 'utf8');
      log(`✅ Updated ${componentName}`, 'success');
      return true;
    } else {
      log(`No import issues found in ${componentName}`, 'info');
      return false;
    }
  } catch (error) {
    log(`Failed to process ${componentName}: ${error.message}`, 'error');
    return false;
  }
}

function findFiles() {
  const files = {};
  
  // Find Login.jsx
  const loginPaths = [
    'src/pages/Login.jsx',
    'src/pages/Login.js',
    'src/components/Login.jsx'
  ];
  
  for (const p of loginPaths) {
    const fullPath = path.join(__dirname, p);
    if (fs.existsSync(fullPath)) {
      files.LOGIN = fullPath;
      log(`✅ Found Login: ${p}`, 'success');
      break;
    }
  }
  
  // Find Attachments.jsx
  const attachmentsPaths = [
    'src/pages/Attachments.jsx',
    'src/pages/Attachments.js',
    'src/components/Attachments.jsx'
  ];
  
  for (const p of attachmentsPaths) {
    const fullPath = path.join(__dirname, p);
    if (fs.existsSync(fullPath)) {
      files.ATTACHMENTS = fullPath;
      log(`✅ Found Attachments: ${p}`, 'success');
      break;
    }
  }
  
  return files;
}

function main() {
  log('🚀 Starting Import Path Fix Script', 'info');
  log('===============================');
  
  // Show current working directory
  log(`Working directory: ${__dirname}`, 'info');
  
  // Auto-detect files
  log('🔍 Looking for React component files...', 'info');
  const files = findFiles();
  
  if (Object.keys(files).length === 0) {
    log('❌ No component files found!', 'error');
    log('Make sure you\'re running this from your project root.', 'error');
    process.exit(1);
  }
  
  // Create backup directory
  const backupDir = createBackupDir();
  
  let totalFixed = 0;
  
  // Fix Login.jsx imports
  if (files.LOGIN) {
    log('Processing Login.jsx...', 'info');
    
    if (backupFile(files.LOGIN, backupDir)) {
      const loginFixes = [
        {
          from: 'import apiClient from "../../services/apiClient";',
          to: 'import apiClient from "../services/apiClient";',
          description: 'apiClient import path (removed extra ../ )'
        },
        {
          from: "import apiClient from '../../services/apiClient';",
          to: "import apiClient from '../services/apiClient';",
          description: 'apiClient import path with single quotes'
        }
      ];
      
      const fixed = fixImportPaths(files.LOGIN, 'Login.jsx', loginFixes);
      if (fixed) totalFixed++;
    }
  }
  
  // Fix Attachments.jsx imports  
  if (files.ATTACHMENTS) {
    log('Processing Attachments.jsx...', 'info');
    
    if (backupFile(files.ATTACHMENTS, backupDir)) {
      const attachmentsFixes = [
        {
          from: 'import PDFEditor from "../../components/PDFEditor/PDFEditor";',
          to: 'import PDFEditor from "./PDFEditor";',
          description: 'PDFEditor import path (assuming it\'s in same directory)'
        },
        {
          from: "import PDFEditor from '../../components/PDFEditor/PDFEditor';",
          to: "import PDFEditor from './PDFEditor';",
          description: 'PDFEditor import path with single quotes'
        },
        {
          from: 'import apiClient from "../../services/apiClient";',
          to: 'import apiClient from "../services/apiClient";',
          description: 'apiClient import path (removed extra ../ )'
        },
        {
          from: "import apiClient from '../../services/apiClient';",
          to: "import apiClient from '../services/apiClient';",
          description: 'apiClient import path with single quotes'
        }
      ];
      
      const fixed = fixImportPaths(files.ATTACHMENTS, 'Attachments.jsx', attachmentsFixes);
      if (fixed) totalFixed++;
    }
  }
  
  // Check if PDFEditor exists where we expect it
  const pdfEditorPaths = [
    'src/pages/PDFEditor.jsx',
    'src/pages/PDFEditor.js',
    'src/components/PDFEditor.jsx',
    'src/components/PDFEditor/PDFEditor.jsx'
  ];
  
  let pdfEditorFound = false;
  for (const p of pdfEditorPaths) {
    if (fs.existsSync(path.join(__dirname, p))) {
      log(`✅ Found PDFEditor at: ${p}`, 'success');
      pdfEditorFound = true;
      
      // If PDFEditor is not in same directory as Attachments, suggest correct path
      if (p !== 'src/pages/PDFEditor.jsx') {
        log(`⚠️ PDFEditor is at ${p}, you may need to adjust the import path manually`, 'warning');
      }
      break;
    }
  }
  
  if (!pdfEditorFound) {
    log(`⚠️ PDFEditor component not found in common locations`, 'warning');
    log('You may need to create it or adjust the import path manually', 'warning');
  }
  
  // Final report
  log('===============================');
  if (totalFixed > 0) {
    log(`✨ Import path fixes completed!`, 'success');
    log(`Fixed ${totalFixed} component file(s)`, 'success');
    log('');
    log('🎯 Changes made:', 'info');
    log('• Fixed incorrect relative import paths', 'info');
    log('• Removed extra "../" that caused imports to go outside src/', 'info');
    log('• Created backups of all modified files', 'info');
    log('');
    log('📋 Next steps:', 'info');
    log('1. Check if PDFEditor component exists and is in the right location', 'info');
    log('2. Restart your React dev server (Ctrl+C, then npm start)', 'info');
    log('3. Test your application', 'info');
    log('');
    log(`💾 Backups saved in: ${backupDir}`, 'info');
  } else {
    log('ℹ️ No import path issues found that match the expected patterns.', 'info');
    log('The import errors might be caused by missing files rather than wrong paths.', 'info');
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main, fixImportPaths, backupFile };