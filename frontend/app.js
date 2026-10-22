// The Global Configuration
// The API address lives in config.js so it can change per environment without touching this file.
const API_URL = (window.APP_CONFIG && window.APP_CONFIG.API_URL) || 'http://localhost:5000';
// One shared hourly rate, used by both the dashboard income cards and the invoices.
const HOURLY_RATE = (window.APP_CONFIG && window.APP_CONFIG.HOURLY_RATE) || 22;

// Students the logged-in tutor works with (filled from GET /students)
let globalStudents = [];

// Escape any text from the database before putting it into the page, so typed HTML can't run.
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Show a student's email where we know it, otherwise their ID.
function studentLabel(id) {
    const student = globalStudents.find((s) => s.id === id);
    return student ? escapeHtml(student.email) : `Student #${escapeHtml(id)}`;
}

function formatDateTime(value) {
    return new Date(value).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function monthKey(value) {
    const d = new Date(value);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Global Memory for the Calendar
let globalSessions = []; 
let currentViewDate = new Date();

// Grab the HTML elements we need to control
const loginForm = document.getElementById('login-form');
const authView = document.getElementById('auth-view');
const errorMsg = document.getElementById('auth-error');
const submitBtn = loginForm.querySelector('button');

// The Dashboards (The 3 Lanes)
const dashboards = {
    admin: document.getElementById('admin-dashboard'),
    tutor: document.getElementById('tutor-dashboard'),
    student: document.getElementById('student-dashboard')
};

// 1. Login & Routing Logic
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Stop the page from instantly reloading
    
    // Grab what the user typed
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    // Clean up the UI for the loading state
    errorMsg.classList.add('hidden');
    submitBtn.textContent = 'Authenticating...';

    try {
        // Fire the data to your live Render server
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            // SUCCESS! Save the token and the role
            localStorage.setItem('portal_token', data.token);
            localStorage.setItem('portal_role', data.user.role);
            localStorage.setItem('portal_user_id', data.user.id);
            localStorage.setItem('portal_email', data.user.email);
            
            // Hide the login form
            authView.classList.add('hidden');
            
            // ROUTING: Open the correct dashboard based on the role.
            // This only decides which screen to show. The API enforces what each role can actually do.
            const userRole = data.user.role;

         if (userRole === 'admin') {
                dashboards.admin.classList.remove('hidden');
                fetchSessions(); 
            } else if (userRole === 'tutor') {
                dashboards.tutor.classList.remove('hidden');
                fetchTutorSessions();
            } else if (userRole === 'student') {
                dashboards.student.classList.remove('hidden');
                fetchStudentSessions(); 
            }
            
        } else {
            // The API rejected the logins
            errorMsg.textContent = data.error || 'Login failed. Please try again.';
            errorMsg.classList.remove('hidden');
        }
    } catch (error) {
        errorMsg.textContent = 'Cannot connect to the server. Please try again later.';
        errorMsg.classList.remove('hidden');
    } finally {
        submitBtn.textContent = 'Access Portal'; // Reset the button text
    }
});


// --- REGISTRATION LOGIC ---

const signupForm = document.getElementById('signup-form');
const showSignupBtn = document.getElementById('show-signup');
const showLoginBtn = document.getElementById('show-login');
const authTitle = document.getElementById('auth-title');
const authSuccess = document.getElementById('auth-success');

// Toggle to Sign Up view
showSignupBtn.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
    errorMsg.classList.add('hidden');
    authSuccess.classList.add('hidden');
    authTitle.textContent = "Student Registration";
});

// Toggle back to Log In view
showLoginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    signupForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    errorMsg.classList.add('hidden');
    authSuccess.classList.add('hidden');
    authTitle.textContent = "Tutoring Portal";
});

// Handle the Sign Up submission
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const submitSignupBtn = signupForm.querySelector('button');
    
    errorMsg.classList.add('hidden');
    authSuccess.classList.add('hidden');
    submitSignupBtn.textContent = 'Creating...';

    try {
        // Public sign-up always creates a student account on the server.
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Success! Clear the form and flip them back to the login screen
            signupForm.reset();
            signupForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
            authTitle.textContent = "Tutoring Portal";
            
            authSuccess.textContent = "Account successfully created! You can now log in.";
            authSuccess.classList.remove('hidden');
        } else {
            errorMsg.textContent = data.details || data.error || 'Registration failed.';
            errorMsg.classList.remove('hidden');
        }
    } catch (error) {
        errorMsg.textContent = 'Cannot connect to the server.';
        errorMsg.classList.remove('hidden');
    } finally {
        submitSignupBtn.textContent = 'Create Account';
    }
});


// --- DASHBOARD LOGIC ---

// 2. Fetch the sessions from the live server (Admin View)
async function fetchSessions() {
    const sessionList = document.getElementById('session-list');
    const token = localStorage.getItem('portal_token');

    try {
        const response = await fetch(`${API_URL}/sessions`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (response.ok) {
            sessionList.innerHTML = ''; 
            
            let actualArray = [];
            if (Array.isArray(data)) {
                actualArray = data; 
            } else if (data.sessions) {
                actualArray = data.sessions; 
            } else if (data.data) {
                actualArray = data.data; 
            } else if (data.results) {
                actualArray = data.results; 
            }

            if (actualArray.length === 0) {
                sessionList.innerHTML = '<p>No sessions scheduled yet.</p>';
                return;
            }

            actualArray.forEach(session => {
                const sessionDiv = document.createElement('div');
                sessionDiv.className = 'session-item';
                
                
                const cleanDate = new Date(session.session_date).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

               sessionDiv.innerHTML = `
                    <div style="border: 1px solid var(--border); padding: 20px; border-radius: 8px; margin-bottom: 15px; background: #fafafa; border-left: 4px solid var(--deep-navy);">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                            <h3 style="margin:0; font-family: 'Inter', sans-serif; font-size: 18px;">Session #${session.id}</h3>
                            <span style="background: var(--icy-blue); color: var(--deep-navy); padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">${session.status.toUpperCase()}</span>
                        </div>
                        <p style="margin: 5px 0;"><strong>Date:</strong> ${cleanDate}</p>
                        <p style="margin: 5px 0;"><strong>Duration:</strong> ${session.duration} minutes</p>
                        <p style="margin: 5px 0 0 0; color: #555;">${session.status === 'blocked'
                            ? `<strong>Blocked time</strong>${session.notes ? ' (' + escapeHtml(session.notes) + ')' : ''} | <strong>Tutor ID:</strong> ${session.tutor_id}`
                            : `<strong>Tutor ID:</strong> ${session.tutor_id} | <strong>Student ID:</strong> ${session.student_id}`}</p>
                    </div>
                `;

                sessionList.appendChild(sessionDiv);
            });
        } else {
            sessionList.innerHTML = `<p class="error-msg">Access Denied: ${data.error}. Please log out.</p>`;
        }
    } catch (error) {
        sessionList.innerHTML = '<p class="error-msg">Cannot connect to the server to load sessions.</p>';
        console.error(error);
    }
}

// 3. Universal Logout Button Logic (Handles all dashboards)
document.querySelectorAll('.logout-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        localStorage.removeItem('portal_token');
        localStorage.removeItem('portal_role');
        localStorage.removeItem('portal_user_id');
        localStorage.removeItem('portal_email');
        globalStudents = [];
        const invoiceMonth = document.getElementById('invoice-month');
        if (invoiceMonth) invoiceMonth.value = '';
        
        // Hide all 3 dashboards
        Object.values(dashboards).forEach(board => board.classList.add('hidden'));
        
        // Show the login screen
        authView.classList.remove('hidden'); 
        document.getElementById('login-form').reset(); 
        
        // Reset the loading text for the admin panel
        document.getElementById('session-list').innerHTML = '<p class="loading-text">Loading scheduled sessions...</p>'; 
    });
});

// 4. The Booking Form Logic (Admin View)
document.getElementById('booking-form').addEventListener('submit', async (e) => {
    e.preventDefault(); 
    
    const tutor_id = document.getElementById('new-tutor-id').value;
    const student_id = document.getElementById('new-student-id').value;
    const raw_date = document.getElementById('new-date').value;
    const duration = document.getElementById('new-duration').value;
    const token = localStorage.getItem('portal_token');
    const errorText = document.getElementById('booking-error');
    
    errorText.classList.add('hidden'); 

    // TRANSLATOR: Convert the local input into a global UTC standard
    const clean_date = new Date(raw_date).toISOString(); 

    try {
        const response = await fetch(`${API_URL}/sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                tutor_id: parseInt(tutor_id),
                student_id: parseInt(student_id),
                session_date: clean_date, 
                duration: parseInt(duration),
                status: "upcoming"
            })
        });

        const data = await response.json();

        if (response.ok) {
            document.getElementById('booking-form').reset();
            fetchSessions(); 
            
            errorText.style.color = "#16a34a"; 
            errorText.textContent = "Session successfully booked!";
            errorText.classList.remove('hidden');
            
            setTimeout(() => {
                errorText.classList.add('hidden');
                errorText.style.color = "var(--danger)"; 
            }, 3000);
            
        } else {
            errorText.textContent = data.details || data.error || "Failed to book session.";
            errorText.classList.remove('hidden');
        }
    } catch (error) {
        errorText.textContent = "Network error. Could not connect to server.";
        errorText.classList.remove('hidden');
    }
});


// 5. Fetch the sessions for the Tutor Workspace
async function fetchTutorSessions() {
    const upcomingList = document.getElementById('tutor-upcoming-tbody');
    const feedbackList = document.getElementById('tutor-feedback-tbody');
    
    // Top Stat Counters
    const statSessions = document.getElementById('tutor-stat-sessions');
    const statIncome = document.getElementById('tutor-stat-income');
    const statProjected = document.getElementById('tutor-stat-projected');
    const statHours = document.getElementById('tutor-stat-hours');

    const token = localStorage.getItem('portal_token'); 

    try {
        await loadStudents();
        const response = await fetch(`${API_URL}/sessions`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (response.ok) {
            const now = new Date();
            upcomingList.innerHTML = '';
            feedbackList.innerHTML = '';
            let feedbackCount = 0;
            
            let actualArray = [];
            if (Array.isArray(data)) actualArray = data; 
            else if (data.sessions) actualArray = data.sessions; 
            else if (data.data) actualArray = data.data; 
            else if (data.results) actualArray = data.results; 

            actualArray.sort((a, b) => new Date(a.session_date) - new Date(b.session_date));

            if (actualArray.length === 0) {
                upcomingList.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #888;">No upcoming sessions.</td></tr>';
                feedbackList.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #888; font-style: italic;">All caught up!</td></tr>';
                statSessions.textContent = '0';
                statIncome.textContent = '$0.00';
                statProjected.textContent = '$0.00';
                statHours.textContent = '0.00';
                return;
            }

            // Dual-Math Variables (Earned vs Projected)
            let projectedMins = 0;
            let earnedMins = 0;
            let totalSessions = 0;
            const hourlyRate = HOURLY_RATE;

            // Build the Table Rows
            actualArray.forEach(session => {
                // Bug fix: parseInt() prevents 'NaN' crashes from bad test data
                // Cancelled, missed and blocked time never count toward sessions, hours or income
                if (!['cancelled', 'no-show', 'blocked'].includes(session.status)) {
                    const mins = parseInt(session.duration) || 0;
                    projectedMins += mins; 
                    totalSessions++;
                    
                    if (session.status === 'completed') {
                        earnedMins += mins;
                    }
                }

                const tr = document.createElement('tr');
                const sessionTime = new Date(session.session_date);
                const cleanDate = sessionTime.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                const durationHrs = (session.duration / 60).toFixed(1);

                if (sessionTime > now && session.status === 'upcoming') {
                    // FUTURE TABLE
                    tr.innerHTML = `
                        <td class="student-name" style="white-space: nowrap;">${studentLabel(session.student_id)}</td>
                        <td>${cleanDate}</td>
                        <td>${durationHrs} hr(s)</td>
                        <td style="text-align: right;">
                            <button class="btn-approve" disabled title="Meeting links aren't part of this demo" style="opacity: 0.5; cursor: not-allowed;">Join</button>
                        </td>
                    `;
                    upcomingList.appendChild(tr);

                } else if (sessionTime <= now && session.status === 'upcoming') {
                    // PAST TABLE (Stacked Buttons & Premium Colors)
                    feedbackCount++;
                    tr.innerHTML = `
                        <td class="student-name" style="white-space: nowrap;">${studentLabel(session.student_id)}</td>
                        <td style="font-size: 13px; line-height: 1.4; min-width: 110px;">${cleanDate}</td>
                        <td>
                            <div style="display: flex; flex-direction: column; gap: 6px; align-items: flex-end;">
                                <button class="btn-approve" style="width: 100px; text-align: center;" onclick="updateSessionStatus(${session.id}, 'completed')">Confirm</button>
                                <button class="btn-decline" style="width: 100px; text-align: center;" onclick="updateSessionStatus(${session.id}, 'no-show')">Missed</button>
                            </div>
                        </td>
                    `;
                    feedbackList.appendChild(tr);
                }
            });

            if (feedbackCount === 0) {
                feedbackList.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #888; font-style: italic;">All caught up!</td></tr>';
            }

            // Update the Top Stat Cards
            const projectedHrs = (projectedMins / 60);
            const earnedHrs = (earnedMins / 60);

            statSessions.textContent = totalSessions;
            statHours.textContent = projectedHrs.toFixed(2);
            statIncome.textContent = '$' + (earnedHrs * hourlyRate).toFixed(2); 
            statProjected.textContent = '$' + (projectedHrs * hourlyRate).toFixed(2); 

            // Trigger the Calendar Engine
            globalSessions = actualArray;
            renderCalendar(actualArray); 

        } else {
            upcomingList.innerHTML = `<tr><td colspan="4" class="error-msg">Could not load schedule.</td></tr>`;
        }
    } catch (error) {
        upcomingList.innerHTML = '<tr><td colspan="4" class="error-msg">Cannot connect to server.</td></tr>';
    }
}


// --- THE CALENDAR ENGINE (Upgraded with Time Travel) ---
function renderCalendar() {
    const grid = document.querySelector('.calendar-grid');
    const title = document.getElementById('calendar-month-title');
    
    if (!grid || !title) return; 

    grid.innerHTML = ''; 

    // 1. Use the Global Memory to determine what month to draw
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth(); 
    const realToday = new Date(); // The actual day in real life

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    title.textContent = `${monthNames[month]} ${year}`;

    const firstDayIndex = new Date(year, month, 1).getDay(); 
    const daysInMonth = new Date(year, month + 1, 0).getDate(); 

    // Draw empty blocks for previous month
    for (let i = 0; i < firstDayIndex; i++) {
        grid.innerHTML += `<div class="cal-day disabled"></div>`;
    }

    // Draw the actual days
    for (let day = 1; day <= daysInMonth; day++) {
        
        // Find sessions for THIS specific day in the global memory
        const daysSessions = globalSessions.filter(session => {
            const sDate = new Date(session.session_date);
            return sDate.getDate() === day && sDate.getMonth() === month && sDate.getFullYear() === year && session.status !== 'cancelled';
        });

        let eventsHtml = '';
        daysSessions.forEach(session => {
            const timeStr = new Date(session.session_date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            
            // Logic to color-code based on the real database status
            let bgColor = 'var(--deep-navy)'; // Default Upcoming
            let txtColor = 'white';
            let labelText = `${timeStr} [Student #${session.student_id}]`;

            if (session.status === 'completed') {
                bgColor = 'var(--icy-blue)';
                txtColor = 'var(--deep-navy)';
            } else if (session.status === 'blocked') {
                bgColor = '#fee2e2'; // Soft danger red
                txtColor = '#dc2626'; // Dark red text
                labelText = `🚫 Blocked Time`;
            }
            
            eventsHtml += `
                <div class="cal-event" style="background: ${bgColor}; color: ${txtColor};" onclick="alert('Record ID: #${session.id}')">
                    ${labelText}
                </div>
            `;
        });

        // Is this block the ACTUAL today?
        const isRealToday = (day === realToday.getDate() && month === realToday.getMonth() && year === realToday.getFullYear());
        const dayStyle = isRealToday ? 'background: #fffdf5; border: 1px solid var(--champagne);' : '';
        const numStyle = isRealToday ? 'color: var(--champagne); font-weight: bold; font-size: 14px;' : '';

        grid.innerHTML += `
            <div class="cal-day" style="${dayStyle}">
                <div class="cal-date" style="${numStyle}">${day}</div>
                ${eventsHtml}
            </div>
        `;
    }
}

// --- CALENDAR NAVIGATION LISTENERS ---
document.addEventListener('click', (e) => {
    if (e.target.id === 'cal-btn-prev') {
        currentViewDate.setMonth(currentViewDate.getMonth() - 1);
        renderCalendar();
    } else if (e.target.id === 'cal-btn-next') {
        currentViewDate.setMonth(currentViewDate.getMonth() + 1);
        renderCalendar();
    } else if (e.target.id === 'cal-btn-today') {
        currentViewDate = new Date();
        renderCalendar();
    }
});

// 6. Fetch the sessions for the Student Portal
async function fetchStudentSessions() {
    const sessionList = document.getElementById('student-session-list');
    const token = localStorage.getItem('portal_token'); 

    try {
        const response = await fetch(`${API_URL}/sessions`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (response.ok) {
            sessionList.innerHTML = ''; 
            
            let actualArray = [];
            if (Array.isArray(data)) actualArray = data; 
            else if (data.sessions) actualArray = data.sessions; 
            else if (data.data) actualArray = data.data; 
            else if (data.results) actualArray = data.results; 

            if (actualArray.length === 0) {
                sessionList.innerHTML = '<p>You have no upcoming sessions scheduled.</p>';
                return;
            }

            actualArray.forEach(session => {
                const sessionDiv = document.createElement('div');
                const cleanDate = new Date(session.session_date).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

                sessionDiv.innerHTML = `
                    <div style="border: 1px solid var(--border); padding: 20px; border-radius: 8px; margin-bottom: 15px; background: #fafafa; border-left: 4px solid var(--champagne);">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                            <h3 style="margin:0; font-family: 'Inter', sans-serif; font-size: 18px;">Session #${session.id}</h3>
                            <span style="background: var(--icy-blue); color: var(--deep-navy); padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">${session.status.toUpperCase()}</span>
                        </div>
                        <p style="margin: 5px 0;"><strong>Date:</strong> ${cleanDate}</p>
                        <p style="margin: 5px 0;"><strong>Duration:</strong> ${session.duration} minutes</p>
                        
                        <button class="btn" disabled title="Meeting links aren't part of this demo" style="margin-top: 15px; padding: 10px; font-size: 14px; opacity: 0.5; cursor: not-allowed;">Join Session</button>
                    </div>
                `;
                sessionList.appendChild(sessionDiv);
            });
        } else {
            sessionList.innerHTML = `<p class="error-msg">Access Denied: Could not load schedule.</p>`;
        }
    } catch (error) {
        sessionList.innerHTML = '<p class="error-msg">Cannot connect to the server.</p>';
    }
}

// --- SKELETON NAVIGATION LOGIC ---
const navLinks = {
    home: document.getElementById('nav-home'),
    calendar: document.getElementById('nav-calendar'),
    profiles: document.getElementById('nav-profiles'),
    invoices: document.getElementById('nav-invoices') 
};

const views = {
    home: document.getElementById('tutor-view-home'),
    calendar: document.getElementById('tutor-view-calendar'),
    profiles: document.getElementById('tutor-view-profiles'),
    invoices: document.getElementById('tutor-view-invoices') 
};


function switchView(target) {
    Object.values(views).forEach(view => { if (view) view.classList.add('hidden'); });
    Object.values(navLinks).forEach(link => { if (link) link.classList.remove('active'); });

    if (views[target]) views[target].classList.remove('hidden');
    if (navLinks[target]) navLinks[target].classList.add('active');
}

if (navLinks.home) navLinks.home.addEventListener('click', (e) => { e.preventDefault(); switchView('home'); });
if (navLinks.calendar) navLinks.calendar.addEventListener('click', (e) => { e.preventDefault(); switchView('calendar'); });
if (navLinks.profiles) navLinks.profiles.addEventListener('click', (e) => { e.preventDefault(); switchView('profiles'); renderProfiles(); });
if (navLinks.invoices) navLinks.invoices.addEventListener('click', (e) => { e.preventDefault(); switchView('invoices'); renderInvoice(); });

// --- STUDENT PROFILES ---
async function loadStudents() {
    try {
        const response = await fetch(`${API_URL}/students`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('portal_token')}` }
        });
        const data = await response.json();
        globalStudents = response.ok ? (data.students || []) : [];
    } catch (error) {
        globalStudents = [];
    }
}

async function renderProfiles() {
    const tbody = document.getElementById('profiles-tbody');
    document.getElementById('profile-detail').classList.add('hidden');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #888;">Loading students...</td></tr>';
    await loadStudents();

    if (globalStudents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #888;">No students yet. Students appear here once you have a session with them.</td></tr>';
        return;
    }

    tbody.innerHTML = globalStudents.map((s) => `
        <tr class="profile-row" data-student-id="${s.id}" style="cursor: pointer;">
            <td class="student-name">${escapeHtml(s.email)}</td>
            <td>${s.total_sessions}</td>
            <td>${s.completed_sessions}</td>
            <td>${s.upcoming_sessions}</td>
            <td>${s.last_session ? formatDateTime(s.last_session) : '-'}</td>
        </tr>`).join('');
}

// Clicking a student shows the sessions you've had with them
document.getElementById('profiles-tbody').addEventListener('click', (e) => {
    const row = e.target.closest('.profile-row');
    if (!row) return;
    const id = Number(row.dataset.studentId);
    const student = globalStudents.find((s) => s.id === id);
    const sessions = globalSessions
        .filter((s) => s.student_id === id)
        .sort((a, b) => new Date(b.session_date) - new Date(a.session_date));

    document.getElementById('profile-detail-title').textContent = `Sessions with ${student ? student.email : 'Student #' + id}`;
    document.getElementById('profile-detail-tbody').innerHTML = sessions.length
        ? sessions.map((s) => `
            <tr>
                <td>${formatDateTime(s.session_date)}</td>
                <td>${((parseFloat(s.duration) || 0) / 60).toFixed(1)} hr(s)</td>
                <td>${escapeHtml(s.status)}</td>
            </tr>`).join('')
        : '<tr><td colspan="3" style="text-align: center; color: #888;">No sessions yet.</td></tr>';
    document.getElementById('profile-detail').classList.remove('hidden');
});

// --- INVOICES (built from completed sessions only) ---
function renderInvoice() {
    const monthInput = document.getElementById('invoice-month');
    const completed = globalSessions.filter((s) => s.status === 'completed');

    // Default to this month, or the latest month with completed sessions if this one is empty
    if (!monthInput.value) {
        const now = new Date();
        let ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        if (!completed.some((s) => monthKey(s.session_date) === ym) && completed.length) {
            ym = completed.map((s) => monthKey(s.session_date)).sort().pop();
        }
        monthInput.value = ym;
    }

    const ym = monthInput.value;
    const rows = completed
        .filter((s) => monthKey(s.session_date) === ym)
        .sort((a, b) => new Date(a.session_date) - new Date(b.session_date));

    const [year, month] = ym.split('-').map(Number);
    const opts = { month: 'short', day: 'numeric', year: 'numeric' };
    document.getElementById('invoice-period').textContent =
        `${new Date(year, month - 1, 1).toLocaleDateString([], opts)} to ${new Date(year, month, 0).toLocaleDateString([], opts)}`;

    document.getElementById('invoice-from').innerHTML =
        `<strong>${escapeHtml(localStorage.getItem('portal_email') || 'Tutor')}</strong><br>Tutor ID: ${escapeHtml(localStorage.getItem('portal_user_id') || '-')}`;

    let totalHours = 0;
    const tbody = document.getElementById('invoice-tbody');
    tbody.innerHTML = rows.length
        ? rows.map((s) => {
            const hrs = (parseFloat(s.duration) || 0) / 60;
            totalHours += hrs;
            return `
            <tr>
                <td>${studentLabel(s.student_id)}</td>
                <td>${formatDateTime(s.session_date)}</td>
                <td>${hrs.toFixed(2)} hr(s)</td>
                <td>$${HOURLY_RATE.toFixed(2)}</td>
                <td style="text-align: right;">$${(hrs * HOURLY_RATE).toFixed(2)}</td>
            </tr>`;
        }).join('')
        : '<tr><td colspan="5" style="text-align: center; color: #888;">No completed sessions in this month.</td></tr>';

    document.getElementById('invoice-rate').textContent = '$' + HOURLY_RATE.toFixed(2);
    document.getElementById('invoice-hours').textContent = totalHours.toFixed(2);
    document.getElementById('invoice-total').textContent = '$' + (totalHours * HOURLY_RATE).toFixed(2);
}

document.getElementById('invoice-month').addEventListener('change', renderInvoice);
document.getElementById('btn-print-invoice').addEventListener('click', () => window.print());

// --- STATUS UPDATE ENGINE ---
async function updateSessionStatus(sessionId, newStatus) {
    const token = localStorage.getItem('portal_token');
    
    // Quick confirmation box so tutors don't misclick
    const confirmAction = confirm(`Are you sure you want to mark this session as ${newStatus.toUpperCase()}?`);
    if (!confirmAction) return;

    try {
        // Fire the PUT request to your Render server to update the specific session
        const response = await fetch(`${API_URL}/sessions/${sessionId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (response.ok) {
            // Instantly reload the dashboard to wipe it from the Feedback table!
            fetchTutorSessions(); 
        } else {
            const data = await response.json();
            alert(`Failed to update: ${data.error}`);
        }
    } catch (error) {
        alert('Network error. Cannot connect to the server.');
    }
}

// --- MODAL ENGINE ---

const modalElements = {
    btnOpenSession: document.getElementById('btn-open-session'),
    btnOpenBlocked: document.getElementById('btn-open-blocked'),
    modalSession: document.getElementById('modal-add-session'),
    modalBlocked: document.getElementById('modal-add-blocked'),
    btnSaveSession: document.getElementById('btn-save-session'),
    btnSaveBlocked: document.getElementById('btn-save-blocked')
};


// 1. Open Session Modal
if (modalElements.btnOpenSession && modalElements.modalSession) {
    modalElements.btnOpenSession.addEventListener('click', () => {
        modalElements.modalSession.classList.remove('hidden');
    });
}

// 2. Open Blocked Modal
if (modalElements.btnOpenBlocked && modalElements.modalBlocked) {
    modalElements.btnOpenBlocked.addEventListener('click', () => {
        modalElements.modalBlocked.classList.remove('hidden');
    });
}

// 3. Close Modals buttons
document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
        if (modalElements.modalSession) modalElements.modalSession.classList.add('hidden');
        if (modalElements.modalBlocked) modalElements.modalBlocked.classList.add('hidden');
    });
});

// 4. Save Session (Real Database Hook)
if (modalElements.btnSaveSession) {
    modalElements.btnSaveSession.addEventListener('click', async () => {
        const sId = document.getElementById('new-session-student').value;
        const date = document.getElementById('new-session-date').value;
        const time = document.getElementById('new-session-time').value;
        const duration = document.getElementById('new-session-length').value;

        if (!sId || !date || !time) return alert("Please fill in all fields.");

        // Format for the database
        const fullDate = new Date(`${date}T${time}`).toISOString();
        const token = localStorage.getItem('portal_token');

        try {
            const response = await fetch(`${API_URL}/sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                // No tutor_id needed: the server books the session for the logged-in tutor.
                body: JSON.stringify({
                    student_id: parseInt(sId),
                    session_date: fullDate,
                    duration: parseInt(duration),
                    status: 'upcoming'
                })
            });

            if (response.ok) {
                modalElements.modalSession.classList.add('hidden');
                alert("Session officially saved to database!");
                fetchTutorSessions(); // Instantly re-fetches real data and redraws calendar!
            } else {
                const err = await response.json();
                alert(`Failed to save: ${err.error || 'Unknown error'}`);
            }
        } catch (error) {
            alert("Network error. Cannot connect to server.");
        }
    });
}

// 5. Save Unavailability (Real Database Hook)
if (modalElements.btnSaveBlocked) {
    modalElements.btnSaveBlocked.addEventListener('click', async () => {
        const date = document.getElementById('block-date').value;
        const reason = document.getElementById('block-reason').value || "Blocked Time";

        if (!date) return alert("Please select a date.");

        const fullDate = new Date(`${date}T00:00:00`).toISOString();
        const token = localStorage.getItem('portal_token');

        try {
            // We save unavailability as a special session with status 'blocked'
            const response = await fetch(`${API_URL}/sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                // Blocked time has no student. The server ties it to the logged-in tutor.
                body: JSON.stringify({
                    session_date: fullDate,
                    duration: 1440, // 24 hours in minutes
                    status: 'blocked',
                    notes: reason
                })
            });

            if (response.ok) {
                modalElements.modalBlocked.classList.add('hidden');
                alert("Time blocked successfully!");
                fetchTutorSessions(); // Instantly redraws calendar!
            } else {
                const err = await response.json();
                alert(`Failed to block time: ${err.error || 'Unknown error'}`);
            }
        } catch (error) {
            alert("Network error. Cannot connect to server.");
        }
    });
}
