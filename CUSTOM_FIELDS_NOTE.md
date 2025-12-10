# Custom Fields for Backflow Testing

## Current Implementation

The system now checks for custom fields in ServiceTitan technician records and falls back to placeholders if not found.

### Fields Checked:

**License Information:**
- `customFields.bpatLicenseNumber` or `customFields.licenseNumber`
- `customFields.licenseExpirationDate`

**Gauge Information:**
- `customFields.gauges` (array of gauge objects)

### Placeholder Values (if custom fields don't exist):

```javascript
bpatLicenseNumber: 'BPAT-PLACEHOLDER'
licenseExpirationDate: '2025-12-31'
gauges: [
  {
    id: 'gauge-1',
    type: 'Potable',
    makeModel: 'Placeholder Gauge',
    serialNumber: '000000',
    dateTestedForAccuracy: '2024-01-01'
  }
]
```

### Company Information (from environment variables):

```
COMPANY_NAME=MrBackflow TX
COMPANY_ADDRESS=126 Country Rd 4577, Boyd, TX 76023
COMPANY_PHONE=(817) 232-5577
```

## How to Add Custom Fields in ServiceTitan

### Option 1: ServiceTitan Custom Fields (Recommended)

1. Go to ServiceTitan Settings → Technicians
2. Click "Custom Fields"
3. Add the following custom fields:
   - **BPAT License Number** (Text)
   - **License Expiration Date** (Date)
   - **Gauge Make/Model** (Text)
   - **Gauge Serial Number** (Text)
   - **Gauge Calibration Date** (Date)
   - **Gauge Type** (Dropdown: Potable, Non-Potable)

4. Fill in values for each technician
5. Custom fields will automatically appear in API response

### Option 2: Check What Fields Already Exist

When a technician logs in, check the server logs for:
```
📋 Custom fields found: [field1, field2, field3]
```
or
```
⚠️  No custom fields found on technician record
```

This will show you what custom fields (if any) are already configured.

## Testing

To see what fields are available:

1. Start the backend server: `cd backend && npm start`
2. Login as a technician
3. Check server console output
4. Look for lines starting with `📋 Custom fields found:` or `⚠️  No custom fields`
5. The technician response will include `customFields: {...}` if any exist

## Alternative: Separate Storage

If ServiceTitan custom fields aren't available, you could:

1. Store license/gauge data in a separate database
2. Link by technician ID
3. Merge data when technician logs in

This is more complex but gives full control over the data structure.

## Recommendation

**Try ServiceTitan custom fields first** - they're the simplest solution and keep all technician data in one place.

If they don't work or aren't available, we can implement separate storage.
