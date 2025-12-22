import React, { useState, useEffect } from 'react';
import './BackflowTesting.css';
import Header from '../../components/Header/Header';
import DeviceList from './components/DeviceList';
import TestForm from './components/TestForm';
import PhotoCapture from './components/PhotoCapture';
import PDFGenerator from './components/PDFGenerator';
import apiClient from '../../services/apiClient';

export default function BackflowTesting({ job, technician, onBack, onLogout }) {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [currentStep, setCurrentStep] = useState('devices'); // 'devices', 'addDevice', 'test', 'photos', 'generate'
  const [testRecords, setTestRecords] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null); // { message, type: 'success' | 'error' | 'info' }

  // Load devices for this job
  useEffect(() => {
    const loadDevices = async () => {
      try {
        setLoading(true);
        const response = await apiClient.getJobBackflowDevices(job.id);
        setDevices(response.data || []);

        // Load existing test records
        const testsResponse = await apiClient.getJobBackflowTests(job.id);
        const testsMap = {};
        (testsResponse.data || []).forEach(test => {
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

    if (job) {
      loadDevices();
    }
  }, [job]);

  // Auto-capture GPS coordinates
  const captureGPSLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          return {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
        },
        (error) => {
          console.warn('GPS not available:', error);
          return null;
        }
      );
    }
    return null;
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddDevice = () => {
    setSelectedDevice({ isNew: true });
    setCurrentStep('addDevice');
  };

  const handleEditDevice = (device) => {
    setSelectedDevice(device);
    setCurrentStep('addDevice');
  };

  const handleSelectDeviceForTest = (device) => {
    setSelectedDevice(device);
    setCurrentStep('test');
  };

  const handleSaveDevice = async (deviceData) => {
    try {
      await saveDevice(deviceData);
    } catch (err) {
      console.error('Error saving device:', err);
      setError('Failed to save device');
      showToast('Failed to save device', 'error');
    }
  };

  const saveDevice = async (deviceData) => {
    let savedDevice;
    if (deviceData.isNew) {
      const response = await apiClient.createBackflowDevice(job.id, deviceData);
      savedDevice = response.data;
      setDevices([...devices, savedDevice]);
      showToast('Device added successfully!', 'success');
    } else {
      const response = await apiClient.updateBackflowDevice(deviceData.id, deviceData);
      savedDevice = response.data;
      setDevices(devices.map(d => d.id === savedDevice.id ? savedDevice : d));
      showToast('Device updated successfully!', 'success');
    }
    setSelectedDevice(null);
    setCurrentStep('devices'); // Return to device list
  };

  const handleSaveTest = async (testData) => {
    try {
      const response = await apiClient.saveBackflowTest({
        ...testData,
        deviceId: selectedDevice.id,
        jobId: job.id,
        technicianId: technician.id
      });

      setTestRecords({
        ...testRecords,
        [selectedDevice.id]: response.data
      });

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

  const handleGeneratePDFs = () => {
    setCurrentStep('generate');
  };

  const handleBackToDevices = () => {
    setCurrentStep('devices');
    setSelectedDevice(null);
  };

  const getCompletedDeviceCount = () => {
    return devices.filter(d => testRecords[d.id]?.testResult).length;
  };

  const getFailedDevices = () => {
    return devices.filter(d => testRecords[d.id]?.testResult === 'Failed');
  };

  // Create breadcrumbs for header
  const breadcrumbs = [
    { id: 'jobs', label: 'Jobs', active: false },
    { id: 'backflow-testing', label: `Backflow Testing - Job #${job?.number || 'Unknown'}`, active: true }
  ];

  return (
    <div className="backflow-testing-page">
      <Header
        user={technician}
        onLogout={onLogout}
        currentPage="backflow-testing"
        onNavigate={onBack}
        breadcrumbs={breadcrumbs}
      />

      <div className="page-container">
        {loading ? (
          <div className="loading-container">
            <p>Loading backflow testing...</p>
          </div>
        ) : error ? (
          <div className="error-container">
            <p className="error-message">{error}</p>
            <button onClick={onBack} className="btn btn-secondary">
              Back to Job
            </button>
          </div>
        ) : (
          <>
            {/* Job Information Header */}
            <div className="job-info-header">
              <h2>Backflow Testing - Job #{job.number}</h2>
              <p className="job-address">{job.location?.address}</p>
              <div className="test-progress">
                <span className="progress-badge">
                  {getCompletedDeviceCount()} of {devices.length} devices tested
                </span>
                {getFailedDevices().length > 0 && (
                  <span className="failed-badge">
                    {getFailedDevices().length} failed
                  </span>
                )}
              </div>
            </div>

            {/* Main Content Area */}
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

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: toast.type === 'success' ? '#10b981' : toast.type === 'error' ? '#ef4444' : '#3b82f6',
          color: 'white',
          padding: '1rem 1.5rem',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          zIndex: 10000,
          animation: 'slideIn 0.3s ease-out',
          minWidth: '250px',
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
