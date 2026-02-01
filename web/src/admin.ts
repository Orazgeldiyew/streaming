import { fetchAdminSummary, AdminSummaryResponse } from "./api";
import { qs } from "./ui";

/**
 * Renders the Admin Login Page
 */
export function mountLoginPage() {
  const app = document.getElementById("app");
  if (!app) throw new Error("Missing #app");

  app.innerHTML = `
    <div class="admin-container">
      <div class="login-overlay">
        <div class="login-card glass">
          <h2>Admin Login</h2>
          <p>Please enter your credentials to access the dashboard.</p>
          <div class="input-group">
            <label>Username</label>
            <input type="text" id="adminUser" placeholder="admin" autofocus />
          </div>
          <div class="input-group">
            <label>Password</label>
            <input type="password" id="adminPass" placeholder="••••••••" />
          </div>
          <button id="loginBtn" class="primary-btn">Sign In</button>
          <div id="loginError" class="error-text"></div>
        </div>
      </div>
    </div>
  `;

  initLogin();
}

/**
 * Renders the Admin Dashboard Page
 */
export function mountDashboardPage() {
  const app = document.getElementById("app");
  if (!app) throw new Error("Missing #app");

  const storedAuth = sessionStorage.getItem("adminAuth");
  if (!storedAuth) {
    // Redirect to login if not authenticated
    window.history.replaceState({}, "", "/admin/login");
    mountLoginPage();
    return;
  }

  app.innerHTML = `
    <div class="admin-container">
      <nav class="admin-nav">
        <div class="logo">LiveKit <span>Admin</span></div>
        <button id="logoutBtn" class="logout-btn">Logout</button>
      </nav>
      
      <main class="admin-content">
        <header class="admin-header">
          <h1>Dashboard Overview</h1>
        </header>

        <div id="adminStatus" class="admin-status"></div>

        <div id="statsGrid" class="stats-grid">
          <!-- Stats cards will be injected here -->
        </div>

        <section class="admin-section">
          <h2>Teaching Activity</h2>
          <div class="card glass">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Teacher Name</th>
                  <th>Lessons Conducted</th>
                  <th>Activity Level</th>
                </tr>
              </thead>
              <tbody id="teacherTableBody">
                <!-- Teacher rows will be injected here -->
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  `;

  initDashboard(storedAuth);
}

function initLogin() {
  const loginBtn = qs<HTMLButtonElement>("#loginBtn");
  const loginError = qs("#loginError");

  loginBtn.onclick = async () => {
    const user = qs<HTMLInputElement>("#adminUser").value;
    const pass = qs<HTMLInputElement>("#adminPass").value;
    const auth = btoa(`${user}:${pass}`);

    loginError.textContent = "Verifying...";

    try {
      // Verify credentials by attempting to load data
      await fetchAdminSummary(auth);
      sessionStorage.setItem("adminAuth", auth);

      // Redirect to dashboard
      window.history.pushState({}, "", "/admin/dashboard");
      mountDashboardPage();
    } catch (e: any) {
      console.error("Login failed:", e);
      loginError.textContent = "Invalid credentials or server error.";
    }
  };

  // Allow Enter key to login
  const inputs = document.querySelectorAll(".input-group input");
  inputs.forEach((input) => {
    input.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Enter") loginBtn.click();
    });
  });
}

function initDashboard(auth: string) {
  const logoutBtn = qs<HTMLButtonElement>("#logoutBtn");

  logoutBtn.onclick = () => {
    sessionStorage.removeItem("adminAuth");
    window.history.pushState({}, "", "/admin/login");
    mountLoginPage();
  };

  loadDashboard(auth);
}

async function loadDashboard(auth: string) {
  const statusEl = qs("#adminStatus");
  statusEl.textContent = "Loading statistics...";

  try {
    console.log("Fetching admin summary...");
    const data = await fetchAdminSummary(auth);
    console.log("Admin summary received:", data);

    if (!data) {
      throw new Error("No data received from API");
    }

    renderStats(data);
    statusEl.textContent = "";
  } catch (e: any) {
    console.error("Dashboard load failed:", e);
    if (e.message === "Unauthorized") {
      sessionStorage.removeItem("adminAuth");
      window.history.replaceState({}, "", "/admin/login");
      mountLoginPage();
    } else {
      statusEl.textContent = "Error loading data: " + e.message;
    }
  }
}

function renderStats(data: AdminSummaryResponse) {
  console.log("Rendering stats...");
  const statsGrid = document.getElementById("statsGrid");
  const tableBody = document.getElementById("teacherTableBody");

  if (!statsGrid || !tableBody) {
    console.error("Critical: Stats elements not found in DOM");
    return;
  }

  const totalLessons = data.total_lessons ?? 0;
  const totalMinutes = data.total_minutes ?? 0;
  const teachers = data.teachers ?? [];

  statsGrid.innerHTML = `
    <div class="stat-card glass purple">
      <div class="stat-icon">📚</div>
      <div class="stat-info">
        <div class="stat-value">${totalLessons}</div>
        <div class="stat-label">Total Lessons</div>
      </div>
    </div>
    <div class="stat-card glass blue">
      <div class="stat-icon">⏱️</div>
      <div class="stat-info">
        <div class="stat-value">${totalMinutes}</div>
        <div class="stat-label">Total Minutes</div>
      </div>
    </div>
    <div class="stat-card glass green">
      <div class="stat-icon">👨‍🏫</div>
      <div class="stat-info">
        <div class="stat-value">${teachers.length}</div>
        <div class="stat-label">Active Teachers</div>
      </div>
    </div>
  `;

  if (teachers.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="3" class="empty-msg">No teaching activity recorded yet.</td></tr>`;
    return;
  }

  tableBody.innerHTML = teachers
    .map((t) => {
      const lessons = t.lessons ?? 0;
      const level = lessons > 10 ? "High" : lessons > 2 ? "Medium" : "Low";
      const levelClass = level.toLowerCase();
      return `
        <tr>
          <td class="teacher-name">${t.teacher || "Unknown"}</td>
          <td><span class="count-badge">${lessons} lessons</span></td>
          <td><span class="level-pill ${levelClass}">${level}</span></td>
        </tr>
      `;
    })
    .join("");
  console.log("Stats rendered successfully");
}
