import React, { useState, useEffect } from 'react';
import './TestForm.css';

const DEVICE_TYPES = ['DC', 'RPZ', 'DCDA', 'RPDA', 'DCDA Type II', 'RPDA Type II', 'PVB', 'SVB'];
const SIZES = ['1/2"', '3/4"', '1"', '1-1/4"', '1-1/2"', '2"', '2-1/2"', '3"', '4"', '6"', '8"', '10"'];

export default function TestForm({ device, job, technician, existingTest, onSave, onCancel }) {
  const [isDeviceStep, setIsDeviceStep] = useState(device?.isNew || false);
  const [deviceData, setDeviceData] = useState({
    typeMain: device?.typeMain || '',
    manufacturerMain: device?.manufacturerMain || '',
    modelMain: device?.modelMain || '',
    serialMain: device?.serialMain || '',
    sizeMain: device?.sizeMain || '',
    manufacturerBypass: device?.manufacturerBypass || '',
    modelBypass: device?.modelBypass || '',
    serialBypass: device?.serialBypass || '',
    sizeBypass: device?.sizeBypass || '',
    bpaLocation: device?.bpaLocation || '',
    bpaServes: device?.bpaServes || ''
  });

  const [testData, setTestData] = useState({
    testDateInitial: existingTest?.testDateInitial || new Date().toISOString().split('T')[0],
    testTimeInitial: existingTest?.testTimeInitial || new Date().toTimeString().slice(0, 5),
    reasonForTest: existingTest?.reasonForTest || 'Existing',
    oldSerial: existingTest?.oldSerial || '',
    installedPerCode: existingTest?.installedPerCode || 'Yes',
    installedOnNonPotableAuxiliary: existingTest?.installedOnNonPotableAuxiliary || 'No',

    // Initial test readings
    firstCheckReadingInitial: existingTest?.firstCheckReadingInitial || '',
    firstCheckClosedTightInitial: existingTest?.firstCheckClosedTightInitial || 'Closed Tight',
    secondCheckReadingInitial: existingTest?.secondCheckReadingInitial || '',
    secondCheckClosedTightInitial: existingTest?.secondCheckClosedTightInitial || 'Closed Tight',
    reliefValveReadingInitial: existingTest?.reliefValveReadingInitial || '',
    reliefValveDidNotOpenInitial: existingTest?.reliefValveDidNotOpenInitial || 'Did not open',
    typeIIBypassCheckReadingInitial: existingTest?.typeIIBypassCheckReadingInitial || '',
    typeIIBypassClosedTightInitial: existingTest?.typeIIBypassClosedTightInitial || 'Closed Tight',
    airInletReadingInitial: existingTest?.airInletReadingInitial || '',
    airInletDidNotOpenInitial: existingTest?.airInletDidNotOpenInitial || 'Yes',
    airInletFullyOpenInitial: existingTest?.airInletFullyOpenInitial || 'Yes',
    checkValveReadingInitial: existingTest?.checkValveReadingInitial || '',
    checkValveLeakedInitial: existingTest?.checkValveLeakedInitial || 'No',

    // Repairs
    repairsMain: existingTest?.repairsMain || '',
    repairsBypass: existingTest?.repairsBypass || '',

    // After repair readings
    testDateAfterRepair: existingTest?.testDateAfterRepair || '',
    testTimeAfterRepair: existingTest?.testTimeAfterRepair || '',
    firstCheckReadingAfterRepair: existingTest?.firstCheckReadingAfterRepair || '',
    firstCheckClosedTightAfterRepair: existingTest?.firstCheckClosedTightAfterRepair || 'Closed Tight',
    secondCheckReadingAfterRepair: existingTest?.secondCheckReadingAfterRepair || '',
    secondCheckClosedTightAfterRepair: existingTest?.secondCheckClosedTightAfterRepair || 'Closed Tight',
    reliefValveReadingAfterRepair: existingTest?.reliefValveReadingAfterRepair || '',
    typeIIBypassCheckReadingAfterRepair: existingTest?.typeIIBypassCheckReadingAfterRepair || '',
    typeIIBypassClosedTightAfterRepair: existingTest?.typeIIBypassClosedTightAfterRepair || 'Closed Tight',
    airInletReadingAfterRepair: existingTest?.airInletReadingAfterRepair || '',
    checkValveReadingAfterRepair: existingTest?.checkValveReadingAfterRepair || '',

    // Other fields
    differentialPressureGaugeType: existingTest?.differentialPressureGaugeType || 'Potable',
    testResult: existingTest?.testResult || '',
    quoteNeeded: existingTest?.quoteNeeded || false,
    remarks: existingTest?.remarks || ''
  });

  const hasRepairs = testData.repairsMain || testData.repairsBypass;

  const handleDeviceChange = (field, value) => {
    setDeviceData({ ...deviceData, [field]: value });
  };

  const handleTestChange = (field, value) => {
    setTestData({ ...testData, [field]: value });
  };

  const handleDeviceNext = () => {
    // Validate required device fields
    if (!deviceData.typeMain || !deviceData.serialMain) {
      alert('Please fill in Device Type and Serial Number');
      return;
    }
    setIsDeviceStep(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate required test fields
    if (!testData.testDateInitial || !testData.testResult) {
      alert('Please fill in Test Date and Test Result');
      return;
    }

    // Combine device and test data
    const completeData = {
      device: deviceData,
      test: testData
    };

    onSave(completeData);
  };

  const shouldShowField = (field) => {
    const type = deviceData.typeMain;

    // Check readings - DC, RPZ, DCDA, RPDA
    if (field.includes('Check')) {
      return ['DC', 'RPZ', 'DCDA', 'RPDA', 'DCDA Type II', 'RPDA Type II'].includes(type);
    }

    // Relief valve - RPZ, RPDA
    if (field.includes('reliefValve')) {
      return ['RPZ', 'RPDA', 'RPDA Type II'].includes(type);
    }

    // Type II bypass - DCDA Type II, RPDA Type II
    if (field.includes('typeIIBypass')) {
      return ['DCDA Type II', 'RPDA Type II'].includes(type);
    }

    // Air inlet - PVB, SVB
    if (field.includes('airInlet')) {
      return ['PVB', 'SVB'].includes(type);
    }

    // Check valve leak - PVB, SVB
    if (field.includes('checkValve')) {
      return ['PVB', 'SVB'].includes(type);
    }

    return true;
  };

  if (isDeviceStep) {
    return (
      <div className="test-form-container">
        <div className="form-header">
          <h3>{device?.isNew ? 'Add New Device' : 'Edit Device'}</h3>
        </div>

        <form className="test-form">
          <div className="form-section">
            <h4>Main Assembly</h4>
            <div className="form-grid">
              <div className="form-group">
                <label>Device Type *</label>
                <select
                  value={deviceData.typeMain}
                  onChange={(e) => handleDeviceChange('typeMain', e.target.value)}
                  required
                >
                  <option value="">Select Type</option>
                  {DEVICE_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Manufacturer</label>
                <input
                  type="text"
                  value={deviceData.manufacturerMain}
                  onChange={(e) => handleDeviceChange('manufacturerMain', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Model</label>
                <input
                  type="text"
                  value={deviceData.modelMain}
                  onChange={(e) => handleDeviceChange('modelMain', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Serial Number *</label>
                <input
                  type="text"
                  value={deviceData.serialMain}
                  onChange={(e) => handleDeviceChange('serialMain', e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Size</label>
                <select
                  value={deviceData.sizeMain}
                  onChange={(e) => handleDeviceChange('sizeMain', e.target.value)}
                >
                  <option value="">Select Size</option>
                  {SIZES.map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {(deviceData.typeMain === 'DCDA' || deviceData.typeMain === 'RPDA') && (
            <div className="form-section">
              <h4>Bypass Assembly (Optional)</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Manufacturer</label>
                  <input
                    type="text"
                    value={deviceData.manufacturerBypass}
                    onChange={(e) => handleDeviceChange('manufacturerBypass', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Model</label>
                  <input
                    type="text"
                    value={deviceData.modelBypass}
                    onChange={(e) => handleDeviceChange('modelBypass', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Serial Number</label>
                  <input
                    type="text"
                    value={deviceData.serialBypass}
                    onChange={(e) => handleDeviceChange('serialBypass', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Size</label>
                  <select
                    value={deviceData.sizeBypass}
                    onChange={(e) => handleDeviceChange('sizeBypass', e.target.value)}
                  >
                    <option value="">Select Size</option>
                    {SIZES.map(size => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="form-section">
            <h4>Location Information</h4>
            <div className="form-grid">
              <div className="form-group">
                <label>BPA Location</label>
                <input
                  type="text"
                  value={deviceData.bpaLocation}
                  onChange={(e) => handleDeviceChange('bpaLocation', e.target.value)}
                  placeholder="e.g., Front yard, Garage"
                />
              </div>

              <div className="form-group">
                <label>BPA Serves</label>
                <input
                  type="text"
                  value={deviceData.bpaServes}
                  onChange={(e) => handleDeviceChange('bpaServes', e.target.value)}
                  placeholder="e.g., Irrigation, Fire sprinkler"
                />
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onCancel} className="btn btn-secondary">
              Cancel
            </button>
            <button type="button" onClick={handleDeviceNext} className="btn btn-primary">
              Next: Test Data
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="test-form-container">
      <div className="form-header">
        <h3>Test Data - {deviceData.typeMain} (SN: {deviceData.serialMain})</h3>
      </div>

      <form className="test-form" onSubmit={handleSubmit}>
        <div className="form-section">
          <h4>Test Information</h4>
          <div className="form-grid">
            <div className="form-group">
              <label>Test Date *</label>
              <input
                type="date"
                value={testData.testDateInitial}
                onChange={(e) => handleTestChange('testDateInitial', e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Test Time *</label>
              <input
                type="time"
                value={testData.testTimeInitial}
                onChange={(e) => handleTestChange('testTimeInitial', e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Reason for Test</label>
              <select
                value={testData.reasonForTest}
                onChange={(e) => handleTestChange('reasonForTest', e.target.value)}
              >
                <option value="New">New Installation</option>
                <option value="Existing">Existing - Annual Test</option>
                <option value="Replacement">Replacement</option>
              </select>
            </div>

            {testData.reasonForTest === 'Replacement' && (
              <div className="form-group">
                <label>Old Serial Number</label>
                <input
                  type="text"
                  value={testData.oldSerial}
                  onChange={(e) => handleTestChange('oldSerial', e.target.value)}
                />
              </div>
            )}

            <div className="form-group">
              <label>Installed Per Code?</label>
              <select
                value={testData.installedPerCode}
                onChange={(e) => handleTestChange('installedPerCode', e.target.value)}
              >
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>

            <div className="form-group">
              <label>Installed on Non-Potable Auxiliary?</label>
              <select
                value={testData.installedOnNonPotableAuxiliary}
                onChange={(e) => handleTestChange('installedOnNonPotableAuxiliary', e.target.value)}
              >
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>

            <div className="form-group">
              <label>Gauge Type</label>
              <select
                value={testData.differentialPressureGaugeType}
                onChange={(e) => handleTestChange('differentialPressureGaugeType', e.target.value)}
              >
                <option value="Potable">Potable</option>
                <option value="Non-potable">Non-potable</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h4>Initial Test Readings</h4>
          <div className="form-grid">
            {shouldShowField('firstCheck') && (
              <>
                <div className="form-group">
                  <label>First Check Reading (PSI)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={testData.firstCheckReadingInitial}
                    onChange={(e) => handleTestChange('firstCheckReadingInitial', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>First Check Status</label>
                  <select
                    value={testData.firstCheckClosedTightInitial}
                    onChange={(e) => handleTestChange('firstCheckClosedTightInitial', e.target.value)}
                  >
                    <option value="Closed Tight">Closed Tight</option>
                    <option value="Leaked">Leaked</option>
                  </select>
                </div>
              </>
            )}

            {shouldShowField('secondCheck') && (
              <>
                <div className="form-group">
                  <label>Second Check Reading (PSI)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={testData.secondCheckReadingInitial}
                    onChange={(e) => handleTestChange('secondCheckReadingInitial', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Second Check Status</label>
                  <select
                    value={testData.secondCheckClosedTightInitial}
                    onChange={(e) => handleTestChange('secondCheckClosedTightInitial', e.target.value)}
                  >
                    <option value="Closed Tight">Closed Tight</option>
                    <option value="Leaked">Leaked</option>
                  </select>
                </div>
              </>
            )}

            {shouldShowField('reliefValve') && (
              <>
                <div className="form-group">
                  <label>Relief Valve Reading (PSI)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={testData.reliefValveReadingInitial}
                    onChange={(e) => handleTestChange('reliefValveReadingInitial', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Relief Valve Status</label>
                  <select
                    value={testData.reliefValveDidNotOpenInitial}
                    onChange={(e) => handleTestChange('reliefValveDidNotOpenInitial', e.target.value)}
                  >
                    <option value="Did not open">Did not open</option>
                    <option value="Opened">Opened</option>
                  </select>
                </div>
              </>
            )}

            {shouldShowField('typeIIBypass') && (
              <>
                <div className="form-group">
                  <label>Type II Bypass Check Reading (PSI)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={testData.typeIIBypassCheckReadingInitial}
                    onChange={(e) => handleTestChange('typeIIBypassCheckReadingInitial', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Type II Bypass Status</label>
                  <select
                    value={testData.typeIIBypassClosedTightInitial}
                    onChange={(e) => handleTestChange('typeIIBypassClosedTightInitial', e.target.value)}
                  >
                    <option value="Closed Tight">Closed Tight</option>
                    <option value="Leaked">Leaked</option>
                  </select>
                </div>
              </>
            )}

            {shouldShowField('airInlet') && (
              <>
                <div className="form-group">
                  <label>Air Inlet Reading (PSI)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={testData.airInletReadingInitial}
                    onChange={(e) => handleTestChange('airInletReadingInitial', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Air Inlet Did Not Open?</label>
                  <select
                    value={testData.airInletDidNotOpenInitial}
                    onChange={(e) => handleTestChange('airInletDidNotOpenInitial', e.target.value)}
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Air Inlet Fully Open?</label>
                  <select
                    value={testData.airInletFullyOpenInitial}
                    onChange={(e) => handleTestChange('airInletFullyOpenInitial', e.target.value)}
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
              </>
            )}

            {shouldShowField('checkValve') && (
              <>
                <div className="form-group">
                  <label>Check Valve Reading (PSI)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={testData.checkValveReadingInitial}
                    onChange={(e) => handleTestChange('checkValveReadingInitial', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Check Valve Leaked?</label>
                  <select
                    value={testData.checkValveLeakedInitial}
                    onChange={(e) => handleTestChange('checkValveLeakedInitial', e.target.value)}
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="form-section">
          <h4>Repairs (if any)</h4>
          <div className="form-grid">
            <div className="form-group full-width">
              <label>Main Assembly Repairs</label>
              <textarea
                rows="3"
                value={testData.repairsMain}
                onChange={(e) => handleTestChange('repairsMain', e.target.value)}
                placeholder="Describe any repairs or parts replaced on main assembly..."
              />
            </div>

            <div className="form-group full-width">
              <label>Bypass Assembly Repairs</label>
              <textarea
                rows="3"
                value={testData.repairsBypass}
                onChange={(e) => handleTestChange('repairsBypass', e.target.value)}
                placeholder="Describe any repairs or parts replaced on bypass assembly..."
              />
            </div>
          </div>
        </div>

        {hasRepairs && (
          <div className="form-section">
            <h4>After-Repair Test Readings</h4>
            <div className="form-grid">
              <div className="form-group">
                <label>Test Date After Repair</label>
                <input
                  type="date"
                  value={testData.testDateAfterRepair}
                  onChange={(e) => handleTestChange('testDateAfterRepair', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Test Time After Repair</label>
                <input
                  type="time"
                  value={testData.testTimeAfterRepair}
                  onChange={(e) => handleTestChange('testTimeAfterRepair', e.target.value)}
                />
              </div>

              {shouldShowField('firstCheck') && (
                <>
                  <div className="form-group">
                    <label>First Check Reading (PSI)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={testData.firstCheckReadingAfterRepair}
                      onChange={(e) => handleTestChange('firstCheckReadingAfterRepair', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>First Check Status</label>
                    <select
                      value={testData.firstCheckClosedTightAfterRepair}
                      onChange={(e) => handleTestChange('firstCheckClosedTightAfterRepair', e.target.value)}
                    >
                      <option value="Closed Tight">Closed Tight</option>
                      <option value="Leaked">Leaked</option>
                    </select>
                  </div>
                </>
              )}

              {shouldShowField('secondCheck') && (
                <>
                  <div className="form-group">
                    <label>Second Check Reading (PSI)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={testData.secondCheckReadingAfterRepair}
                      onChange={(e) => handleTestChange('secondCheckReadingAfterRepair', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Second Check Status</label>
                    <select
                      value={testData.secondCheckClosedTightAfterRepair}
                      onChange={(e) => handleTestChange('secondCheckClosedTightAfterRepair', e.target.value)}
                    >
                      <option value="Closed Tight">Closed Tight</option>
                      <option value="Leaked">Leaked</option>
                    </select>
                  </div>
                </>
              )}

              {shouldShowField('reliefValve') && (
                <div className="form-group">
                  <label>Relief Valve Reading (PSI)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={testData.reliefValveReadingAfterRepair}
                    onChange={(e) => handleTestChange('reliefValveReadingAfterRepair', e.target.value)}
                  />
                </div>
              )}

              {shouldShowField('typeIIBypass') && (
                <>
                  <div className="form-group">
                    <label>Type II Bypass Check Reading (PSI)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={testData.typeIIBypassCheckReadingAfterRepair}
                      onChange={(e) => handleTestChange('typeIIBypassCheckReadingAfterRepair', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Type II Bypass Status</label>
                    <select
                      value={testData.typeIIBypassClosedTightAfterRepair}
                      onChange={(e) => handleTestChange('typeIIBypassClosedTightAfterRepair', e.target.value)}
                    >
                      <option value="Closed Tight">Closed Tight</option>
                      <option value="Leaked">Leaked</option>
                    </select>
                  </div>
                </>
              )}

              {shouldShowField('airInlet') && (
                <div className="form-group">
                  <label>Air Inlet Reading (PSI)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={testData.airInletReadingAfterRepair}
                    onChange={(e) => handleTestChange('airInletReadingAfterRepair', e.target.value)}
                  />
                </div>
              )}

              {shouldShowField('checkValve') && (
                <div className="form-group">
                  <label>Check Valve Reading (PSI)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={testData.checkValveReadingAfterRepair}
                    onChange={(e) => handleTestChange('checkValveReadingAfterRepair', e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        <div className="form-section">
          <h4>Test Result</h4>
          <div className="form-grid">
            <div className="form-group">
              <label>Test Result *</label>
              <select
                value={testData.testResult}
                onChange={(e) => handleTestChange('testResult', e.target.value)}
                required
              >
                <option value="">Select Result</option>
                <option value="Passed">Passed</option>
                <option value="Failed">Failed</option>
              </select>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={testData.quoteNeeded}
                  onChange={(e) => handleTestChange('quoteNeeded', e.target.checked)}
                />
                {' '}Quote Needed
              </label>
            </div>

            <div className="form-group full-width">
              <label>Remarks</label>
              <textarea
                rows="3"
                value={testData.remarks}
                onChange={(e) => handleTestChange('remarks', e.target.value)}
                placeholder="Additional notes or observations..."
              />
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" onClick={onCancel} className="btn btn-secondary">
            Cancel
          </button>
          {device?.isNew && (
            <button type="button" onClick={() => setIsDeviceStep(true)} className="btn btn-secondary">
              Back to Device
            </button>
          )}
          <button type="submit" className="btn btn-primary">
            Save & Continue
          </button>
        </div>
      </form>
    </div>
  );
}
