import React from 'react';
import './DeviceList.css';

interface DeviceListProps {
  devices: any[];
  testRecords: Record<string, any>;
  onAddDevice: () => void;
  onEditDevice: (device: any) => void;
  onSelectDeviceForTest: (device: any) => void;
  onGeneratePDFs: () => void;
  canGenerate: boolean;
}

export default function DeviceList({
  devices,
  testRecords,
  onAddDevice,
  onEditDevice,
  onSelectDeviceForTest,
  onGeneratePDFs,
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

  return (
    <div className="device-list-container">
      <div className="device-list-header">
        <h3>Backflow Devices</h3>
        <div className="header-actions">
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
                </div>

                <div className="device-footer">
                  {status !== 'not-tested' && (
                    <span className={`status-badge status-${status}`}>{getStatusLabel(status)}</span>
                  )}
                  {testRecord?.quoteNeeded && <span className="quote-badge">Quote Needed</span>}
                </div>

                <div className="device-actions">
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={(e) => { e.stopPropagation(); onEditDevice(device); }}
                  >
                    Edit Device
                  </button>
                  <button
                    className="btn btn-sm btn-success"
                    onClick={(e) => { e.stopPropagation(); onSelectDeviceForTest(device); }}
                  >
                    Record Test
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
