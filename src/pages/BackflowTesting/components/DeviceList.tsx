import React from 'react';
import './DeviceList.css';

interface DeviceListProps {
  devices: any[];
  testRecords: Record<string, any>;
  generatedPDFs: any[];
  onAddDevice: () => void;
  onEditDevice: (device: any) => void;
  onSelectDeviceForTest: (device: any) => void;
  onGeneratePDFs: () => void;
  onBack: () => void;
  canGenerate: boolean;
}

export default function DeviceList({
  devices,
  testRecords,
  generatedPDFs,
  onAddDevice,
  onEditDevice,
  onSelectDeviceForTest,
  onGeneratePDFs,
  onBack,
  canGenerate,
}: DeviceListProps) {
  const getDeviceStatus = (device: any): string => {
    const testRecord = testRecords[device.id];
    if (!testRecord?.testResult) return 'not-tested';
    return testRecord.testResult === 'Passed' ? 'passed' : 'failed';
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'passed': return '✓';
      case 'failed': return '✗';
      default: return '○';
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'passed': return 'Passed';
      case 'failed': return 'Failed';
      default: return 'Not Tested';
    }
  };

  const getLastTestedDate = (device: any): string | null => {
    const record = testRecords[device.id];
    if (!record?.testDateInitial) return null;
    return record.testDateInitial;
  };

  const getGeneratedPDF = (device: any): any | null => {
    return generatedPDFs.find((p: any) => p.deviceId === device.id) ?? null;
  };

  return (
    <div className="device-list-container">
      <div className="device-list-header">
        <h3>Backflow Devices</h3>
        <div className="header-actions">
          <button onClick={onBack} className="btn btn-secondary">← Back to Jobs</button>
          <button onClick={onAddDevice} className="btn btn-primary">+ Add Device</button>
        </div>
      </div>

      {devices.length === 0 ? (
        <div className="empty-state">
          <p>No devices added yet</p>
          <p className="empty-state-hint">Click "Add Device" to start testing</p>
        </div>
      ) : (
        <div className="devices-grid">
          {devices.map((device: any) => {
            const status = getDeviceStatus(device);
            const testRecord = testRecords[device.id];
            const lastTestedDate = getLastTestedDate(device);
            const generatedPDF = getGeneratedPDF(device);
            const isTested = status !== 'not-tested';

            return (
              <div key={device.id} className={`device-card device-${status}`}>
                <div className="device-header">
                  <span className={`status-icon status-${status}`}>{getStatusIcon(status)}</span>
                  <span className="device-type">{device.typeMain}</span>
                </div>

                <div className="device-info">
                  <div className="device-field">
                    <span className="field-label">Manufacturer:</span>
                    <span className="field-value">{device.manufacturerMain ?? 'N/A'}</span>
                  </div>
                  <div className="device-field">
                    <span className="field-label">Model:</span>
                    <span className="field-value">{device.modelMain ?? 'N/A'}</span>
                  </div>
                  <div className="device-field">
                    <span className="field-label">Serial:</span>
                    <span className="field-value">{device.serialMain ?? 'N/A'}</span>
                  </div>
                  <div className="device-field">
                    <span className="field-label">Size:</span>
                    <span className="field-value">{device.sizeMain ?? 'N/A'}</span>
                  </div>
                  <div className="device-field">
                    <span className="field-label">Location:</span>
                    <span className="field-value">{device.bpaLocation ?? 'N/A'}</span>
                  </div>
                  {lastTestedDate && (
                    <div className="device-field">
                      <span className="field-label">Last Tested:</span>
                      <span className="field-value tested-date">{lastTestedDate}</span>
                    </div>
                  )}
                </div>

                <div className="device-footer">
                  {status !== 'not-tested' && (
                    <span className={`status-badge status-${status}`}>{getStatusLabel(status)}</span>
                  )}
                  {testRecord?.quoteNeeded && <span className="quote-badge">Quote Needed</span>}
                  {generatedPDF && (
                    <a
                      href={`/api/backflow-pdfs/${generatedPDF.id}/download`}
                      download={generatedPDF.fileName}
                      className="download-badge"
                      onClick={(e) => e.stopPropagation()}
                    >
                      ↓ Download Form
                    </a>
                  )}
                </div>

                <div className="device-actions">
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={(e) => { e.stopPropagation(); onEditDevice(device); }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={(e) => { e.stopPropagation(); onSelectDeviceForTest(device); }}
                  >
                    {isTested ? 'Re-Test' : 'Record Test'}
                  </button>
                  {isTested && (
                    <button
                      className="btn btn-sm btn-success"
                      onClick={(e) => { e.stopPropagation(); onGeneratePDFs(); }}
                    >
                      Generate Form
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
