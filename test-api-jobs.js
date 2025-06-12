// test-servicetitan-api.js
// Node.js script to test ServiceTitan Jobs API and see exact response format

require('dotenv').config();

const CLIENT_ID = process.env.REACT_APP_SERVICETITAN_CLIENT_ID;
const CLIENT_SECRET = process.env.REACT_APP_SERVICETITAN_CLIENT_SECRET;
const APP_KEY = process.env.REACT_APP_SERVICETITAN_APP_KEY;
const TENANT_ID = process.env.REACT_APP_SERVICETITAN_TENANT_ID;

async function testServiceTitanAPI() {
    console.log('🔧 Testing ServiceTitan Jobs API Response Format');
    console.log('==================================================');
    
    try {
        // Step 1: Get OAuth Token
        console.log('\n📡 Step 1: Getting OAuth Token...');
        
        const fetch = (await import('node-fetch')).default;
        
        const formData = new URLSearchParams();
        formData.append('grant_type', 'client_credentials');
        formData.append('client_id', CLIENT_ID);
        formData.append('client_secret', CLIENT_SECRET);

        const tokenResponse = await fetch('https://auth-integration.servicetitan.io/connect/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: formData
        });

        const tokenData = await tokenResponse.json();
        
        if (!tokenResponse.ok) {
            console.error('❌ Token Error:', tokenData);
            return;
        }
        
        console.log('✅ Got access token');
        const accessToken = tokenData.access_token;
        
        // Step 2: Get Technicians (to find a technician ID for testing)
        console.log('\n👥 Step 2: Getting Technicians...');
        
        const techsUrl = `https://api-integration.servicetitan.io/settings/v2/tenant/${TENANT_ID}/technicians?pageSize=5&active=true`;
        
        const techsResponse = await fetch(techsUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'ST-App-Key': APP_KEY,
                'Content-Type': 'application/json'
            }
        });

        const techsData = await techsResponse.json();
        
        if (!techsResponse.ok) {
            console.error('❌ Technicians Error:', techsData);
            return;
        }
        
        console.log('✅ Available Technicians:');
        techsData.data?.forEach((tech, index) => {
            console.log(`   ${index + 1}. ${tech.name} (ID: ${tech.id}, Login: ${tech.loginName || 'N/A'})`);
        });
        
        // Step 3: Get All Jobs (sample)
        console.log('\n📋 Step 3: Getting Sample Jobs...');
        
        const jobsUrl = `https://api-integration.servicetitan.io/jpm/v2/tenant/${TENANT_ID}/jobs?pageSize=3&modifiedOnOrAfter=2024-01-01T00:00:00Z`;
        
        const jobsResponse = await fetch(jobsUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'ST-App-Key': APP_KEY,
                'Content-Type': 'application/json'
            }
        });

        const jobsData = await jobsResponse.json();
        
        if (!jobsResponse.ok) {
            console.error('❌ Jobs Error:', jobsData);
            return;
        }
        
        console.log('✅ Sample Jobs Response Structure:');
        console.log('=====================================');
        console.log(JSON.stringify(jobsData, null, 2));
        
        // Step 4: Get Jobs for Specific Technician
        if (techsData.data && techsData.data.length > 0) {
            const testTechId = techsData.data[0].id;
            const testTechName = techsData.data[0].name;
            
            console.log(`\n👤 Step 4: Getting Jobs for Technician: ${testTechName} (ID: ${testTechId})`);
            
            const techJobsUrl = `https://api-integration.servicetitan.io/jpm/v2/tenant/${TENANT_ID}/jobs?pageSize=5&technicianIds=${testTechId}&modifiedOnOrAfter=2024-01-01T00:00:00Z`;
            
            const techJobsResponse = await fetch(techJobsUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'ST-App-Key': APP_KEY,
                    'Content-Type': 'application/json'
                }
            });

            const techJobsData = await techJobsResponse.json();
            
            if (!techJobsResponse.ok) {
                console.error('❌ Technician Jobs Error:', techJobsData);
                return;
            }
            
            console.log('✅ Technician Jobs Response:');
            console.log('============================');
            console.log(JSON.stringify(techJobsData, null, 2));
            
            // Analyze the structure
            if (techJobsData.data && techJobsData.data.length > 0) {
                console.log('\n🔍 Job Structure Analysis:');
                console.log('==========================');
                const firstJob = techJobsData.data[0];
                
                console.log('Job Keys:', Object.keys(firstJob));
                console.log('\nSample Job Data:');
                console.log('- ID:', firstJob.id);
                console.log('- Number:', firstJob.number);
                console.log('- Summary:', firstJob.summary);
                console.log('- Status:', firstJob.status);
                console.log('- Customer:', firstJob.customer?.name);
                console.log('- Location:', firstJob.location?.name || firstJob.location?.address);
                console.log('- Scheduled Date:', firstJob.scheduledDate);
                console.log('- Job Type:', firstJob.jobType?.name);
                console.log('- Business Unit:', firstJob.businessUnit?.name);
                console.log('- Appointments:', firstJob.appointments?.length || 0);
                
                if (firstJob.appointments && firstJob.appointments.length > 0) {
                    console.log('- Assigned Technicians:', firstJob.appointments[0].assignedTechnicians?.map(t => t.name));
                }
            }
        }
        
        console.log('\n🎉 Test Complete!');
        console.log('================');
        console.log('Use this data structure to fix your server transformation logic.');
        
    } catch (error) {
        console.error('❌ Test Failed:', error.message);
    }
}

// Check if required environment variables are set
if (!CLIENT_ID || !CLIENT_SECRET || !APP_KEY || !TENANT_ID) {
    console.error('❌ Missing required environment variables!');
    console.error('Make sure these are set in your .env file:');
    console.error('- REACT_APP_SERVICETITAN_CLIENT_ID');
    console.error('- REACT_APP_SERVICETITAN_CLIENT_SECRET');
    console.error('- REACT_APP_SERVICETITAN_APP_KEY');
    console.error('- REACT_APP_SERVICETITAN_TENANT_ID');
    process.exit(1);
}

// Run the test
testServiceTitanAPI();