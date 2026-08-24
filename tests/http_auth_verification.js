const http = require('http');

async function makeRequest(path, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode, headers: res.headers, body: json || data });
      });
    });

    req.on('error', (e) => reject(e));
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runHttpVerification() {
  console.log('--- Starting HTTP API Verification ---');

  const rand = Math.random().toString(36).substring(2, 8);
  const email = `test.http.${rand}@gmail.com`;

  // 1. Register with Gmail
  console.log('1. Testing POST /api/auth/register with Gmail...');
  const regRes = await makeRequest('/api/auth/register', 'POST', {
    name: 'HTTP Tester',
    email,
    password: 'Password123!',
  });
  console.log('Register Status:', regRes.status, 'Body:', regRes.body);
  if (regRes.status !== 201) throw new Error('Registration failed');

  const token = regRes.body.token;
  const verificationToken = regRes.body.verificationToken;
  const cookie = `skillswap_token=${token}`;

  // 2. Duplicate Registration attempt
  console.log('\n2. Testing duplicate registration rejection...');
  const dupRes = await makeRequest('/api/auth/register', 'POST', {
    name: 'Duplicate Tester',
    email: `  ${email.toUpperCase()}  `,
    password: 'Password123!',
  });
  console.log('Duplicate Status:', dupRes.status, 'Body:', dupRes.body);
  if (dupRes.status !== 409) throw new Error('Duplicate prevention failed');

  // 3. Verify Email with token
  console.log('\n3. Testing GET /api/auth/verify-email?token=...');
  const verifyRes = await makeRequest(`/api/auth/verify-email?token=${verificationToken}`, 'GET');
  console.log('Verify Status:', verifyRes.status, 'Body:', verifyRes.body);
  if (verifyRes.status !== 200 || !verifyRes.body.success) throw new Error('Email verification failed');

  // 4. Invalidate / Reused Token
  console.log('\n4. Testing reused token rejection...');
  const reuseRes = await makeRequest(`/api/auth/verify-email?token=${verificationToken}`, 'GET');
  console.log('Reused Token Status:', reuseRes.status, 'Body:', reuseRes.body);
  if (reuseRes.status !== 400) throw new Error('Reused token should be rejected with 400');

  // 5. Complete Onboarding
  console.log('\n5. Testing POST /api/auth/onboarding...');
  const onboardRes = await makeRequest('/api/auth/onboarding', 'POST', {
    userType: 'TEACHER_LEARNER',
    college: 'MIT',
    major: 'Computer Science',
    year: 'Junior',
    teachingPreference: 'Anyone',
    bio: 'Excited to learn and teach!',
  }, { Cookie: cookie });
  console.log('Onboarding Status:', onboardRes.status, 'Body:', onboardRes.body);
  if (onboardRes.status !== 200 || !onboardRes.body.success) throw new Error('Onboarding failed');

  // 6. Check Me endpoint
  console.log('\n6. Testing GET /api/auth/me...');
  const meRes = await makeRequest('/api/auth/me', 'GET', null, { Cookie: cookie });
  console.log('Me Status:', meRes.status, 'User:', meRes.body.user.email, 'Type:', meRes.body.user.user_type, 'Verified:', meRes.body.user.email_verified);
  if (meRes.body.user.user_type !== 'TEACHER_LEARNER' || !meRes.body.user.email_verified) {
    throw new Error('User profile fields mismatch');
  }

  // 7. Login with clean email & password (No role required)
  console.log('\n7. Testing POST /api/auth/login...');
  const loginRes = await makeRequest('/api/auth/login', 'POST', {
    email: email.toUpperCase(),
    password: 'Password123!',
  });
  console.log('Login Status:', loginRes.status, 'User Role:', loginRes.body.user.role, 'User Type:', loginRes.body.user.user_type);
  if (loginRes.status !== 200 || loginRes.body.user.role !== 'STUDENT') {
    throw new Error('Login failed');
  }

  console.log('\n--- ALL HTTP API TESTS PASSED SUCCESSFULLY! ---');
}

runHttpVerification().catch(e => {
  console.error('HTTP Verification Error:', e);
  process.exit(1);
});
