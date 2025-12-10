import React, { useState, useEffect } from 'react';
import './BackflowTesting.css';
import Header from '../../components/Header/Header';
import Footer from '../../components/Footer/Footer';
import DeviceList from './components/DeviceList';
import TestForm from './components/TestForm';
import PhotoCapture from './components/PhotoCapture';
import PDFGenerator from './components/PDFGenerator';
import apiClient from '../../services/apiClient';

export default function BackflowTesting({ job, technician, onBack, onLogout }) {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [currentStep, setCurrentStep] = useState('devices'); // 'devices', 'test', 'photos', 'generate'
  const [testRecords, setTestRecords] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const handleAddDevice = () => {
    setSelectedDevice({ isNew: true });
    setCurrentStep('test');
  };

  const handleEditDevice = (device) => {
    setSelectedDevice(device);
    setCurrentStep('test');
  };

  const handleSaveDevice = async (deviceData) => {
    try {
      let savedDevice;
      if (deviceData.isNew) {
        const response = await apiClient.createBackflowDevice(job.id, deviceData);
        savedDevice = response.data;
        setDevices([...devices, savedDevice]);
      } else {
        const response = await apiClient.updateBackflowDevice(deviceData.id, deviceData);
        savedDevice = response.data;
        setDevices(devices.map(d => d.id === savedDevice.id ? savedDevice : d));
      }
      setSelectedDevice(savedDevice);
      setCurrentStep('test');
    } catch (err) {
      console.error('Error saving device:', err);
      setError('Failed to save device');
    }
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

      setCurrentStep('photos');
    } catch (err) {
      console.error('Error saving test:', err);
      setError('Failed to save test data');
    }
  };

  const handlePhotosComplete = () => {
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

  return (
    <div className="backflow-testing-page">
      <Header
        currentPage="Backflow Testing"
        technicianName={technician?.name}
        onBack={onBack}
        onLogout={onLogout}
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
                onGeneratePDFs={handleGeneratePDFs}
                canGenerate={getCompletedDeviceCount() > 0}
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

      <Footer />
    </div>
  );
}
