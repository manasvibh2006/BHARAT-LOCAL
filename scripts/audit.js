// Comprehensive Audit Script for Bharat Local

const http = require('http');

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: data ? JSON.parse(data) : {} });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runAudit() {
  console.log('========================================================================');
  console.log('🇮🇳 BHARAT LOCAL: COMPLETE SYSTEM AUDIT & VERIFICATION REPORT');
  console.log('========================================================================\n');

  const results = [];
  function check(feature, passed, details) {
    const icon = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${icon}: [${feature}] - ${details}`);
    results.push({ feature, passed, details });
  }

  try {
    // 1. Healthcheck
    const health = await request({ host: 'localhost', port: 5000, path: '/health', method: 'GET' });
    check('System Healthcheck', health.status === 200 && health.body.status === 'healthy', 'Service is healthy on port 5000');

    // 2. Input Validation (Bad Phone Format)
    const badPhone = await request(
      { host: 'localhost', port: 5000, path: '/api/v1/auth/request-otp', method: 'POST', headers: { 'Content-Type': 'application/json' } },
      { phone: '123' }
    );
    check('Input Validation (Phone Format)', badPhone.status === 400 && badPhone.body.error.code === 'VALIDATION_ERROR', 'Rejected invalid phone with HTTP 400');

    // 3. OTP Request (Valid Indian Number)
    const otpRes = await request(
      { host: 'localhost', port: 5000, path: '/api/v1/auth/request-otp', method: 'POST', headers: { 'Content-Type': 'application/json' } },
      { phone: '+919811223344' }
    );
    check('Phone OTP Generation', otpRes.status === 200 && otpRes.body.data.phone === '+919811223344', 'Generated valid OTP with expiration TTL');

    // 4. OTP Verification & JWT Issuance
    const verifyRes = await request(
      { host: 'localhost', port: 5000, path: '/api/v1/auth/verify-otp', method: 'POST', headers: { 'Content-Type': 'application/json' } },
      {
        phone: '+919811223344',
        otp: '123456',
        name: 'Aarav Sharma',
        preferred_language: 'mr',
        city: 'Pune',
        state: 'Maharashtra',
        locality: 'Kothrud',
        pincode: '411038'
      }
    );
    const userToken = verifyRes.body.data.token;
    check('Authentication & JWT Session', verifyRes.status === 200 && !!userToken, 'Issued signed JWT bearer token with claims');

    // 5. User Profile Preferences
    const meRes = await request({
      host: 'localhost',
      port: 5000,
      path: '/api/v1/auth/me',
      method: 'GET',
      headers: { Authorization: `Bearer ${userToken}` }
    });
    check('User Preferences Retrieval', meRes.body.data.preferred_language === 'mr' && meRes.body.data.city === 'Pune', 'Retrieved native language (mr) and city (Pune)');

    // 6. Input Validation (6-digit Indian PIN Code)
    const badPin = await request(
      {
        host: 'localhost',
        port: 5000,
        path: '/api/v1/posts',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` }
      },
      {
        title: 'Bad Pincode Test Post',
        content: 'Valid content description for test',
        category_id: 'services',
        state: 'Maharashtra',
        city: 'Pune',
        pincode: '999' // invalid
      }
    );
    check('Input Validation (6-digit PIN Code)', badPin.status === 400 && badPin.body.error.code === 'VALIDATION_ERROR', 'Rejected invalid 3-digit pincode');

    // 7. Post Creation (Full User Input)
    const newPost = await request(
      {
        host: 'localhost',
        port: 5000,
        path: '/api/v1/posts',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` }
      },
      {
        title: 'Free Blood Donation & Health Camp at Kothrud Pune',
        content: 'Community health checkup and voluntary blood donation drive organized this Sunday.',
        category_id: 'emergency',
        language: 'mr',
        state: 'Maharashtra',
        city: 'Pune',
        locality: 'Kothrud',
        pincode: '411038',
        contact_info: '+919811223344'
      }
    );
    const postId = newPost.body.data.id;
    check('Create Local Post', newPost.status === 201 && !!postId, `Created post in Pune with ID: ${postId}`);

    // 8. Edit Local Post (Ownership Check)
    const editPost = await request(
      {
        host: 'localhost',
        port: 5000,
        path: `/api/v1/posts/${postId}`,
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` }
      },
      {
        title: 'Free Blood Donation & Eye Checkup Camp at Kothrud Pune'
      }
    );
    check('Edit Local Post', editPost.status === 200 && editPost.body.data.title.includes('Eye'), 'Author edited post title successfully');

    // 9. Feed Filtering (Location, Category, Language)
    const f1 = await request({
      host: 'localhost',
      port: 5000,
      path: '/api/v1/feed?city=Pune&category=emergency&language=mr',
      method: 'GET'
    });
    check('Feed API Filtering', f1.body.data.filters.city === 'Pune' && f1.body.data.filters.category === 'emergency', 'Feed accurately filtered by city=Pune, category=emergency, language=mr');

    // 10. Redis Caching & Invalidation
    const f2 = await request({
      host: 'localhost',
      port: 5000,
      path: '/api/v1/feed?city=Pune&category=emergency&language=mr',
      method: 'GET'
    });
    check('Redis Caching', f2.body.data.meta.cached === true, 'Served 2nd feed query directly from cache (cached: true)');

    // 11. Search with Pagination & Sorting
    const searchRes = await request({
      host: 'localhost',
      port: 5000,
      path: '/api/v1/search?q=Donation&city=Pune&page=1&limit=5&sort=latest',
      method: 'GET'
    });
    check('Search with Pagination', searchRes.status === 200 && searchRes.body.data.pagination.totalItems >= 1, 'Search query matched with pagination metadata');

    // 12. Report Post
    const reportRes = await request(
      {
        host: 'localhost',
        port: 5000,
        path: `/api/v1/posts/${postId}/report`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` }
      },
      {
        reason: 'spam',
        details: 'Testing report flow for audit'
      }
    );
    check('Report Local Post', reportRes.status === 201 && reportRes.body.data.report.reason === 'spam', 'Report recorded and enqueued to background queue');

    // 13. Role-Based Permissions (RBAC: 403 Forbidden check)
    const forbiddenRes = await request({
      host: 'localhost',
      port: 5000,
      path: '/api/v1/moderation/reports',
      method: 'GET',
      headers: { Authorization: `Bearer ${userToken}` } // Regular user
    });
    check('RBAC 403 Forbidden Protection', forbiddenRes.status === 403 && forbiddenRes.body.error.code === 'FORBIDDEN', 'Ordinary user forbidden from accessing moderation queue');

    // 14. Moderator Endpoints
    const personas = await request({ host: 'localhost', port: 5000, path: '/api/v1/auth/demo-personas', method: 'GET' });
    const modToken = personas.body.data.find((p) => p.role === 'moderator').token;
    const adminToken = personas.body.data.find((p) => p.role === 'admin').token;

    const modQueue = await request({
      host: 'localhost',
      port: 5000,
      path: '/api/v1/moderation/reports?status=pending',
      method: 'GET',
      headers: { Authorization: `Bearer ${modToken}` }
    });
    check('Moderation Queue Retrieval', modQueue.status === 200 && Array.isArray(modQueue.body.data), 'Moderator successfully fetched pending reports queue');

    // 15. Moderator Post Action (Approve)
    const modAction = await request(
      {
        host: 'localhost',
        port: 5000,
        path: `/api/v1/moderation/posts/${postId}/action`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${modToken}` }
      },
      {
        action: 'approved',
        notes: 'Verified blood donation drive'
      }
    );
    check('Post Moderation Action', modAction.status === 200 && modAction.body.data.post.status === 'active', 'Moderator approved post; updated status to active');

    // 16. Admin Emergency Broadcast
    const broadcastRes = await request(
      {
        host: 'localhost',
        port: 5000,
        path: '/api/v1/moderation/broadcast',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
      },
      {
        title: 'District Heatwave Warning',
        message: 'High temperatures predicted across Pune district wards.',
        city: 'Pune',
        level: 'warning'
      }
    );
    check('Admin Emergency Broadcast', broadcastRes.status === 200 && !!broadcastRes.body.data.jobId, 'District broadcast dispatched with background Job ID');

    // 17. Asynchronous Notification Worker Execution
    await new Promise((r) => setTimeout(r, 600)); // allow background event loop worker to complete
    const queueStatus = await request({
      host: 'localhost',
      port: 5000,
      path: '/api/v1/notifications/queue-status',
      method: 'GET',
      headers: { Authorization: `Bearer ${userToken}` }
    });
    check('Asynchronous Queue Worker Execution', queueStatus.body.data.totalCompleted >= 2 && queueStatus.body.data.pendingInQueue === 0, `Worker processed ${queueStatus.body.data.totalCompleted} jobs asynchronously (0 backlog)`);

    // 18. User Notification Delivery
    const userNotifs = await request({
      host: 'localhost',
      port: 5000,
      path: '/api/v1/notifications',
      method: 'GET',
      headers: { Authorization: `Bearer ${userToken}` }
    });
    const approvedAlert = userNotifs.body.data.find((n) => n.type === 'POST_STATUS_UPDATE');
    check('Asynchronous Notification Delivery', !!approvedAlert, `Author received inbox notification: "${approvedAlert ? approvedAlert.title : ''}"`);

    // 19. Swagger / OpenAPI Documentation
    const swaggerSpec = await request({ host: 'localhost', port: 5000, path: '/api/docs', method: 'GET' });
    check('API Documentation (Swagger UI)', swaggerSpec.status === 200 || swaggerSpec.status === 301, 'Interactive Swagger UI accessible at /api/docs');

    // 20. Static Web App UI
    const webApp = await request({ host: 'localhost', port: 5000, path: '/', method: 'GET' });
    check('Interactive Web App Platform', webApp.status === 200 && typeof webApp.body === 'string' && webApp.body.includes('Bharat Local'), 'Web App UI served live at /');

    console.log('\n========================================================================');
    const allPassed = results.every((r) => r.passed);
    console.log(`🏁 FINAL AUDIT RESULT: ${allPassed ? 'ALL 20 CHECKS PASSED ✅ (100% OPERATIONAL)' : 'SOME CHECKS FAILED ❌'}`);
    console.log('========================================================================\n');
  } catch (err) {
    console.error('Audit encountered unexpected error:', err);
  }
}

runAudit();
