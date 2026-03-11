import React, { useState, useEffect } from 'react';
import './PhotoCapture.css';
import apiClient from '../../../services/apiClient';

interface SlotPhoto {
  photoId: string;
  previewUrl: string;
  uploaded: boolean;
  generatedFileName: string;
}

interface PhotoCaptureProps {
  device: any;
  testRecord: any;
  job: any;
  requiresIsolationValvePhoto: boolean;
  onComplete: () => void;
  onBack: () => void;
}

const BASE_REQUIRED_SLOTS = [
  { key: 'namePlate', label: 'Name Plate', description: 'Close-up of the device name plate' },
  { key: 'entireDevice', label: 'Entire Device', description: 'Full view of the device' },
  { key: 'surroundingArea', label: 'Surrounding Area', description: 'Context shot of the surrounding area' },
];

const ISOLATION_SLOT = {
  key: 'isolationValve',
  label: 'Isolation Valve Area',
  description: 'Photo showing the isolation valve area (required when repair needs water shutoff)',
};

const ALL_SLOT_KEYS = [...BASE_REQUIRED_SLOTS, ISOLATION_SLOT].map(s => s.key);

export default function PhotoCapture({ device, testRecord, job, requiresIsolationValvePhoto, onComplete, onBack }: PhotoCaptureProps) {
  const [slotPhotos, setSlotPhotos] = useState<Record<string, SlotPhoto | null>>({
    namePlate: null,
    entireDevice: null,
    surroundingArea: null,
    isolationValve: null,
  });
  const [extraPhotos, setExtraPhotos] = useState<any[]>([]);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [uploadingExtra, setUploadingExtra] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiredSlots = requiresIsolationValvePhoto
    ? [...BASE_REQUIRED_SLOTS, ISOLATION_SLOT]
    : BASE_REQUIRED_SLOTS;

  useEffect(() => {
    loadExistingPhotos();
  }, [testRecord]);

  const loadExistingPhotos = async () => {
    try {
      if (testRecord?.id) {
        const response = await apiClient.getBackflowTestPhotos(testRecord.id);
        const allPhotos = (response.data as any[]) ?? [];

        const newSlotPhotos: Record<string, SlotPhoto | null> = {
          namePlate: null,
          entireDevice: null,
          surroundingArea: null,
          isolationValve: null,
        };
        const newExtraPhotos: any[] = [];

        for (const photo of allPhotos) {
          const label = photo.photoLabel;
          if (label && ALL_SLOT_KEYS.includes(label)) {
            newSlotPhotos[label] = {
              photoId: photo.id,
              previewUrl: '',
              uploaded: true,
              generatedFileName: photo.generatedFileName,
            };
          } else {
            newExtraPhotos.push(photo);
          }
        }

        setSlotPhotos(newSlotPhotos);
        setExtraPhotos(newExtraPhotos);
      }
    } catch (err) {
      console.error('Error loading photos:', err);
    }
  };

  const generateFileName = (file: File, slotLabel?: string): string => {
    const extension = file.name.split('.').pop();
    const isFailed = testRecord.testResult === 'Failed';
    const serial = device.serialMain;
    const prefix = isFailed ? `Failed-SN-${serial}` : `SN-${serial}`;
    const labelPart = slotLabel ? `-${slotLabel.replace(/\s+/g, '-')}` : '';
    return `${prefix}${labelPart}.${extension}`;
  };

  const handleSlotFileSelect = async (slotKey: string, slotLabel: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingSlot(slotKey);
    setError(null);

    const previewUrl = URL.createObjectURL(file);
    try {
      const generatedName = generateFileName(file, slotLabel);
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('testRecordId', testRecord.id);
      formData.append('deviceId', device.id);
      formData.append('jobId', job.id);
      formData.append('generatedFileName', generatedName);
      formData.append('isFailedPhoto', String(testRecord.testResult === 'Failed'));
      formData.append('photoLabel', slotKey);

      const response = await apiClient.uploadBackflowPhoto(formData) as any;
      setSlotPhotos(prev => ({
        ...prev,
        [slotKey]: {
          photoId: response.data.id,
          previewUrl,
          uploaded: true,
          generatedFileName: generatedName,
        },
      }));
    } catch (err) {
      console.error('Error uploading photo:', err);
      setError('Failed to upload photo. Please try again.');
      URL.revokeObjectURL(previewUrl);
    } finally {
      setUploadingSlot(null);
      e.target.value = '';
    }
  };

  const handleExtraFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setUploadingExtra(true);
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
        formData.append('photoLabel', '');

        const response = await apiClient.uploadBackflowPhoto(formData) as any;
        setExtraPhotos(prev => [...prev, response.data]);
      }
    } catch (err) {
      console.error('Error uploading photo:', err);
      setError('Failed to upload photo. Please try again.');
    } finally {
      setUploadingExtra(false);
    }
  };

  const handleDeleteSlotPhoto = async (slotKey: string) => {
    const photo = slotPhotos[slotKey];
    if (!photo) return;
    try {
      await apiClient.deleteBackflowPhoto(photo.photoId);
      if (photo.previewUrl) URL.revokeObjectURL(photo.previewUrl);
      setSlotPhotos(prev => ({ ...prev, [slotKey]: null }));
    } catch (err) {
      console.error('Error deleting photo:', err);
      setError('Failed to delete photo');
    }
  };

  const handleDeleteExtraPhoto = async (photoId: string) => {
    if (!window.confirm('Are you sure you want to delete this photo?')) return;
    try {
      await apiClient.deleteBackflowPhoto(photoId);
      setExtraPhotos(extraPhotos.filter((p: any) => p.id !== photoId));
    } catch (err) {
      console.error('Error deleting photo:', err);
      setError('Failed to delete photo');
    }
  };

  const allRequiredSlotsFilled = requiredSlots.every(slot => slotPhotos[slot.key] !== null);

  const handleSkip = () => {
    if (!allRequiredSlotsFilled) {
      const confirmed = window.confirm(
        'Required photos are not complete. Are you sure you want to skip?\n\nMinimum required photos have not been uploaded.'
      );
      if (!confirmed) return;
    }
    onComplete();
  };

  return (
    <div className="photo-capture-container">
      <div className="photo-header">
        <h3>Add Photos — {device.typeMain} (SN: {device.serialMain})</h3>
        <p className="photo-hint">
          {requiredSlots.length} required photo{requiredSlots.length !== 1 ? 's' : ''} must be uploaded before completing
        </p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="required-slots-section">
        <h4 className="slots-header">Required Photos</h4>
        <div className="slots-grid">
          {requiredSlots.map(slot => {
            const slotPhoto = slotPhotos[slot.key];
            const isUploading = uploadingSlot === slot.key;

            return (
              <div key={slot.key} className={`photo-slot ${slotPhoto ? 'slot-filled' : 'slot-empty'}`}>
                <div className="slot-label">{slot.label}</div>
                <div className="slot-description">{slot.description}</div>
                <div className="slot-preview">
                  {slotPhoto ? (
                    <>
                      {slotPhoto.previewUrl ? (
                        <img src={slotPhoto.previewUrl} alt={slot.label} className="slot-thumbnail" />
                      ) : (
                        <div className="slot-placeholder slot-uploaded">
                          <span className="slot-check-icon">✓</span>
                          <span className="slot-filename">{slotPhoto.generatedFileName}</span>
                        </div>
                      )}
                      <button
                        className="btn-delete-slot"
                        onClick={() => handleDeleteSlotPhoto(slot.key)}
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <div className="slot-placeholder">
                      <span className="slot-camera">📷</span>
                      <label
                        htmlFor={`slot-upload-${slot.key}`}
                        className={`slot-upload-btn ${isUploading ? 'uploading' : ''}`}
                      >
                        {isUploading ? 'Uploading...' : 'Upload Photo'}
                      </label>
                      <input
                        id={`slot-upload-${slot.key}`}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleSlotFileSelect(slot.key, slot.label, e)}
                        disabled={isUploading || uploadingSlot !== null}
                        style={{ display: 'none' }}
                      />
                    </div>
                  )}
                </div>
                {slotPhoto && <span className="slot-done-label">✓ Uploaded</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="extra-photos-section">
        <h4 className="slots-header">Additional Photos <span className="optional-label">(Optional)</span></h4>
        <div className="upload-section">
          <label htmlFor="extra-photo-upload" className="upload-button">
            <span>{uploadingExtra ? 'Uploading...' : '+ Add Photos'}</span>
          </label>
          <input
            id="extra-photo-upload"
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleExtraFileSelect}
            disabled={uploadingExtra}
            style={{ display: 'none' }}
          />
        </div>
        {extraPhotos.length > 0 && (
          <div className="photos-grid">
            {extraPhotos.map((photo: any, index: number) => (
              <div key={photo.id ?? index} className="photo-card">
                <div className="photo-preview">
                  <div className="photo-placeholder">
                    <span>📷</span>
                    {photo.uploadedToServiceTitan && <span className="uploaded-badge">✓ Uploaded</span>}
                  </div>
                </div>
                <div className="photo-info">
                  <p className="photo-name">{photo.generatedFileName}</p>
                  <button onClick={() => handleDeleteExtraPhoto(photo.id)} className="btn-delete-photo">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="photo-actions">
        <button onClick={onBack} className="btn btn-secondary">Back</button>
        <div className="right-actions">
          <button onClick={handleSkip} className="btn btn-secondary">Skip Photos</button>
          <button
            onClick={onComplete}
            className="btn btn-primary"
            disabled={!allRequiredSlotsFilled}
            title={!allRequiredSlotsFilled ? 'Upload all required photos to complete' : ''}
          >
            Complete Photos
          </button>
        </div>
      </div>
    </div>
  );
}
