// Bharat Local Web App Client Engine - Dynamic User-Input Driven

const API_BASE = '/api/v1';

let currentUser = null;
let currentToken = localStorage.getItem('bharat_token') || null;
let currentFilters = {
  city: localStorage.getItem('bharat_city') || 'Jaipur',
  category: 'all',
  language: 'all',
  sort: 'latest',
  page: 1,
  limit: 12
};

// DOM Elements
const cityInput = document.getElementById('cityInput');
const applyCityBtn = document.getElementById('applyCityBtn');
const langSelect = document.getElementById('langSelect');
const sortSelect = document.getElementById('sortSelect');
const postsContainer = document.getElementById('postsContainer');
const categoryPills = document.getElementById('categoryPills');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resetSearchBtn = document.getElementById('resetSearchBtn');
const cacheNotice = document.getElementById('cacheNotice');
const pageInfoText = document.getElementById('pageInfoText');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');

// Modals
const personaModal = document.getElementById('personaModal');
const reportModal = document.getElementById('reportModal');
const broadcastModal = document.getElementById('broadcastModal');
const userName = document.getElementById('userName');
const userRoleBadge = document.getElementById('userRoleBadge');

// Initialize on Load
document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  setupEventListeners();
  await loadSystemHealth();
  await restoreSessionOrInit();
  cityInput.value = currentFilters.city;
  await loadFeed();
});

// Setup Tab Navigation
function setupTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));

      tab.classList.add('active');
      const target = document.getElementById(tab.dataset.tab);
      if (target) target.classList.add('active');

      if (tab.dataset.tab === 'moderationTab') loadModerationQueue();
      if (tab.dataset.tab === 'notificationsTab') loadNotifications();
      if (tab.dataset.tab === 'queueTab') loadQueueStats();
      if (tab.dataset.tab === 'profileTab') populateProfileForm();
    });
  });
}

function setupEventListeners() {
  // Freeform City Input
  applyCityBtn.addEventListener('click', () => {
    const val = cityInput.value.trim();
    if (val) {
      currentFilters.city = val;
      localStorage.setItem('bharat_city', val);
      currentFilters.page = 1;
      loadFeed();
    }
  });

  cityInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const val = cityInput.value.trim();
      if (val) {
        currentFilters.city = val;
        localStorage.setItem('bharat_city', val);
        currentFilters.page = 1;
        loadFeed();
      }
    }
  });

  // Language filter
  langSelect.addEventListener('change', (e) => {
    currentFilters.language = e.target.value;
    currentFilters.page = 1;
    loadFeed();
  });

  // Sort change
  sortSelect.addEventListener('change', (e) => {
    currentFilters.sort = e.target.value;
    currentFilters.page = 1;
    loadFeed();
  });

  // Category pills
  categoryPills.addEventListener('click', (e) => {
    const pill = e.target.closest('.pill');
    if (!pill) return;
    document.querySelectorAll('.pill').forEach((p) => p.classList.remove('active'));
    pill.classList.add('active');
    currentFilters.category = pill.dataset.category;
    currentFilters.page = 1;
    loadFeed();
  });

  // Search
  searchBtn.addEventListener('click', handleSearch);
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
  });
  resetSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    resetSearchBtn.style.display = 'none';
    currentFilters.page = 1;
    loadFeed();
  });

  // Pagination
  prevPageBtn.addEventListener('click', () => {
    if (currentFilters.page > 1) {
      currentFilters.page--;
      loadFeed();
    }
  });
  nextPageBtn.addEventListener('click', () => {
    currentFilters.page++;
    loadFeed();
  });

  // Modal toggles
  document.getElementById('switchUserBtn').addEventListener('click', openPersonaModal);
  document.getElementById('closeModalBtn').addEventListener('click', () => personaModal.classList.remove('active'));
  document.getElementById('closeReportModalBtn').addEventListener('click', () => reportModal.classList.remove('active'));
  document.getElementById('closeBroadcastModalBtn').addEventListener('click', () => broadcastModal.classList.remove('active'));

  // Modal pill toggle (User Input Phone OTP vs Demo Personas)
  document.getElementById('pillCustomLogin').addEventListener('click', () => {
    document.getElementById('pillCustomLogin').classList.add('active');
    document.getElementById('pillDemoPersonas').classList.remove('active');
    document.getElementById('sectionCustomLogin').style.display = 'block';
    document.getElementById('sectionDemoPersonas').style.display = 'none';
  });

  document.getElementById('pillDemoPersonas').addEventListener('click', () => {
    document.getElementById('pillDemoPersonas').classList.add('active');
    document.getElementById('pillCustomLogin').classList.remove('active');
    document.getElementById('sectionDemoPersonas').style.display = 'block';
    document.getElementById('sectionCustomLogin').style.display = 'none';
  });

  // Create Post Form (Full User Input)
  document.getElementById('createPostForm').addEventListener('submit', handleCreatePost);

  // Profile Form (Full User Input)
  document.getElementById('profileForm').addEventListener('submit', handleSaveProfile);

  // Report Form (User Input)
  document.getElementById('reportForm').addEventListener('submit', handleReportSubmit);

  // Broadcast Alert Form (User Input)
  document.getElementById('broadcastAlertBtn').addEventListener('click', openBroadcastModal);
  document.getElementById('broadcastForm').addEventListener('submit', handleBroadcastSubmit);

  // Moderation refresh
  document.getElementById('refreshModQueueBtn').addEventListener('click', loadModerationQueue);
  document.getElementById('refreshQueueBtn').addEventListener('click', loadQueueStats);

  // Custom OTP buttons
  document.getElementById('requestOtpBtn').addEventListener('click', handleRequestOtp);
  document.getElementById('verifyOtpBtn').addEventListener('click', handleVerifyOtp);
}

// System Health & Engine Status
async function loadSystemHealth() {
  try {
    const res = await fetch('/health');
    const data = await res.json();
    document.getElementById('dbStatusText').textContent = data.database.mode === 'postgres' ? 'PostgreSQL (Live)' : 'PostgreSQL Schema (Ready/Fallback)';
    document.getElementById('cacheStatusText').textContent = data.cache.type === 'redis' ? `Redis (${data.cache.hits} hits)` : `In-Memory LRU (${data.cache.hits} hits)`;
    document.getElementById('queueStatusText').textContent = `Active (${data.backgroundQueue.completedJobs} completed)`;
  } catch (e) {
    console.warn('Health check failed', e);
  }
}

// Restore Session or Initialize Default
async function restoreSessionOrInit() {
  // If we have a stored token, check profile
  if (currentToken) {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      const data = await res.json();
      if (data.success) {
        currentUser = data.data;
        updateUserUI();
        return;
      }
    } catch (e) {
      // Token invalid, clear it
      localStorage.removeItem('bharat_token');
      currentToken = null;
    }
  }

  // Load demo personas for quick fallback
  try {
    const res = await fetch(`${API_BASE}/auth/demo-personas`);
    const data = await res.json();
    if (data.success && data.data.length > 0) {
      window.demoPersonas = data.data;
      // Default to persona
      selectPersona(data.data[3]);
    }
  } catch (err) {
    console.warn('Failed to load personas', err);
  }
}

function updateUserUI() {
  if (!currentUser) return;
  userName.textContent = currentUser.name;
  userRoleBadge.textContent = currentUser.role.toUpperCase();
  userRoleBadge.className = `user-role-badge role-${currentUser.role}`;

  // Populate Create Post inputs with current user's location
  document.getElementById('postState').value = currentUser.state || '';
  document.getElementById('postCity').value = currentUser.city || currentFilters.city;
  document.getElementById('postLocality').value = currentUser.locality || '';
  document.getElementById('postPincode').value = currentUser.pincode || '';
  document.getElementById('postContact').value = currentUser.phone || '';
  document.getElementById('postLanguage').value = currentUser.preferred_language || 'hi';

  populateProfileForm();
}

function populateProfileForm() {
  if (!currentUser) return;
  document.getElementById('profilePhone').value = currentUser.phone || '';
  document.getElementById('profileRole').value = (currentUser.role || 'user').toUpperCase();
  document.getElementById('profileName').value = currentUser.name || '';
  document.getElementById('profileLanguage').value = currentUser.preferred_language || 'hi';
  document.getElementById('profileState').value = currentUser.state || '';
  document.getElementById('profileCity').value = currentUser.city || '';
  document.getElementById('profileLocality').value = currentUser.locality || '';
  document.getElementById('profilePincode').value = currentUser.pincode || '';
}

function selectPersona(persona) {
  currentUser = {
    id: persona.id || '44444444-4444-4444-8444-444444444444',
    name: persona.name,
    role: persona.role,
    phone: persona.phone,
    preferred_language: persona.preferred_language,
    city: persona.location.split(',')[0].trim(),
    state: persona.location.split(',')[1]?.trim() || 'Rajasthan',
    pincode: '302017'
  };
  currentToken = persona.token;
  if (currentToken) {
    localStorage.setItem('bharat_token', currentToken);
  }

  updateUserUI();
  personaModal.classList.remove('active');
  loadNotifications();
  loadModerationQueue();
}

function openPersonaModal() {
  const container = document.getElementById('personasGrid');
  container.innerHTML = '';

  (window.demoPersonas || []).forEach((persona) => {
    const div = document.createElement('div');
    div.className = 'persona-card';
    div.innerHTML = `
      <div>
        <strong>${persona.name}</strong> 
        <span class="user-role-badge role-${persona.role}">${persona.role}</span>
        <div style="font-size:0.78rem; color:#64748b;">📍 ${persona.location} • 🗣️ ${persona.preferred_language.toUpperCase()} • 📱 ${persona.phone}</div>
      </div>
      <button class="btn btn-sm btn-primary">Use Persona</button>
    `;
    div.addEventListener('click', () => selectPersona(persona));
    container.appendChild(div);
  });

  personaModal.classList.add('active');
}

// User-Input Phone OTP Request
async function handleRequestOtp() {
  const phone = document.getElementById('loginPhoneInput').value.trim();
  if (!phone) return alert('Please enter your mobile number.');

  try {
    const res = await fetch(`${API_BASE}/auth/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    const json = await res.json();
    if (json.success) {
      document.getElementById('otpInputWrap').style.display = 'block';
      alert(`📲 OTP sent successfully to ${json.data.phone}!\n(Dev mock code: ${json.data.devOtp || '123456'})`);
    } else {
      alert('Error: ' + json.error.message);
    }
  } catch (err) {
    alert('Failed to request OTP. Check network connection.');
  }
}

// User-Input Phone OTP Verify & Register
async function handleVerifyOtp() {
  const phone = document.getElementById('loginPhoneInput').value.trim();
  const otp = document.getElementById('loginOtpInput').value.trim();
  const name = document.getElementById('regName').value.trim();
  const preferred_language = document.getElementById('regLang').value;
  const city = document.getElementById('regCity').value.trim();
  const pincode = document.getElementById('regPincode').value.trim();

  if (!phone || !otp) return alert('Please enter both phone and OTP.');
  if (!name) return alert('Please enter your name.');
  if (!city) return alert('Please enter your city.');

  try {
    const res = await fetch(`${API_BASE}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        otp,
        name,
        preferred_language,
        city,
        state: 'India',
        pincode: pincode || '411038'
      })
    });
    const json = await res.json();

    if (json.success) {
      currentToken = json.data.token;
      currentUser = json.data.user;
      localStorage.setItem('bharat_token', currentToken);
      localStorage.setItem('bharat_city', currentUser.city);

      currentFilters.city = currentUser.city;
      cityInput.value = currentUser.city;

      updateUserUI();
      personaModal.classList.remove('active');
      loadNotifications();
      loadFeed();
      alert(`🎉 Welcome ${currentUser.name}! You are logged in with role: ${currentUser.role}`);
    } else {
      alert('Verification Error: ' + json.error.message);
    }
  } catch (err) {
    alert('Verification failed.');
  }
}

// User Profile Update (User Input Form)
async function handleSaveProfile(e) {
  e.preventDefault();
  if (!currentToken) return alert('Please log in first.');

  const btn = document.getElementById('saveProfileBtn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  const updates = {
    name: document.getElementById('profileName').value.trim(),
    preferred_language: document.getElementById('profileLanguage').value,
    state: document.getElementById('profileState').value.trim(),
    city: document.getElementById('profileCity').value.trim(),
    locality: document.getElementById('profileLocality').value.trim(),
    pincode: document.getElementById('profilePincode').value.trim()
  };

  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify(updates)
    });
    const json = await res.json();

    if (json.success) {
      currentUser = json.data;
      updateUserUI();
      currentFilters.city = currentUser.city;
      cityInput.value = currentUser.city;
      localStorage.setItem('bharat_city', currentUser.city);
      alert('✅ Profile preferences updated successfully! Community feed updated.');
      loadFeed();
    } else {
      alert('Error updating profile: ' + json.error.message);
    }
  } catch (err) {
    alert('Failed to update profile');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Preferences 💾';
  }
}

// Fetch & Render Feed
async function loadFeed() {
  postsContainer.innerHTML = '<div class="loading-state">Fetching local community posts...</div>';

  const params = new URLSearchParams({
    city: currentFilters.city,
    page: currentFilters.page,
    limit: currentFilters.limit,
    sort: currentFilters.sort
  });

  if (currentFilters.category !== 'all') params.append('category', currentFilters.category);
  if (currentFilters.language !== 'all') params.append('language', currentFilters.language);

  const headers = {};
  if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;

  try {
    const start = performance.now();
    const res = await fetch(`${API_BASE}/feed?${params.toString()}`, { headers });
    const elapsed = Math.round(performance.now() - start);
    const json = await res.json();

    if (!json.success) {
      postsContainer.innerHTML = `<div class="empty-state">${json.error.message}</div>`;
      return;
    }

    const { posts, pagination, meta } = json.data;

    // Cache Notice
    if (meta && meta.cached) {
      cacheNotice.style.display = 'block';
      cacheNotice.innerHTML = `⚡ <strong>Redis Cache Hit</strong> — Feed served from cache in ${elapsed}ms (${meta.cacheEngine})`;
    } else {
      cacheNotice.style.display = 'block';
      cacheNotice.innerHTML = `🔄 <strong>Database Query (Cache Miss)</strong> — Fetched via database indexes in ${elapsed}ms, now cached.`;
    }

    // Render Posts
    if (posts.length === 0) {
      postsContainer.innerHTML = `<div class="empty-state">No posts found in <strong>${escapeHtml(currentFilters.city)}</strong> for this filter.<br><br>💡 Click <strong>"✍️ Share Local Post"</strong> to publish the first announcement or service in ${escapeHtml(currentFilters.city)}!</div>`;
      return;
    }

    postsContainer.innerHTML = '';
    posts.forEach((post) => {
      postsContainer.appendChild(createPostCard(post));
    });

    // Pagination
    pageInfoText.textContent = `Page ${pagination.page} of ${pagination.totalPages || 1} (${pagination.totalItems} posts in ${currentFilters.city})`;
    prevPageBtn.disabled = !pagination.hasPrevPage;
    nextPageBtn.disabled = !pagination.hasNextPage;

    loadSystemHealth();
  } catch (err) {
    postsContainer.innerHTML = `<div class="empty-state">Failed to load posts. Is the server running?</div>`;
  }
}

// Create Post Card DOM
function createPostCard(post) {
  const card = document.createElement('div');
  card.className = 'post-card';

  const categoryClass = post.category_id === 'emergency' ? 'post-category-tag post-category-emergency' : 'post-category-tag';
  const timeAgo = formatTimeAgo(post.created_at);

  card.innerHTML = `
    <div>
      <div class="post-card-header">
        <span class="${categoryClass}">${post.category_name || post.category_id}</span>
        <div class="post-meta-badges">
          <span class="post-lang-badge">${(post.language || 'hi').toUpperCase()}</span>
        </div>
      </div>
      <div class="post-location-tag">📍 ${post.locality ? escapeHtml(post.locality) + ', ' : ''}${escapeHtml(post.city)} (${post.pincode})</div>
      <h3 class="post-title">${escapeHtml(post.title)}</h3>
      <p class="post-content">${escapeHtml(post.content)}</p>
      ${post.contact_info ? `<div class="post-contact-info">📞 Contact: ${escapeHtml(post.contact_info)}</div>` : ''}
    </div>
    <div class="post-footer">
      <div>
        <span class="post-author">${escapeHtml(post.author_name || 'Resident')}</span>
        <span> • ${timeAgo} • 👁️ ${post.view_count || 0}</span>
      </div>
      <div class="post-actions">
        <button class="btn-report" onclick="openReportModal('${post.id}')">🚨 Report</button>
      </div>
    </div>
  `;
  return card;
}

// Search
async function handleSearch() {
  const q = searchInput.value.trim();
  if (!q) return;

  resetSearchBtn.style.display = 'inline-block';
  postsContainer.innerHTML = '<div class="loading-state">Searching community posts...</div>';

  try {
    const params = new URLSearchParams({
      q,
      city: currentFilters.city,
      page: 1,
      limit: 12
    });
    if (currentFilters.category !== 'all') params.append('category', currentFilters.category);
    if (currentFilters.language !== 'all') params.append('language', currentFilters.language);

    const res = await fetch(`${API_BASE}/search?${params.toString()}`);
    const json = await res.json();

    if (json.success) {
      cacheNotice.style.display = 'none';
      const posts = json.data.posts;
      if (posts.length === 0) {
        postsContainer.innerHTML = `<div class="empty-state">No matching results for "${escapeHtml(q)}" in ${currentFilters.city}.</div>`;
        return;
      }
      postsContainer.innerHTML = '';
      posts.forEach((p) => postsContainer.appendChild(createPostCard(p)));
      pageInfoText.textContent = `Search results: ${json.data.pagination.totalItems} matches`;
    }
  } catch (err) {
    postsContainer.innerHTML = '<div class="empty-state">Search query failed.</div>';
  }
}

// Create New Post (All Inputs from Form)
async function handleCreatePost(e) {
  e.preventDefault();
  if (!currentToken) {
    alert('Please log in first to publish community posts.');
    openPersonaModal();
    return;
  }

  const btn = document.getElementById('submitPostBtn');
  btn.disabled = true;
  btn.textContent = 'Publishing...';

  // Read all inputs directly from the user's form
  const payload = {
    title: document.getElementById('postTitle').value.trim(),
    category_id: document.getElementById('postCategory').value,
    language: document.getElementById('postLanguage').value,
    state: document.getElementById('postState').value.trim(),
    city: document.getElementById('postCity').value.trim(),
    locality: document.getElementById('postLocality').value.trim(),
    pincode: document.getElementById('postPincode').value.trim(),
    content: document.getElementById('postContent').value.trim(),
    contact_info: document.getElementById('postContact').value.trim()
  };

  try {
    const res = await fetch(`${API_BASE}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify(payload)
    });
    const json = await res.json();

    if (json.success) {
      alert(`🎉 Post "${payload.title}" published successfully in ${payload.city}!\n\nFeed cache for ${payload.city} has been invalidated.`);
      document.getElementById('createPostForm').reset();
      
      // Update city filter to the post's city
      currentFilters.city = payload.city;
      cityInput.value = payload.city;
      localStorage.setItem('bharat_city', payload.city);

      // Switch back to Feed tab
      document.querySelector('[data-tab="feedTab"]').click();
      loadFeed();
    } else {
      alert(`Error publishing post: ${json.error.message}`);
    }
  } catch (err) {
    alert('Failed to publish post');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Publish Community Post 🚀';
  }
}

// Report Modal & Submit
window.openReportModal = function(postId) {
  if (!currentToken) {
    alert('Please log in or select a persona to report posts.');
    openPersonaModal();
    return;
  }
  document.getElementById('reportPostId').value = postId;
  reportModal.classList.add('active');
};

async function handleReportSubmit(e) {
  e.preventDefault();
  const postId = document.getElementById('reportPostId').value;
  const reason = document.getElementById('reportReason').value;
  const details = document.getElementById('reportDetails').value.trim();

  try {
    const res = await fetch(`${API_BASE}/posts/${postId}/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({ reason, details })
    });
    const json = await res.json();

    if (json.success) {
      reportModal.classList.remove('active');
      document.getElementById('reportForm').reset();
      alert('✅ ' + json.message + '\n\n⚡ Background Worker: Asynchronous notification enqueued for moderators!');
      loadQueueStats();
      loadModerationQueue();
    } else {
      alert('Error: ' + json.error.message);
    }
  } catch (e) {
    alert('Failed to submit report');
  }
}

// Moderation Queue
async function loadModerationQueue() {
  const container = document.getElementById('modQueueContainer');
  if (!currentToken) {
    container.innerHTML = '<div class="empty-state">Please login with a Moderator or Admin account to view the Moderation Desk.</div>';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/moderation/reports?status=all`, {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    const json = await res.json();

    if (!json.success) {
      container.innerHTML = `<div class="empty-state">${json.error.message} (Requires Moderator/Admin Role)</div>`;
      return;
    }

    const reports = json.data;
    document.getElementById('reportCountBadge').textContent = reports.filter(r => r.status === 'pending').length;

    if (reports.length === 0) {
      container.innerHTML = '<div class="empty-state">✅ All clean! No pending reports in the moderation queue.</div>';
      return;
    }

    container.innerHTML = '';
    reports.forEach((rep) => {
      const item = document.createElement('div');
      item.className = 'mod-queue-item';
      item.innerHTML = `
        <div class="mod-item-header">
          <div>
            <span class="report-reason-badge">⚠️ ${rep.reason}</span>
            <span style="font-size:0.8rem; margin-left: 8px; color:#64748b;">Reported by: ${escapeHtml(rep.reporter_name || 'Resident')} • Status: <strong>${rep.status.toUpperCase()}</strong></span>
          </div>
          <span style="font-size:0.75rem; color:#94a3b8;">${formatTimeAgo(rep.created_at)}</span>
        </div>
        <h4 style="margin: 8px 0 4px 0;">Post: "${escapeHtml(rep.post_title || 'Community Post')}"</h4>
        <p style="font-size:0.88rem; color:#334155; margin-bottom: 6px;">Report Details: <em>"${escapeHtml(rep.details || 'No additional note')}"</em></p>
        ${rep.status === 'pending' ? `
          <div class="mod-actions-row">
            <button class="btn btn-sm btn-primary" onclick="resolvePostAction('${rep.post_id}', 'approved')">✅ Approve Post</button>
            <button class="btn btn-sm btn-danger" onclick="resolvePostAction('${rep.post_id}', 'rejected')">❌ Reject & Remove</button>
            <button class="btn btn-sm btn-warning" onclick="resolvePostAction('${rep.post_id}', 'hidden')">👁️ Hide Post</button>
          </div>
        ` : `<div style="font-size:0.8rem; color:#16a34a; font-weight:600; margin-top:8px;">Action resolved: ${rep.status}</div>`}
      `;
      container.appendChild(item);
    });
  } catch (err) {
    container.innerHTML = '<div class="empty-state">Failed to load moderation queue.</div>';
  }
}

window.resolvePostAction = async function(postId, action) {
  const notes = prompt(`Enter moderation audit notes for ${action}:`, `Verified compliant with guidelines`);
  if (notes === null) return;

  try {
    const res = await fetch(`${API_BASE}/moderation/posts/${postId}/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({ action, notes })
    });
    const json = await res.json();
    if (json.success) {
      alert(`🎉 Action recorded: Post ${action}!\n\n⚡ Asynchronous notification dispatched to post author.`);
      loadModerationQueue();
      loadQueueStats();
      loadFeed();
    } else {
      alert('Error: ' + json.error.message);
    }
  } catch (err) {
    alert('Failed to resolve action');
  }
};

// District Broadcast Modal & Submit
function openBroadcastModal() {
  if (currentUser?.role !== 'admin') {
    alert('District emergency broadcasts require Admin permissions. Switch to the District Admin persona in the Account modal.');
    return;
  }
  document.getElementById('alertCity').value = currentFilters.city;
  broadcastModal.classList.add('active');
}

async function handleBroadcastSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('alertTitle').value.trim();
  const city = document.getElementById('alertCity').value.trim();
  const level = document.getElementById('alertLevel').value;
  const message = document.getElementById('alertMessage').value.trim();

  try {
    const res = await fetch(`${API_BASE}/moderation/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({ title, message, city, level })
    });
    const json = await res.json();

    if (json.success) {
      broadcastModal.classList.remove('active');
      document.getElementById('broadcastForm').reset();
      alert(`🚨 Broadcast Job [${json.data.jobId}] enqueued for asynchronous distribution across ${city}!`);
      loadQueueStats();
    } else {
      alert('Error: ' + json.error.message);
    }
  } catch (err) {
    alert('Broadcast failed');
  }
}

// User Notifications
async function loadNotifications() {
  const container = document.getElementById('notifListContainer');
  if (!currentToken) {
    container.innerHTML = '<div class="empty-state">Please login to view notifications.</div>';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/notifications`, {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    const json = await res.json();

    if (json.success) {
      const notifs = json.data;
      const unreadCount = notifs.filter(n => !n.is_read).length;
      document.getElementById('notifBadge').textContent = unreadCount;

      if (notifs.length === 0) {
        container.innerHTML = '<div class="empty-state">No notifications yet. You will receive real-time updates when your posts are reviewed or reported!</div>';
        return;
      }

      container.innerHTML = '';
      notifs.forEach((n) => {
        const item = document.createElement('div');
        item.className = `notif-item ${!n.is_read ? 'unread' : ''}`;
        item.innerHTML = `
          <div>
            <div class="notif-title">${escapeHtml(n.title)}</div>
            <div class="notif-msg">${escapeHtml(n.message)}</div>
          </div>
          <span class="notif-time">${formatTimeAgo(n.created_at)}</span>
        `;
        container.appendChild(item);
      });
    }
  } catch (e) {
    container.innerHTML = '<div class="empty-state">Could not load notifications.</div>';
  }
}

// Async Background Queue Stats & Job Execution Stream
async function loadQueueStats() {
  if (!currentToken) return;

  try {
    const res = await fetch(`${API_BASE}/notifications/queue-status`, {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    const json = await res.json();

    if (json.success) {
      const stats = json.data;
      document.getElementById('statEnqueued').textContent = stats.totalEnqueued;
      document.getElementById('statCompleted').textContent = stats.totalCompleted;
      document.getElementById('statPending').textContent = stats.pendingInQueue;

      const jobsList = document.getElementById('workerJobsList');
      if (stats.recentJobs && stats.recentJobs.length > 0) {
        jobsList.innerHTML = '';
        stats.recentJobs.forEach((job) => {
          const card = document.createElement('div');
          card.className = 'worker-job-card';
          card.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <strong>Job: ${job.type}</strong>
              <span style="font-weight:700; color:#16a34a;">STATUS: ${job.status.toUpperCase()}</span>
            </div>
            <div style="font-size:0.78rem; color:#64748b;">ID: ${job.id} • Enqueued: ${new Date(job.createdAt).toLocaleTimeString()}</div>
          `;
          jobsList.appendChild(card);
        });
      }
    }
  } catch (e) {
    console.warn('Queue stats load failed', e);
  }
}

// Helper: Escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}

// Helper: Time Ago
function formatTimeAgo(dateStr) {
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}
