// src/components/Debug/ApiDebug.js - Test API responses
import React, { useState } from 'react';
import apiClient from '../../services/apiClient';
import sessionManager from '../../services/sessionManger';

function ApiDebug() {
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState({});
  const [error, setError] = useState({});

  // Test functions
  const tests = [
    {
      id: 'health',
      name: 'Health Check',
      description: 'Test server health endpoint',
      action: async () => {
        const response = await apiClient.getHealth();
        return { response, formatted: JSON.stringify(response, null, 2) };
      }
    },
    {
      id: 'connection',
      name: 'Connection Test',
      description: 'Test server connection',
      action: async () => {
        const response = await apiClient.testConnection();
        return { response, formatted: JSON.stringify(response, null, 2) };
      }
    },
    {
      id: 'session',
      name: 'Session Info',
      description: 'Check current session data',
      action: async () => {
        const sessionInfo = sessionManager.getSessionInfo();
        const session = sessionManager.getTechnicianSession();
        const validation = sessionManager.validateSession();
        
        return { 
          response: { sessionInfo, session, validation }, 
          formatted: JSON.stringify({ sessionInfo, session, validation }, null, 2) 
        };
      }
    },
    {
      id: 'validateTech',
      name: 'Validate Technician',
      description: 'Test technician validation (needs username/phone)',
      action: async () => {
        // Use test credentials
        const username = 'davehofmann';
        const phone = '1234567890';
        
        console.log(`🧪 Testing validation with: ${username} / ${phone}`);
        const response = await apiClient.validateTechnician(username, phone);
        return { response, formatted: JSON.stringify(response, null, 2) };
      }
    },
    {
      id: 'myJobs',
      name: 'Get My Jobs',
      description: 'Get jobs for current technician',
      action: async () => {
        const response = await apiClient.getMyJobs('recent');
        return { 
          response, 
          formatted: JSON.stringify(response, null, 2),
          summary: `Found ${response?.length || 0} jobs`
        };
      }
    },
    {
      id: 'jobStatuses',
      name: 'Debug Job Statuses',
      description: 'Get all possible job statuses',
      action: async () => {
        const response = await apiClient.getJobStatuses();
        return { response, formatted: JSON.stringify(response, null, 2) };
      }
    },
    {
      id: 'directApi',
      name: 'Direct API Call',
      description: 'Raw API call to technician jobs endpoint',
      action: async () => {
        const session = sessionManager.getTechnicianSession();
        if (!session?.technician?.id) {
          throw new Error('No technician session found');
        }
        
        const response = await apiClient.apiCall(`/api/technician/${session.technician.id}/jobs?dateFilter=recent`);
        
        // 🔍 DEBUG: Print to console for easy copying
        console.log('🔍 DEBUG: Full API Response:');
        console.log('Raw response:', response);
        if (response.data && response.data.length > 0) {
          console.log('🔍 DEBUG: First job from API:');
          console.log(JSON.stringify(response.data[0], null, 2));
        }
        
        return { 
          response, 
          formatted: JSON.stringify(response, null, 2),
          summary: `Raw response with ${response?.data?.length || 0} jobs`
        };
      }
    },
    {
      id: 'sampleJob',
      name: 'Sample Job Analysis',
      description: 'Detailed analysis of first job data',
      action: async () => {
        const jobs = await apiClient.getMyJobs('recent');
        if (jobs.length === 0) {
          throw new Error('No jobs found to analyze');
        }
        
        const firstJob = jobs[0];
        console.log('🔍 DEBUG: Sample job analysis:');
        console.log('Job object:', firstJob);
        
        // Analyze the job structure
        const analysis = {
          originalJob: firstJob,
          fieldAnalysis: {
            id: { value: firstJob.id, type: typeof firstJob.id },
            number: { value: firstJob.number, type: typeof firstJob.number },
            title: { value: firstJob.title, type: typeof firstJob.title },
            status: { value: firstJob.status, type: typeof firstJob.status },
            customer: { value: firstJob.customer, type: typeof firstJob.customer },
            location: { value: firstJob.location, type: typeof firstJob.location },
            scheduledDate: { value: firstJob.scheduledDate, type: typeof firstJob.scheduledDate },
            jobType: { value: firstJob.jobType, type: typeof firstJob.jobType },
            businessUnit: { value: firstJob.businessUnit, type: typeof firstJob.businessUnit }
          },
          allFields: Object.keys(firstJob),
          jobCount: jobs.length
        };
        
        return { 
          response: analysis, 
          formatted: JSON.stringify(analysis, null, 2),
          summary: `Analyzed job: ${firstJob.number} - ${firstJob.title}`
        };
      }
    }
  ];

  const runTest = async (test) => {
    const testId = test.id;
    setLoading(prev => ({ ...prev, [testId]: true }));
    setError(prev => ({ ...prev, [testId]: null }));
    
    try {
      console.log(`🧪 Running test: ${test.name}`);
      const result = await test.action();
      setResults(prev => ({ ...prev, [testId]: result }));
      console.log(`✅ Test completed: ${test.name}`, result.response);
    } catch (err) {
      console.error(`❌ Test failed: ${test.name}`, err);
      setError(prev => ({ ...prev, [testId]: err.message }));
    } finally {
      setLoading(prev => ({ ...prev, [testId]: false }));
    }
  };

  const runAllTests = async () => {
    for (const test of tests) {
      await runTest(test);
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const clearResults = () => {
    setResults({});
    setError({});
  };

  return (
    <div style={{ 
      padding: '2rem', 
      maxWidth: '1200px', 
      margin: '0 auto',
      fontFamily: 'monospace'
    }}>
      <h1 style={{ color: '#333', marginBottom: '2rem' }}>🧪 TitanPDF API Debug Console</h1>
      
      <div style={{ 
        display: 'flex', 
        gap: '1rem', 
        marginBottom: '2rem',
        flexWrap: 'wrap'
      }}>
        <button 
          onClick={runAllTests}
          style={{
            background: '#2ecc71',
            color: 'white',
            border: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          🚀 Run All Tests
        </button>
        
        <button 
          onClick={clearResults}
          style={{
            background: '#6c757d',
            color: 'white',
            border: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          🗑️ Clear Results
        </button>
      </div>

      <div style={{ display: 'grid', gap: '2rem' }}>
        {tests.map(test => (
          <div 
            key={test.id}
            style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '1.5rem',
              background: '#fff'
            }}
          >
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'flex-start',
              marginBottom: '1rem'
            }}>
              <div>
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>
                  {test.name}
                </h3>
                <p style={{ margin: '0', color: '#666', fontSize: '0.9rem' }}>
                  {test.description}
                </p>
              </div>
              
              <button 
                onClick={() => runTest(test)}
                disabled={loading[test.id]}
                style={{
                  background: loading[test.id] ? '#95a5a6' : '#3498db',
                  color: 'white',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '4px',
                  cursor: loading[test.id] ? 'not-allowed' : 'pointer',
                  minWidth: '80px'
                }}
              >
                {loading[test.id] ? '⏳' : '▶️ Run'}
              </button>
            </div>

            {error[test.id] && (
              <div style={{
                background: '#ffebee',
                color: '#c62828',
                padding: '1rem',
                borderRadius: '4px',
                marginBottom: '1rem',
                fontSize: '0.9rem'
              }}>
                <strong>❌ Error:</strong> {error[test.id]}
              </div>
            )}

            {results[test.id] && (
              <div>
                {results[test.id].summary && (
                  <div style={{
                    background: '#e8f5e8',
                    color: '#2ecc71',
                    padding: '0.75rem',
                    borderRadius: '4px',
                    marginBottom: '1rem',
                    fontSize: '0.9rem',
                    fontWeight: '600'
                  }}>
                    ✅ {results[test.id].summary}
                  </div>
                )}
                
                <details>
                  <summary style={{ 
                    cursor: 'pointer', 
                    fontWeight: '600',
                    marginBottom: '1rem',
                    color: '#333'
                  }}>
                    📄 View Response Data
                  </summary>
                  
                  <pre style={{
                    background: '#f8f9fa',
                    padding: '1rem',
                    borderRadius: '4px',
                    overflow: 'auto',
                    fontSize: '0.8rem',
                    lineHeight: '1.4',
                    border: '1px solid #e9ecef',
                    maxHeight: '400px'
                  }}>
                    {results[test.id].formatted}
                  </pre>
                </details>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{
        marginTop: '3rem',
        padding: '1.5rem',
        background: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #e9ecef'
      }}>
        <h3 style={{ margin: '0 0 1rem 0', color: '#333' }}>📋 Testing Instructions</h3>
        <ol style={{ margin: '0', paddingLeft: '1.5rem', lineHeight: '1.6' }}>
          <li><strong>Health Check:</strong> Verify server is running</li>
          <li><strong>Validate Technician:</strong> Test login with test credentials</li>
          <li><strong>Session Info:</strong> Check if you're logged in and session data</li>
          <li><strong>Get My Jobs:</strong> Fetch jobs for logged-in technician</li>
          <li><strong>Debug Job Statuses:</strong> See all possible job statuses in your system</li>
          <li><strong>Direct API Call:</strong> Raw API response from server</li>
        </ol>
        
        <div style={{ 
          marginTop: '1rem', 
          padding: '1rem', 
          background: '#fff3e0',
          borderRadius: '4px',
          fontSize: '0.9rem'
        }}>
          <strong>💡 Tip:</strong> Run tests in order. If "Validate Technician" succeeds, 
          you'll be logged in and can test the jobs endpoints.
        </div>
      </div>
    </div>
  );
}

export default ApiDebug;