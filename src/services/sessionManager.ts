// src/services/sessionManager.ts - Consolidated Session Management
import type { Session, Technician, Company, SessionStatus } from '../types';

class SessionManager {
  private storageKey = 'titanpdf_technician_session';
  private maxSessionAge = 12 * 60 * 60 * 1000; // 12 hours — rolling window, resets on each use

  // ================== SESSION MANAGEMENT ==================

  setTechnicianSession(userData: { technician: Technician; company: Company; environment?: string }): boolean {
    try {
      const sessionData: Session = {
        technician: userData.technician,
        company: userData.company,
        environment: userData.environment,
        loginTime: Date.now(),
        userType: 'technician',
      };

      localStorage.setItem(this.storageKey, JSON.stringify(sessionData));
      console.log('✅ Technician session saved:', userData.technician.name);
      return true;
    } catch (error) {
      console.error('❌ Error saving technician session:', error);
      return false;
    }
  }

  getTechnicianSession(): Session | null {
    try {
      const sessionData = localStorage.getItem(this.storageKey);
      if (!sessionData) return null;

      const parsed: Session = JSON.parse(sessionData);

      if (this.isSessionExpired(parsed)) {
        console.log('⏰ Session expired, clearing...');
        this.clearTechnicianSession();
        return null;
      }

      // Rolling window — bump loginTime on each successful read
      parsed.loginTime = Date.now();
      localStorage.setItem(this.storageKey, JSON.stringify(parsed));

      return parsed;
    } catch (error) {
      console.error('❌ Error reading technician session:', error);
      this.clearTechnicianSession();
      return null;
    }
  }

  clearTechnicianSession(): boolean {
    try {
      localStorage.removeItem(this.storageKey);
      console.log('🧹 Technician session cleared');
      return true;
    } catch (error) {
      console.error('❌ Error clearing technician session:', error);
      return false;
    }
  }

  // ================== SESSION VALIDATION ==================

  isSessionExpired(sessionData: Session | null): boolean {
    if (!sessionData?.loginTime) return true;
    const sessionAge = Date.now() - sessionData.loginTime;
    return sessionAge > this.maxSessionAge;
  }

  isLoggedIn(): boolean {
    const session = this.getTechnicianSession();
    return !!(session?.technician?.id);
  }

  refreshSession(): boolean {
    const session = this.getTechnicianSession();
    if (session) {
      session.loginTime = Date.now();
      localStorage.setItem(this.storageKey, JSON.stringify(session));
      console.log('🔄 Session refreshed');
      return true;
    }
    return false;
  }

  // ================== GETTERS ==================

  getCurrentTechnician(): Technician | null {
    const session = this.getTechnicianSession();
    return session ? session.technician : null;
  }

  getCurrentCompany(): Company | null {
    const session = this.getTechnicianSession();
    return session ? session.company : null;
  }

  getTechnicianId(): number | null {
    const technician = this.getCurrentTechnician();
    return technician ? technician.id : null;
  }

  getTechnicianName(): string | null {
    const technician = this.getCurrentTechnician();
    return technician ? technician.name : null;
  }

  getCompanyName(): string | null {
    const company = this.getCurrentCompany();
    return company ? company.name : null;
  }

  // ================== DEBUGGING & UTILITIES ==================

  getSessionInfo(): Record<string, unknown> {
    const session = this.getTechnicianSession();

    if (!session) {
      return { loggedIn: false, message: 'No active session' };
    }

    const sessionAge = Date.now() - session.loginTime;
    const remainingTime = this.maxSessionAge - sessionAge;

    return {
      loggedIn: true,
      technicianName: session.technician.name,
      technicianId: session.technician.id,
      companyName: session.company.name,
      environment: session.environment,
      loginTime: new Date(session.loginTime).toLocaleString(),
      sessionAge: this.formatDuration(sessionAge),
      timeRemaining: remainingTime > 0 ? this.formatDuration(remainingTime) : 'Expired',
      isExpired: this.isSessionExpired(session),
    };
  }

  formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  getSessionStatus(): SessionStatus {
    const session = this.getTechnicianSession();

    if (!session) return { status: 'not_logged_in', message: 'Please log in' };

    const sessionAge = Date.now() - session.loginTime;
    const remainingTime = this.maxSessionAge - sessionAge;

    if (remainingTime <= 0) return { status: 'expired', message: 'Session has expired' };

    if (remainingTime < 30 * 60 * 1000) {
      return {
        status: 'expiring_soon',
        message: 'Session expires soon',
        timeRemaining: this.formatDuration(remainingTime),
      };
    }

    return {
      status: 'active',
      message: 'Session is active',
      timeRemaining: this.formatDuration(remainingTime),
    };
  }

  // ================== AUTO-LOGOUT FUNCTIONALITY ==================

  setupAutoLogout(callback: () => void): void {
    const session = this.getTechnicianSession();
    if (!session) return;

    const sessionAge = Date.now() - session.loginTime;
    const remainingTime = this.maxSessionAge - sessionAge;

    if (remainingTime <= 0) {
      callback();
      return;
    }

    setTimeout(() => {
      console.log('⏰ Auto-logout triggered');
      this.clearTechnicianSession();
      callback();
    }, remainingTime);

    console.log(`⏰ Auto-logout set for ${this.formatDuration(remainingTime)}`);
  }

  // ================== STORAGE UTILITIES ==================

  getRawSessionData(): string | null {
    try {
      return localStorage.getItem(this.storageKey);
    } catch (error) {
      console.error('❌ Error reading raw session data:', error);
      return null;
    }
  }

  isStorageAvailable(): boolean {
    try {
      const testKey = 'titanpdf_test';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  clearAllStorage(): boolean {
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('titanpdf_')) localStorage.removeItem(key);
      });
      console.log('🧹 All TitanPDF storage cleared');
      return true;
    } catch (error) {
      console.error('❌ Error clearing storage:', error);
      return false;
    }
  }
}

const sessionManager = new SessionManager();

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).sessionManager = sessionManager;
  const sessionInfo = sessionManager.getSessionInfo();
  if (sessionInfo.loggedIn) {
    console.log('🔧 Session Info:', sessionInfo);
  }
}

export default sessionManager;
