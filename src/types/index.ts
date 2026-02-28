// src/types/index.ts - Shared TypeScript interfaces for TitanPDF

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  fullAddress?: string;
}

export interface Customer {
  id: number;
  name: string;
  address?: Address;
  phone?: string;
  email?: string;
}

export interface Location {
  id?: number;
  name?: string;
  address?: Address;
}

export interface Appointment {
  id?: number;
  start?: string;
  end?: string;
  status?: string;
}

export interface Job {
  id: number;
  number: string;
  title: string;
  status: string;
  priority?: string;
  customer?: Customer;
  location?: Location;
  nextAppointment?: Appointment;
}

export interface TechnicianGauge {
  type: 'Potable' | 'Non-potable';
  makeModel: string;
  serialNumber: string;
  dateTestedForAccuracy: string;
  accuracyExpiration: string;
}

export interface Technician {
  id: number;
  name: string;
  username: string;
  phone?: string;
  email?: string;
  bpatLicenseNumber?: string;
  licenseIssueDate?: string;
  licenseExpirationDate?: string;
  gauges?: TechnicianGauge[];
}

export interface Company {
  id?: number;
  name: string;
}

export interface Session {
  technician: Technician;
  company: Company;
  environment?: string;
  loginTime: number;
  userType: string;
}

export type PDFElementType = 'text' | 'signature' | 'date' | 'checkbox';

export interface PDFElement {
  id: string;
  type: PDFElementType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  value?: string;
  page?: number;
}

export interface Attachment {
  id: number | string;
  name: string;
  type?: string;
  url?: string;
  serviceTitanId?: string | number;
  googleDriveFileId?: string;
}

export interface Draft {
  id: string;
  name: string;
  status: 'draft' | 'completed';
  jobId?: string | number;
  createdAt?: string;
  updatedAt?: string;
  googleDriveFileId?: string;
}

export interface Breadcrumb {
  id: string;
  label: string;
  active: boolean;
}

export interface SessionStatus {
  status: 'not_logged_in' | 'expired' | 'expiring_soon' | 'active';
  message: string;
  timeRemaining?: string;
}
