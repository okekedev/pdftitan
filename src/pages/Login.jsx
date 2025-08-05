// src/pages/Login.jsx - Fixed server port reference
import React, { useState, useEffect } from "react";
import apiClient from "../services/apiClient";

export default function Login({ onLogin }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  // Test server connection on mount
  useEffect(() => {
    const testConnection = async () => {
      try {
        const connectionTest = await apiClient.testConnection();
        if (!connectionTest.connected) {
          console.warn(
            "⚠️ Server connection test failed:",
            connectionTest.error
          );
        } else {
          console.log("✅ Server connection successful");
        }
      } catch (error) {
        console.warn("⚠️ Could not test server connection:", error);
      }
    };

    testConnection();
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !phoneNumber.trim()) {
      setError("Please enter both your username and phone number");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      console.log("👤 Authenticating technician...");

      const result = await apiClient.validateTechnician(username, phoneNumber);

      if (result.success) {
        console.log("✅ Technician authenticated:", result.technician.name);

        const userData = {
          technician: result.technician,
          company: result.company,
          environment: result.environment,
          loginTime: Date.now(),
          userType: "technician",
        };

        onLogin(userData);
      } else {
        setError(result.error || "Authentication failed");
      }
    } catch (error) {
      console.error("❌ Authentication error:", error);

      // Enhanced error handling with user-friendly messages
      if (error.message.includes("No technician found")) {
        setError(
          `Technician "${username}" not found. Please check your username.`
        );
      } else if (error.message.includes("Phone number does not match")) {
        setError(
          "Phone number does not match our records for this technician."
        );
      } else if (error.message.includes("ServiceTitan authentication failed")) {
        setError(
          "Failed to connect to ServiceTitan API. Please try again later."
        );
      } else if (error.message.includes("404")) {
        setError(
          "Server endpoint not found. Please make sure the server is running."
        );
      } else if (error.message.includes("timeout")) {
        setError("Connection timeout. Please try again.");
      } else if (error.message.includes("connect")) {
        // ✅ FIXED: Updated port to match your server
        setError(
          "Cannot connect to server. Make sure the server is running on localhost:3004"
        );
      } else {
        setError(error.message || "An unexpected error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !isLoading) {
      handleLogin();
    }
  };

  return (
    <div className="login-screen">
      <div className="login-container">
        <div className="login-card card">
          {/* Header */}
          <div className="login-header">
            <div className="logo-section">
              <span className="logo-icon"></span>
              <img
                src="/web-app-manifest-192x192.png"
                alt="1-A Services"
                className="logo-image"
                style={{
                  height: "150px",
                  width: "auto",
                  marginRight: "1rem",
                }}
              ></img>
            </div>
            <p className="login-subtitle">PDF Editor</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="alert alert-error">
              <span>⚠️</span>
              <div>
                <strong>Authentication Error</strong>
                <p>{error}</p>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form className="login-form" onSubmit={(e) => e.preventDefault()}>
            <div className="form-group">
              <label htmlFor="username" className="form-label">
                Username
              </label>
              <input
                type="text"
                id="username"
                className="form-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder=""
                disabled={isLoading}
                onKeyPress={handleKeyPress}
                autoComplete="username"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="phoneNumber" className="form-label">
                Phone Number
              </label>
              <input
                type="tel"
                id="phoneNumber"
                className="form-input"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder=""
                disabled={isLoading}
                onKeyPress={handleKeyPress}
                autoComplete="tel"
              />
            </div>

            <button
              type="button"
              className={`btn btn-lg login-btn ${isLoading ? "loading" : ""}`}
              disabled={isLoading || !username.trim() || !phoneNumber.trim()}
              onClick={handleLogin}
            >
              {isLoading ? (
                <>
                  <div className="button-spinner"></div>
                  Authenticating...
                </>
              ) : (
                <>Login</>
              )}
            </button>
          </form>

          {/* Footer
          <div className="login-footer">
            <p className="text-center text-gray-600">
              Enter your ServiceTitan technician credentials to access your jobs
            </p>
            <p className="text-center text-xs text-gray-500 mt-2">
              Only technicians can access this portal
            </p>
            
            {process.env.NODE_ENV === 'development' && (
              <div className="debug-info">
                <p className="text-xs text-gray-500">
                  <strong>Debug Mode:</strong> Development Environment
                </p>
                <p className="text-xs text-gray-500">
                  Test technicians: davehofmann, John_cox
                </p>
              </div>
            )}
          </div> */}
        </div>
      </div>
    </div>
  );
}

// Additional Login-specific styles (keep minimal since we're using global styles)
