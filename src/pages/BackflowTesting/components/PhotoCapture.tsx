import React, { useState, useEffect } from 'react';
import './PhotoCapture.css';
import apiClient from '../../../services/apiClient';

interface PhotoCaptureProps {
  device: any;
  testRecord: any;
  job: any;
  onComplete: () => void;
  onBack: () => void;
}

export default function PhotoCapture({ device, testRecord, job, onComplete, onBack }: PhotoCaptureProps) {
  const [photos, setPhotos] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadExistingPhotos();
  }, [testRecord]);

  const loadExistingPhotos = async () => {
    try {
      if (testRecord?.id) {
        const response = await apiClient.getBackflowTestPhotos(testRecord.id);
        setPhotos((response.data as any[]) ?? []);
      }
    } catch (err) {
      console.error('Error loading photos:', err);
    }
  };

  const generateFileName = (file: File): string => {
    const extension = file.name.split('.').pop();
    const isFailed = testRecord.testResult === 'Failed';
    const serial = device.serialMain;
    return isFailed ? `Failed-SN-${serial}.${extension}` : `SN-${serial}.${extension}`;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      for (const file of files) {
        const generatedName = generateFileName(file);
        const formData = new FormData();
        formData.append('photo', file);
        formData.append('testRecordId', testRecord.id);
        formData.append('deviceId', device.id);
        formData.append('jobId', job.id);
        formData.append('generatedFileName', generatedName);
        formData.append('isFailedPhoto', String(testRecord.testResult === 'Failed'));

        const response = await apiClient.uploadBackflowPhoto(formData) as any;
        setPhotos((prev) => [...prev, response.data]);
      }
    } catch (err) {
      console.error('Error uploading photo:', err);
      setError('Failed to upload photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!window.confirm('Are you sure you want to delete this photo?')) return;
    try {
      await apiClient.deleteBackflowPhoto(photoId);
      setPhotos(photos.filter((p: any) => p.id !== photoId));
    } catch (err) {
      console.error('Error deleting photo:', err);
      setError('Failed to delete photo');
    }
  };

  return (
    <div className="photo-capture-container">
      <div className="photo-header">
        <h3>Add Photos - {device.typeMain} (SN: {device.serialMain})</h3>
        <p className="photo-hint">
          {testRecord.testResult === 'Failed'
            ? 'Photos will be named with "Failed-" prefix'
            : 'Photos will be named with device serial number'}
        </p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="upload-section">
        <label htmlFor="photo-upload" className="upload-button">
          <span>{uploading ? 'Uploading...' : '+ Add Photos'}</span>
        </label>
        <input
          id="photo-upload"
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleFileSelect}
          disabled={uploading}
          style={{ display: 'none' }}
        />
      </div>

      <div className="photos-grid">
        {photos.length === 0 ? (
          <div className="empty-photos">
            <p>No photos added yet</p>
            <p className="empty-hint">You can add photos now or skip this step</p>
          </div>
        ) : (
          photos.map((photo: any, index: number) => (
            <div key={photo.id ?? index} className="photo-card">
              <div className="photo-preview">
                <div className="photo-placeholder">
                  <span>📷</span>
                  {photo.uploadedToServiceTitan && <span className="uploaded-badge">✓ Uploaded</span>}
                </div>
              </div>
              <div className="photo-info">
                <p className="photo-name">{photo.generatedFileName}</p>
                <button onClick={() => handleDeletePhoto(photo.id)} className="btn-delete-photo">
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="photo-actions">
        <button onClick={onBack} className="btn btn-secondary">Back</button>
        <div className="right-actions">
          <button onClick={onComplete} className="btn btn-secondary">Skip Photos</button>
          <button onClick={onComplete} className="btn btn-primary">Done</button>
        </div>
      </div>
    </div>
  );
}
