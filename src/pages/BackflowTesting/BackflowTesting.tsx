import React, { useState, useEffect } from 'react';
import './BackflowTesting.css';
import DeviceList from './components/DeviceList';
import TestForm from './components/TestForm';
import PhotoCapture from './components/PhotoCapture';
import PDFGenerator from './components/PDFGenerator';
import apiClient from '../../services/apiClient';
import type { Job, Technician } from '../../types';

interface BackflowTestingProps {
  job: Job;
  technician: Technician;
  onBack: () => void;
  onLogout: () => void;
}

interface Toast {
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function BackflowTesting({ job, technician, onBack, onLogout }: BackflowTestingProps) {
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState<string>('devices');
  const [testRecords, setTestRecords] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    const loadDevices = async () => {
      try {
        setLoading(true);
        const response = await apiClient.getJobBackflowDevices(job.id);
        setDevices((response.data as any[]) ?? []);

        const testsResponse = await apiClient.getJobBackflowTests(job.id);
        const testsMap: Record<string, any> = {};
        ((testsResponse.data as any[]) ?? []).forEach((test: any) => {
          testsMap[test.deviceId] = test;
        });
        setTestRecords(testsMap);
      } catch (err) {
        console.error('Error loading backflow devices:', err);
        setError('Failed to load backflow devices');
      } finally {
        setLoading(false);
      }
    };

    if (job) loadDevices();
  }, [job]);

  const showToast = (message: string, type: Toast['type'] = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddDevice = () => {
    setSelectedDevice({ isNew: true });
    setCurrentStep('addDevice');
  };

  const handleEditDevice = (device: any) => {
    setSelectedDevice(device);
    setCurrentStep('addDevice');
  };

  const handleSelectDeviceForTest = (device: any) => {
    setSelectedDevice(device);
    setCurrentStep('test');
  };

  const handleSaveDevice = async (deviceData: any) => {
    try {
      await saveDevice(deviceData);
    } catch (err) {
      console.error('Error saving device:', err);
      setError('Failed to save device');
      showToast('Failed to save device', 'error');
    }
  };

  const saveDevice = async (deviceData: any) => {
    let savedDevice: any;
    if (deviceData.isNew) {
      const response = await apiClient.createBackflowDevice(job.id, deviceData) as any;
      savedDevice = response.data;
      setDevices([...devices, savedDevice]);
      showToast('Device added successfully!', 'success');
    } else {
      const response = await apiClient.updateBackflowDevice(deviceData.id, deviceData) as any;
      savedDevice = response.data;
      setDevices(devices.map((d: any) => (d.id === savedDevice.id ? savedDevice : d)));
      showToast('Device updated successfully!', 'success');
    }
    setSelectedDevice(null);
    setCurrentStep('devices');
  };

  const handleSaveTest = async (testData: any) => {
    try {
      const response = await apiClient.saveBackflowTest({
        ...testData,
        deviceId: selectedDevice.id,
        jobId: job.id,
        technicianId: technician.id,
      }) as any;

      setTestRecords({ ...testRecords, [selectedDevice.id]: response.data });

      // Mark this job as tested today in localStorage so the Jobs page can show an indicator
      const today = new Date().toISOString().split('T')[0];
      const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      try {
        const raw = localStorage.getItem('mrbackflow_tested_today');
        const stored = raw ? JSON.parse(raw) : {};
        if (!stored[today]) stored[today] = {};
        stored[today][String(job.id)] = time;
        localStorage.setItem('mrbackflow_tested_today', JSON.stringify(stored));
      } catch { /* non-critical */ }

      showToast('Test recorded successfully!', 'success');
      setCurrentStep('photos');
    } catch (err) {
      console.error('Error saving test:', err);
      setError('Failed to save test data');
      showToast('Failed to save test data', 'error');
    }
  };

  const handlePhotosComplete = () => {
    showToast('Photos uploaded successfully!', 'success');
    setCurrentStep('devices');
    setSelectedDevice(null);
  };

  const handleGeneratePDFs = () => setCurrentStep('generate');

  const handleBackToDevices = () => {
    setCurrentStep('devices');
    setSelectedDevice(null);
  };

  const getCompletedDeviceCount = () =>
    devices.filter((d: any) => testRecords[d.id]?.testResult).length;

  const getFailedDevices = () =>
    devices.filter((d: any) => testRecords[d.id]?.testResult === 'Failed');

  return (
    <div className="backflow-testing-page">
      <div className="page-container">
        {loading ? (
          <div className="loading-container">
            <p>Loading backflow testing...</p>
          </div>
        ) : error ? (
          <div className="error-container">
            <p className="error-message">{error}</p>
            <button onClick={onBack} className="btn btn-secondary">Back to Job</button>
          </div>
        ) : (
          <>
            <div className="job-info-header">
              <h2>Backflow Testing - Job #{job.number}</h2>
              <p className="job-address">{(job as any).location?.address}</p>
              <div className="test-progress">
                <span className="progress-badge">
                  {getCompletedDeviceCount()} of {devices.length} devices tested
                </span>
                {getFailedDevices().length > 0 && (
                  <span className="failed-badge">{getFailedDevices().length} failed</span>
                )}
              </div>
            </div>

            {currentStep === 'devices' && (
              <DeviceList
                devices={devices}
                testRecords={testRecords}
                onAddDevice={handleAddDevice}
                onEditDevice={handleEditDevice}
                onSelectDeviceForTest={handleSelectDeviceForTest}
                onGeneratePDFs={handleGeneratePDFs}
                canGenerate={getCompletedDeviceCount() > 0}
              />
            )}

            {currentStep === 'addDevice' && (
              <TestForm
                device={selectedDevice}
                job={job}
                technician={technician}
                existingTest={null}
                onSave={handleSaveDevice}
                onCancel={handleBackToDevices}
                isDeviceOnly={true}
              />
            )}

            {currentStep === 'test' && (
              <TestForm
                device={selectedDevice}
                job={job}
                technician={technician}
                existingTest={testRecords[selectedDevice?.id]}
                onSave={handleSaveTest}
                onCancel={handleBackToDevices}
                isDeviceOnly={false}
              />
            )}

            {currentStep === 'photos' && (
              <PhotoCapture
                device={selectedDevice}
                testRecord={testRecords[selectedDevice?.id]}
                job={job}
                onComplete={handlePhotosComplete}
                onBack={handleBackToDevices}
              />
            )}

            {currentStep === 'generate' && (
              <PDFGenerator
                devices={devices}
                testRecords={testRecords}
                job={job}
                technician={technician}
                onBack={handleBackToDevices}
                onComplete={onBack}
              />
            )}
          </>
        )}
      </div>

      {toast && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px',
          backgroundColor: toast.type === 'success' ? '#10b981' : toast.type === 'error' ? '#ef4444' : '#3b82f6',
          color: 'white', padding: '1rem 1.5rem', borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 10000,
          animation: 'slideIn 0.3s ease-out', minWidth: '250px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.25rem' }}>
              {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'}
            </span>
            <span style={{ fontWeight: '500' }}>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
