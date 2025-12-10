const XLSX = require('xlsx');
const path = require('path');

class ExcelParser {
  constructor() {
    this.formsPath = path.join(__dirname, '../forms');
  }

  /**
   * Parse City information.xlsx
   * Returns array of cities with their form types and PWS info
   */
  parseCityInformation() {
    try {
      const filePath = path.join(this.formsPath, 'City information.xlsx');
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON
      const data = XLSX.utils.sheet_to_json(worksheet);

      // Transform data
      const cities = data.map(row => ({
        city: row.City || row.city,
        onlineOrPaper: row['Online or Paper'] || row.onlineOrPaper || 'Paper',
        formType: row['Software/Form Name'] || row.formType || 'TCEQ Form',
        // Placeholder for PWS data - will need to be enhanced with actual PWS info
        pwsName: row.pwsName || `${row.City || row.city} Water Supply`,
        pwsId: row.pwsId || null,
        pwsMailingAddress: row.pwsMailingAddress || null,
        pwsContactPerson: row.pwsContactPerson || null
      }));

      console.log(`✅ Parsed ${cities.length} cities from City information.xlsx`);
      return cities;
    } catch (error) {
      console.error('❌ Error parsing City information.xlsx:', error);
      return [];
    }
  }

  /**
   * Parse Form Fields.xlsx
   * Returns structured field definitions with validation rules
   */
  parseFormFields() {
    try {
      const filePath = path.join(this.formsPath, 'Form Fields.xlsx');
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON
      const data = XLSX.utils.sheet_to_json(worksheet);

      // Transform and categorize fields
      const fields = {
        pwsInfo: [],
        deviceInfo: [],
        preTestChecks: [],
        initialTest: [],
        repairs: [],
        postRepairTest: [],
        gaugeInfo: [],
        technicianInfo: [],
        all: []
      };

      data.forEach((row, index) => {
        const fieldDef = {
          id: index + 1, // Field number matching PDF annotations
          name: row['Field Name'] || row.fieldName,
          type: row['Field Type'] || row.fieldType,
          options: row['Options'] || row.options,
          source: row['Source'] || row.source,
          location: row['Location of Information'] || row.location,
          notes: row['Notes'] || row.notes,
          required: (row.notes || '').includes('*'),
          validation: this.getValidationRules(row)
        };

        // Categorize by field name
        const name = fieldDef.name || '';

        if (name.toLowerCase().includes('pws') || name.toLowerCase().includes('public water')) {
          fields.pwsInfo.push(fieldDef);
        } else if (name.toLowerCase().includes('manufacturer') || name.toLowerCase().includes('model') ||
                   name.toLowerCase().includes('serial') || name.toLowerCase().includes('size') ||
                   name.toLowerCase().includes('bpa')) {
          fields.deviceInfo.push(fieldDef);
        } else if (name.toLowerCase().includes('reason for test') ||
                   name.toLowerCase().includes('installed') ||
                   name.toLowerCase().includes('non-potable')) {
          fields.preTestChecks.push(fieldDef);
        } else if (name.toLowerCase().includes('initial test') ||
                   name.toLowerCase().includes('check reading') ||
                   name.toLowerCase().includes('relief valve') ||
                   name.toLowerCase().includes('air inlet') && !name.toLowerCase().includes('after repair')) {
          fields.initialTest.push(fieldDef);
        } else if (name.toLowerCase().includes('repair') && !name.toLowerCase().includes('after')) {
          fields.repairs.push(fieldDef);
        } else if (name.toLowerCase().includes('after repair') || name.toLowerCase().includes('test after')) {
          fields.postRepairTest.push(fieldDef);
        } else if (name.toLowerCase().includes('gauge')) {
          fields.gaugeInfo.push(fieldDef);
        } else if (name.toLowerCase().includes('company') || name.toLowerCase().includes('license') ||
                   name.toLowerCase().includes('tester')) {
          fields.technicianInfo.push(fieldDef);
        }

        fields.all.push(fieldDef);
      });

      console.log(`✅ Parsed ${fields.all.length} field definitions from Form Fields.xlsx`);
      console.log(`   - PWS Info: ${fields.pwsInfo.length}`);
      console.log(`   - Device Info: ${fields.deviceInfo.length}`);
      console.log(`   - Initial Test: ${fields.initialTest.length}`);
      console.log(`   - Technician Info: ${fields.technicianInfo.length}`);

      return fields;
    } catch (error) {
      console.error('❌ Error parsing Form Fields.xlsx:', error);
      return { all: [] };
    }
  }

  /**
   * Extract validation rules from field definition
   */
  getValidationRules(row) {
    const type = (row['Field Type'] || row.fieldType || '').toLowerCase();
    const notes = (row['Notes'] || row.notes || '').toLowerCase();

    const rules = {
      required: notes.includes('*'),
      type: type
    };

    // Numeric validation
    if (type.includes('number')) {
      rules.numeric = true;

      if (type.includes('one decimal')) {
        rules.pattern = /^\d+\.?\d?$/;
        rules.maxDecimals = 1;
      } else {
        rules.pattern = /^\d+$/;
        rules.integer = true;
      }
    }

    // Date validation
    if (type.includes('date')) {
      rules.dateType = true;

      if (type.includes('current')) {
        rules.defaultToday = true;
      }
    }

    // Time validation
    if (type.includes('time')) {
      rules.timeType = true;

      if (type.includes('current')) {
        rules.defaultNow = true;
      }
    }

    // Dropdown validation
    if (type.includes('dropdown') || type.includes('multiple choice')) {
      rules.selectType = true;

      if (row['Options'] || row.options) {
        const options = (row['Options'] || row.options).toString();
        rules.options = options.split(',').map(o => o.trim());
      }
    }

    return rules;
  }

  /**
   * Get city by name
   */
  getCityInfo(cityName) {
    const cities = this.parseCityInformation();
    return cities.find(c => c.city.toLowerCase() === cityName.toLowerCase());
  }

  /**
   * Get all cities for dropdown
   */
  getAllCities() {
    const cities = this.parseCityInformation();
    return cities.map(c => ({
      value: c.city,
      label: c.city,
      formType: c.formType
    }));
  }
}

// Export singleton instance
const excelParser = new ExcelParser();
module.exports = excelParser;
