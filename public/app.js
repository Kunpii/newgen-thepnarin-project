/* ═══════════════════════════════════════════════════════════
   app.js — ระบบจัดการโปรเจค
   Dual Mode: LocalStorage (Local) / Fetch API (API Mode)
   ═══════════════════════════════════════════════════════════ */

'use strict';

/* ─── Constants ──────────────────────────────────────────── */
const LS_PROJECTS = 'pm_projects';
const LS_TASKS    = 'pm_tasks';
const API_BASE    = '/api';

// Backend endpoints for projects
const API_PROJECTS        = `${API_BASE}/projects`;
const API_TASKS           = `${API_BASE}/tasks`;
const API_SUMMARY_OVERVIEW = `${API_BASE}/summary/overview`;

const STATUS_LABELS = {
  planning: 'วางแผน', in_progress: 'กำลังดำเนินการ',
  on_hold: 'ระงับชั่วคราว', completed: 'เสร็จสิ้น', cancelled: 'ยกเลิก'
};
const PRIORITY_LABELS = {
  low: 'ต่ำ', medium: 'ปานกลาง', high: 'สูง', critical: 'วิกฤต'
};
const TASK_STATUS_LABELS = {
  todo: 'รอดำเนินการ', in_progress: 'กำลังทำ', review: 'รอตรวจสอบ', done: 'เสร็จแล้ว'
};

/* ─── State ──────────────────────────────────────────────── */
let currentMode = 'api';          // 'api' | 'local'
let projects    = [];             // cached projects
let tasks       = [];             // cached tasks
let editingProjectId = null;      // project being edited
let editingTaskId     = null;     // task being edited in modal
let currentTaskProjectId = null;  // projectId for the open task modal
let toastTimer   = null;
let modalInstance = null;

/* ─── DOM Refs ───────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);

const dom = {};

function cacheDom() {
  dom.modeToggle        = $('modeToggle');
  dom.modeLabelLeft     = $('modeLabelLeft');
  dom.modeLabelRight    = $('modeLabelRight');

  // Summary
  dom.totalProjects      = $('totalProjects');
  dom.inProgressProjects = $('inProgressProjects');
  dom.completedProjects  = $('completedProjects');
  dom.budgetRemaining    = $('budgetRemaining');

  // Filters
  dom.searchInput     = $('searchInput');
  dom.filterStatus    = $('filterStatus');
  dom.filterPriority  = $('filterPriority');
  dom.clearFiltersBtn = $('clearFiltersBtn');

  // Project form
  dom.projectForm         = $('projectForm');
  dom.projectName         = $('projectName');
  dom.projectDesc         = $('projectDesc');
  dom.projectStatus       = $('projectStatus');
  dom.projectPriority     = $('projectPriority');
  dom.projectCategory     = $('projectCategory');
  dom.projectStartDate    = $('projectStartDate');
  dom.projectDueDate      = $('projectDueDate');
  dom.projectBudget       = $('projectBudget');
  dom.projectProgress     = $('projectProgress');
  dom.projectNote         = $('projectNote');
  dom.editProjectId       = $('editProjectId');
  dom.projectSubmitBtn    = $('projectSubmitBtn');
  dom.projectSubmitText   = $('projectSubmitText');
  dom.projectFormTitle    = $('projectFormTitle');
  dom.cancelProjectEdit   = $('cancelProjectEdit');

  // Tags
  dom.tagInput  = $('tagInput');
  dom.tagList   = $('tagList');
  dom.tagWrapper = $('tagWrapper');

  // Project list
  dom.projectList   = $('projectList');
  dom.projectCount  = $('projectCount');
  dom.emptyState    = $('emptyState');

  // Task modal
  dom.taskModal            = $('taskModal');
  dom.taskModalProjectName = $('taskModalProjectName');
  dom.taskForm             = $('taskForm');
  dom.taskFormTitle        = $('taskFormTitle');
  dom.taskTitle            = $('taskTitle');
  dom.taskDesc             = $('taskDesc');
  dom.taskStatus           = $('taskStatus');
  dom.taskPriority         = $('taskPriority');
  dom.taskAssignee         = $('taskAssignee');
  dom.taskDueDate          = $('taskDueDate');
  dom.editTaskId           = $('editTaskId');
  dom.taskProjectId        = $('taskProjectId');
  dom.taskSubmitBtn        = $('taskSubmitBtn');
  dom.taskSubmitText       = $('taskSubmitText');
  dom.cancelTaskEdit       = $('cancelTaskEdit');
  dom.taskList             = $('taskList');
  dom.taskEmptyState       = $('taskEmptyState');
  dom.taskCountDisplay     = $('taskCountDisplay');

  // Toast
  dom.toastContainer = document.querySelector('.toast-container');
}

/* ─── Utility Functions ──────────────────────────────────── */
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function isoNow() { return new Date().toISOString(); }
function todayStr() { return new Date().toISOString().slice(0, 10); }

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatCurrency(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function getStatusClass(status, type = 'project') {
  if (type === 'project') return `status-${status}`;
  return `ts-${status}`;
}

function getPriorityClass(priority) {
  return `priority-${priority}`;
}

function statusBadge(status, type = 'project') {
  const labels = type === 'project' ? STATUS_LABELS : TASK_STATUS_LABELS;
  const label = labels[status] || status;
  return `<span class="badge badge-status ${getStatusClass(status, type)}">${label}</span>`;
}

function priorityBadge(priority) {
  return `<span class="badge badge-priority ${getPriorityClass(priority)}">${PRIORITY_LABELS[priority] || priority}</span>`;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

/* ─── Toast Notifications ────────────────────────────────── */
function showToast(message, type = 'success') {
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }

  const bgMap = { success: 'bg-success', error: 'bg-danger', warning: 'bg-warning text-dark', info: 'bg-info' };
  const iconMap = { success: 'bi-check-circle-fill', error: 'bi-x-circle-fill', warning: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill' };

  const toast = document.createElement('div');
  toast.className = `toast align-items-center text-white ${bgMap[type] || 'bg-success'} border-0 show`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        <i class="bi ${iconMap[type] || 'bi-check-circle-fill'} me-2"></i> ${escapeHtml(message)}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>`;
  dom.toastContainer.appendChild(toast);

  if (window.bootstrap && window.bootstrap.Toast) {
    const bsToast = new window.bootstrap.Toast(toast, { autohide: true, delay: 3000 });
    bsToast.show();
    toast.addEventListener('hidden.bs.toast', () => toast.remove());
  } else {
    toastTimer = setTimeout(() => { toast.remove(); toastTimer = null; }, 3000);
  }
}

/* ────────────────────────────────────────────────────────────
   MODE: API Client
   ──────────────────────────────────────────────────────────── */
async function apiRequest(method, url, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== null) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const json = await res.json();

  if (!res.ok) {
    const errMsg = json?.error?.message || `HTTP ${res.status}`;
    throw new Error(errMsg);
  }
  return json;
}

/* ────────────────────────────────────────────────────────────
   MODE: LocalStorage Operations
   ──────────────────────────────────────────────────────────── */
function lsGetAll(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function lsSet(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function lsCreate(key, item) {
  const all = lsGetAll(key);
  all.push(item);
  lsSet(key, all);
  return item;
}

function lsUpdate(key, id, updates) {
  const all = lsGetAll(key);
  const idx = all.findIndex((x) => x.id === id);
  if (idx === -1) throw new Error('ไม่พบข้อมูลที่ร้องขอ');
  Object.assign(all[idx], updates, { updatedAt: isoNow() });
  lsSet(key, all);
  return all[idx];
}

function lsRemove(key, id) {
  let all = lsGetAll(key);
  all = all.filter((x) => x.id !== id);
  lsSet(key, all);
}

function lsGetById(key, id) {
  const all = lsGetAll(key);
  return all.find((x) => x.id === id) || null;
}

/* ────────────────────────────────────────────────────────────
   DATA LOADING
   ──────────────────────────────────────────────────────────── */
async function loadData() {
  if (currentMode === 'local') {
    projects = lsGetAll(LS_PROJECTS);
    tasks = lsGetAll(LS_TASKS);
    renderAll();
    return;
  }

  // API Mode: fetch from backend, then save to localStorage
  try {
    const [projRes, taskRes] = await Promise.all([
      apiRequest('GET', API_PROJECTS),
      apiRequest('GET', `${API_BASE}/projects/all-tasks`).catch(() => apiRequest('GET', `${API_TASKS}?all=true`).catch(() => ({ data: [] })))
    ]);

    // Try to get tasks via projects:projectId/tasks for all projects
    let allTasks = [];
    if (taskRes?.data) {
      allTasks = taskRes.data;
    } else if (projRes?.data) {
      // Fallback: try fetching tasks for each project
      const taskPromises = projRes.data.map(p =>
        apiRequest('GET', `${API_PROJECTS}/${p.id}/tasks`).catch(() => ({ data: [] }))
      );
      const taskResults = await Promise.all(taskPromises);
      allTasks = taskResults.flatMap(r => r.data || []);
    }

    projects = projRes?.data || [];
    tasks = allTasks;

    // Persist to LocalStorage
    lsSet(LS_PROJECTS, projects);
    lsSet(LS_TASKS, tasks);

    renderAll();
  } catch (err) {
    console.warn('API fetch failed, falling back to LocalStorage:', err);
    projects = lsGetAll(LS_PROJECTS);
    tasks = lsGetAll(LS_TASKS);
    renderAll();
    showToast(`โหลดข้อมูลจาก API ไม่สำเร็จ ใช้ข้อมูลในเครื่องแทน: ${err.message}`, 'warning');
  }
}

/* ────────────────────────────────────────────────────────────
   SUMMARY CALCULATION
   ──────────────────────────────────────────────────────────── */
function calcSummary() {
  const total = projects.length;
  const inProgress = projects.filter(p => p.status === 'in_progress').length;
  const completed = projects.filter(p => p.status === 'completed').length;
  const totalBudget = projects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
  const totalSpent = projects.reduce((sum, p) => sum + (Number(p.spentAmount) || 0), 0);
  const budgetRemaining = totalBudget - totalSpent;

  return { total, inProgress, completed, totalBudget, totalSpent, budgetRemaining };
}

function renderSummary() {
  const s = calcSummary();
  dom.totalProjects.textContent = s.total;
  dom.inProgressProjects.textContent = s.inProgress;
  dom.completedProjects.textContent = s.completed;
  dom.budgetRemaining.innerHTML = `${formatCurrency(s.budgetRemaining)} <small>บาท</small>`;
}

/* ────────────────────────────────────────────────────────────
   TAGS HANDLING
   ──────────────────────────────────────────────────────────── */
let currentTags = [];

function renderTags() {
  dom.tagList.innerHTML = currentTags.map((tag, i) =>
    `<span class="tag-badge">${escapeHtml(tag)}<span class="tag-remove" data-index="${i}">&times;</span></span>`
  ).join('');

  // Attach remove handlers
  dom.tagList.querySelectorAll('.tag-remove').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.index, 10);
      currentTags.splice(idx, 1);
      renderTags();
    });
  });
}

function addTag(tag) {
  const t = tag.trim();
  if (!t) return;
  if (currentTags.length >= 10) { showToast('แท็กได้สูงสุด 10 แท็ก', 'warning'); return; }
  if (currentTags.includes(t)) { showToast('แท็กนี้มีอยู่แล้ว', 'warning'); return; }
  if (t.length > 30) { showToast('แท็กต้องไม่เกิน 30 ตัวอักษร', 'warning'); return; }
  currentTags.push(t);
  renderTags();
}

/* ────────────────────────────────────────────────────────────
   PROJECT CRUD
   ──────────────────────────────────────────────────────────── */
function getProjectFormData() {
  const name = dom.projectName.value.trim();
  if (!name) { showToast('กรุณากรอกชื่อโปรเจค', 'error'); return null; }

  return {
    name,
    description: dom.projectDesc.value.trim(),
    status: dom.projectStatus.value,
    priority: dom.projectPriority.value,
    category: dom.projectCategory.value.trim(),
    startDate: dom.projectStartDate.value || null,
    dueDate: dom.projectDueDate.value || null,
    budget: Number(dom.projectBudget.value) || 0,
    progress: clamp(Number(dom.projectProgress.value) || 0, 0, 100),
    tags: [...currentTags],
    note: dom.projectNote.value.trim(),
    spentAmount: 0,
  };
}

function fillProjectForm(project) {
  dom.projectName.value = project.name || '';
  dom.projectDesc.value = project.description || '';
  dom.projectStatus.value = project.status || 'planning';
  dom.projectPriority.value = project.priority || 'medium';
  dom.projectCategory.value = project.category || '';
  dom.projectStartDate.value = project.startDate || '';
  dom.projectDueDate.value = project.dueDate || '';
  dom.projectBudget.value = project.budget || 0;
  dom.projectProgress.value = project.progress || 0;
  currentTags = [...(project.tags || [])];
  renderTags();
  dom.projectNote.value = project.note || '';
}

function resetProjectForm() {
  dom.projectForm.reset();
  dom.editProjectId.value = '';
  editingProjectId = null;
  currentTags = [];
  renderTags();
  dom.projectFormTitle.textContent = 'สร้างโปรเจคใหม่';
  dom.projectSubmitText.textContent = 'สร้างโปรเจค';
  dom.cancelProjectEdit.classList.add('d-none');
  dom.projectSubmitBtn.classList.remove('btn-warning');
  dom.projectSubmitBtn.classList.add('btn-primary');
}

async function handleProjectSubmit(e) {
  e.preventDefault();

  // Validate required
  if (!dom.projectName.value.trim()) {
    dom.projectName.classList.add('is-invalid');
    dom.projectName.focus();
    return;
  }
  dom.projectName.classList.remove('is-invalid');

  const data = getProjectFormData();
  if (!data) return;

  const editId = dom.editProjectId.value;

  if (editId) {
    // UPDATE
    const oldProject = projects.find(p => p.id === editId);
    if (!oldProject) { showToast('ไม่พบโปรเจคที่ต้องการแก้ไข', 'error'); return; }

    // Optimistic update
    const updatedProject = { ...oldProject, ...data, updatedAt: isoNow() };
    const oldProjects = [...projects];
    projects = projects.map(p => p.id === editId ? updatedProject : p);
    renderAll();

    try {
      if (currentMode === 'local') {
        lsUpdate(LS_PROJECTS, editId, data);
      } else {
        await apiRequest('PUT', `${API_PROJECTS}/${editId}`, data);
        lsSet(LS_PROJECTS, projects); // sync back
      }
      showToast('แก้ไขโปรเจคสำเร็จ', 'success');
    } catch (err) {
      // Rollback
      projects = oldProjects;
      renderAll();
      showToast(`แก้ไขโปรเจคล้มเหลว: ${err.message}`, 'error');
    }

    resetProjectForm();
  } else {
    // CREATE
    const newProject = {
      id: uuidv4(),
      ...data,
      completedDate: data.status === 'completed' ? isoNow() : null,
      createdAt: isoNow(),
      updatedAt: isoNow(),
    };

    const oldProjects = [...projects];
    projects = [newProject, ...projects];
    renderAll();

    try {
      if (currentMode === 'local') {
        lsCreate(LS_PROJECTS, newProject);
      } else {
        await apiRequest('POST', API_PROJECTS, data);
        lsSet(LS_PROJECTS, projects);
      }
      showToast('สร้างโปรเจคสำเร็จ', 'success');
    } catch (err) {
      projects = oldProjects;
      renderAll();
      showToast(`สร้างโปรเจคล้มเหลว: ${err.message}`, 'error');
    }

    resetProjectForm();
  }
}

function startEditProject(id) {
  const project = projects.find(p => p.id === id);
  if (!project) return;

  editingProjectId = id;
  dom.editProjectId.value = id;
  fillProjectForm(project);
  dom.projectFormTitle.textContent = 'แก้ไขโปรเจค';
  dom.projectSubmitText.textContent = 'บันทึกการแก้ไข';
  dom.cancelProjectEdit.classList.remove('d-none');
  dom.projectSubmitBtn.classList.remove('btn-primary');
  dom.projectSubmitBtn.classList.add('btn-warning');

  // Scroll to form
  dom.projectForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function deleteProject(id) {
  if (!confirm('คุณแน่ใจที่จะลบโปรเจคนี้? (Task ที่เกี่ยวข้องจะถูกลบทั้งหมด)')) return;

  const oldProjects = [...projects];
  const oldTasks = [...tasks];

  // Optimistic
  projects = projects.filter(p => p.id !== id);
  tasks = tasks.filter(t => t.projectId !== id);
  renderAll();

  try {
    if (currentMode === 'local') {
      lsRemove(LS_PROJECTS, id);
      // Remove associated tasks
      const allTasks = lsGetAll(LS_TASKS);
      lsSet(LS_TASKS, allTasks.filter(t => t.projectId !== id));
    } else {
      await apiRequest('DELETE', `${API_PROJECTS}/${id}`);
      lsSet(LS_PROJECTS, projects);
      lsSet(LS_TASKS, tasks);
    }
    showToast('ลบโปรเจคสำเร็จ', 'success');
  } catch (err) {
    projects = oldProjects;
    tasks = oldTasks;
    renderAll();
    showToast(`ลบโปรเจคล้มเหลว: ${err.message}`, 'error');
  }

  // If modal is open for this project, close it
  if (currentTaskProjectId === id) {
    modalInstance?.hide();
  }
}

/* ────────────────────────────────────────────────────────────
   RENDER PROJECT LIST
   ──────────────────────────────────────────────────────────── */
function renderProjectList() {
  const search = dom.searchInput.value.toLowerCase().trim();
  const statusFilter = dom.filterStatus.value;
  const priorityFilter = dom.filterPriority.value;

  let filtered = [...projects];

  if (search) {
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(search) ||
      (p.description || '').toLowerCase().includes(search) ||
      (p.category || '').toLowerCase().includes(search)
    );
  }
  if (statusFilter !== 'all') {
    filtered = filtered.filter(p => p.status === statusFilter);
  }
  if (priorityFilter !== 'all') {
    filtered = filtered.filter(p => p.priority === priorityFilter);
  }

  dom.projectCount.textContent = filtered.length;

  if (filtered.length === 0) {
    dom.projectList.innerHTML = '';
    dom.emptyState.classList.remove('d-none');
    return;
  }
  dom.emptyState.classList.add('d-none');

  dom.projectList.innerHTML = filtered.map(p => {
    const budgetPct = p.budget > 0 ? Math.min(100, ((p.spentAmount || 0) / p.budget) * 100) : 0;
    const budgetWarning = p.spentAmount > p.budget ? 'text-danger' : 'text-muted';
    const daysLeft = p.dueDate ? Math.ceil((new Date(p.dueDate) - new Date()) / (1000 * 60 * 60 * 24)) : null;

    return `
      <div class="project-card card mb-3">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div class="flex-grow-1 me-2">
              <div class="project-name">${escapeHtml(p.name)}</div>
              ${p.description ? `<div class="project-desc">${escapeHtml(p.description)}</div>` : ''}
            </div>
            <div class="d-flex gap-1 flex-shrink-0">
              ${statusBadge(p.status)}
              ${priorityBadge(p.priority)}
            </div>
          </div>

          <!-- Progress Bar -->
          <div class="mb-2">
            <div class="d-flex justify-content-between small mb-1">
              <span class="text-muted">ความคืบหน้า</span>
              <span class="fw-medium">${clamp(p.progress, 0, 100)}%</span>
            </div>
            <div class="progress progress-thin">
              <div class="progress-bar ${p.progress >= 100 ? 'bg-success' : 'bg-primary'}" 
                   role="progressbar" style="width: ${clamp(p.progress, 0, 100)}%"></div>
            </div>
          </div>

          <!-- Meta info row -->
          <div class="project-meta d-flex flex-wrap gap-3 mt-2">
            ${p.category ? `<span><i class="bi bi-tag"></i>${escapeHtml(p.category)}</span>` : ''}
            ${p.startDate ? `<span><i class="bi bi-calendar-check"></i>${formatDate(p.startDate)}</span>` : ''}
            ${p.dueDate ? `<span><i class="bi bi-calendar-event"></i>${formatDate(p.dueDate)}${daysLeft !== null ? ` (${daysLeft >= 0 ? daysLeft : 0} วัน)` : ''}</span>` : ''}
            <span class="${budgetWarning}"><i class="bi bi-cash"></i>${formatCurrency(p.spentAmount || 0)} / ${formatCurrency(p.budget)} บาท</span>
          </div>

          <!-- Tags -->
          ${(p.tags && p.tags.length > 0) ? `
            <div class="d-flex flex-wrap gap-1 mt-2">
              ${p.tags.map(t => `<span class="tag-badge">${escapeHtml(t)}</span>`).join('')}
            </div>` : ''}

          <!-- Actions -->
          <div class="d-flex gap-2 mt-3 pt-2 border-top">
            <button class="btn btn-outline-primary btn-sm btn-action edit-project" data-id="${p.id}">
              <i class="bi bi-pencil"></i> แก้ไข
            </button>
            <button class="btn btn-outline-info btn-sm btn-action manage-tasks" data-id="${p.id}">
              <i class="bi bi-list-check"></i> จัดการ Task
            </button>
            <button class="btn btn-outline-danger btn-sm btn-action delete-project" data-id="${p.id}">
              <i class="bi bi-trash"></i> ลบ
            </button>
          </div>
        </div>
      </div>`;
  }).join('');

  // Attach event handlers
  dom.projectList.querySelectorAll('.edit-project').forEach(btn => {
    btn.addEventListener('click', () => startEditProject(btn.dataset.id));
  });
  dom.projectList.querySelectorAll('.manage-tasks').forEach(btn => {
    btn.addEventListener('click', () => openTaskModal(btn.dataset.id));
  });
  dom.projectList.querySelectorAll('.delete-project').forEach(btn => {
    btn.addEventListener('click', () => deleteProject(btn.dataset.id));
  });
}

/* ────────────────────────────────────────────────────────────
   TASK CRUD
   ──────────────────────────────────────────────────────────── */
function getTaskFormData() {
  const title = dom.taskTitle.value.trim();
  if (!title) { showToast('กรุณากรอกชื่องาน', 'error'); return null; }

  return {
    title,
    description: dom.taskDesc.value.trim(),
    status: dom.taskStatus.value,
    priority: dom.taskPriority.value,
    assignee: dom.taskAssignee.value.trim(),
    dueDate: dom.taskDueDate.value || null,
  };
}

function fillTaskForm(task) {
  dom.taskTitle.value = task.title || '';
  dom.taskDesc.value = task.description || '';
  dom.taskStatus.value = task.status || 'todo';
  dom.taskPriority.value = task.priority || 'medium';
  dom.taskAssignee.value = task.assignee || '';
  dom.taskDueDate.value = task.dueDate || '';
}

function resetTaskForm() {
  dom.taskForm.reset();
  dom.editTaskId.value = '';
  editingTaskId = null;
  dom.taskFormTitle.innerHTML = '<i class="bi bi-plus-circle me-1"></i> เพิ่ม Task ใหม่';
  dom.taskSubmitText.textContent = 'เพิ่ม Task';
  dom.cancelTaskEdit.classList.add('d-none');
}

async function handleTaskSubmit(e) {
  e.preventDefault();
  if (!currentTaskProjectId) return;

  if (!dom.taskTitle.value.trim()) {
    dom.taskTitle.classList.add('is-invalid');
    dom.taskTitle.focus();
    return;
  }
  dom.taskTitle.classList.remove('is-invalid');

  const data = getTaskFormData();
  if (!data) return;

  const editId = dom.editTaskId.value;

  if (editId) {
    // UPDATE
    const oldTask = tasks.find(t => t.id === editId);
    if (!oldTask) { showToast('ไม่พบ Task ที่ต้องการแก้ไข', 'error'); return; }

    const updatedTask = { ...oldTask, ...data, updatedAt: isoNow() };
    const oldTasks = [...tasks];
    tasks = tasks.map(t => t.id === editId ? updatedTask : t);
    renderTaskList();
    syncProjectProgress(currentTaskProjectId);

    try {
      if (currentMode === 'local') {
        lsUpdate(LS_TASKS, editId, data);
      } else {
        await apiRequest('PUT', `${API_TASKS}/${editId}`, data);
        lsSet(LS_TASKS, tasks);
      }
      showToast('แก้ไข Task สำเร็จ', 'success');
    } catch (err) {
      tasks = oldTasks;
      renderTaskList();
      syncProjectProgress(currentTaskProjectId);
      showToast(`แก้ไข Task ล้มเหลว: ${err.message}`, 'error');
    }

    resetTaskForm();
  } else {
    // CREATE
    const newTask = {
      id: uuidv4(),
      projectId: currentTaskProjectId,
      ...data,
      completedDate: data.status === 'done' ? isoNow() : null,
      createdAt: isoNow(),
      updatedAt: isoNow(),
    };

    const oldTasks = [...tasks];
    tasks = [newTask, ...tasks];
    renderTaskList();
    syncProjectProgress(currentTaskProjectId);

    try {
      if (currentMode === 'local') {
        lsCreate(LS_TASKS, newTask);
      } else {
        await apiRequest('POST', `${API_PROJECTS}/${currentTaskProjectId}/tasks`, data);
        lsSet(LS_TASKS, tasks);
      }
      showToast('สร้าง Task สำเร็จ', 'success');
    } catch (err) {
      tasks = oldTasks;
      renderTaskList();
      syncProjectProgress(currentTaskProjectId);
      showToast(`สร้าง Task ล้มเหลว: ${err.message}`, 'error');
    }

    resetTaskForm();
  }
}

function startEditTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  editingTaskId = id;
  dom.editTaskId.value = id;
  fillTaskForm(task);
  dom.taskFormTitle.innerHTML = '<i class="bi bi-pencil me-1"></i> แก้ไข Task';
  dom.taskSubmitText.textContent = 'บันทึก';
  dom.cancelTaskEdit.classList.remove('d-none');
}

async function deleteTask(id) {
  if (!confirm('คุณแน่ใจที่จะลบ Task นี้?')) return;

  const oldTasks = [...tasks];
  tasks = tasks.filter(t => t.id !== id);
  renderTaskList();
  syncProjectProgress(currentTaskProjectId);

  try {
    if (currentMode === 'local') {
      lsRemove(LS_TASKS, id);
    } else {
      await apiRequest('DELETE', `${API_TASKS}/${id}`);
      lsSet(LS_TASKS, tasks);
    }
    showToast('ลบ Task สำเร็จ', 'success');
  } catch (err) {
    tasks = oldTasks;
    renderTaskList();
    syncProjectProgress(currentTaskProjectId);
    showToast(`ลบ Task ล้มเหลว: ${err.message}`, 'error');
  }
}

/* ─── Sync project progress based on tasks ─── */
function syncProjectProgress(projectId) {
  if (!projectId) return;
  const projectTasks = tasks.filter(t => t.projectId === projectId);
  const doneTasks = projectTasks.filter(t => t.status === 'done');
  const progress = projectTasks.length > 0
    ? Math.round((doneTasks.length / projectTasks.length) * 100)
    : 0;

  // Update project progress
  const project = projects.find(p => p.id === projectId);
  if (project) {
    project.progress = clamp(progress, 0, 100);
    project.updatedAt = isoNow();
    // Also update spentAmount from tasks? We'll skip that.
  }

  renderSummary();
  renderProjectList();
  // Persist project changes
  if (currentMode === 'local') {
    lsSet(LS_PROJECTS, projects);
  } else {
    // In API mode, also update the project in LS
    lsSet(LS_PROJECTS, projects);
  }
}

/* ────────────────────────────────────────────────────────────
   RENDER TASK LIST (in modal)
   ──────────────────────────────────────────────────────────── */
function renderTaskList() {
  const projectTasks = tasks.filter(t => t.projectId === currentTaskProjectId);
  dom.taskCountDisplay.textContent = `${projectTasks.length} รายการ`;

  if (projectTasks.length === 0) {
    dom.taskList.innerHTML = '';
    dom.taskEmptyState.classList.remove('d-none');
    return;
  }
  dom.taskEmptyState.classList.add('d-none');

  dom.taskList.innerHTML = projectTasks.map(t => `
    <div class="task-item mb-2">
      <div class="d-flex justify-content-between align-items-start">
        <div class="flex-grow-1 me-2">
          <div class="task-title">${escapeHtml(t.title)}</div>
          ${t.description ? `<div class="task-meta mt-1">${escapeHtml(t.description)}</div>` : ''}
          <div class="d-flex flex-wrap gap-2 mt-1">
            ${statusBadge(t.status, 'task')}
            ${priorityBadge(t.priority)}
            ${t.assignee ? `<span class="task-meta"><i class="bi bi-person"></i> ${escapeHtml(t.assignee)}</span>` : ''}
            ${t.dueDate ? `<span class="task-meta"><i class="bi bi-calendar"></i> ${formatDate(t.dueDate)}</span>` : ''}
          </div>
        </div>
        <div class="task-actions d-flex gap-1 flex-shrink-0">
          <button class="btn btn-outline-primary edit-task" data-id="${t.id}" title="แก้ไข">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-outline-danger delete-task" data-id="${t.id}" title="ลบ">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    </div>
  `).join('');

  // Attach event handlers
  dom.taskList.querySelectorAll('.edit-task').forEach(btn => {
    btn.addEventListener('click', () => startEditTask(btn.dataset.id));
  });
  dom.taskList.querySelectorAll('.delete-task').forEach(btn => {
    btn.addEventListener('click', () => deleteTask(btn.dataset.id));
  });
}

/* ────────────────────────────────────────────────────────────
   TASK MODAL
   ──────────────────────────────────────────────────────────── */
function openTaskModal(projectId) {
  const project = projects.find(p => p.id === projectId);
  if (!project) { showToast('ไม่พบโปรเจค', 'error'); return; }

  currentTaskProjectId = projectId;
  dom.taskModalProjectName.textContent = project.name;
  dom.taskProjectId.value = projectId;
  resetTaskForm();
  renderTaskList();

  if (!modalInstance) {
    modalInstance = new bootstrap.Modal(dom.taskModal);
  }
  modalInstance.show();
}

/* ────────────────────────────────────────────────────────────
   RENDER ALL
   ──────────────────────────────────────────────────────────── */
function renderAll() {
  renderSummary();
  renderProjectList();
}

/* ────────────────────────────────────────────────────────────
   MODE TOGGLE
   ──────────────────────────────────────────────────────────── */
async function toggleMode() {
  const newMode = dom.modeToggle.checked ? 'local' : 'api';
  currentMode = newMode;

  dom.modeLabelLeft.textContent = newMode === 'api' ? '🌐 API' : '🌐 API';
  dom.modeLabelRight.textContent = newMode === 'local' ? '💾 Local' : '💾 Local';

  // If switching to local mode, load from localStorage
  // If switching to API mode, try fetching from API
  showToast(`สลับเป็น ${newMode === 'api' ? 'API' : 'Local'} โหมด`, 'info');
  await loadData();
}

/* ────────────────────────────────────────────────────────────
   INIT
   ──────────────────────────────────────────────────────────── */
async function init() {
  cacheDom();

  // Set today as default start date
  dom.projectStartDate.value = todayStr();

  // Event: Mode toggle
  dom.modeToggle.addEventListener('change', toggleMode);

  // Event: Project form submit
  dom.projectForm.addEventListener('submit', handleProjectSubmit);

  // Event: Cancel project edit
  dom.cancelProjectEdit.addEventListener('click', resetProjectForm);

  // Event: Task form submit
  dom.taskForm.addEventListener('submit', handleTaskSubmit);

  // Event: Cancel task edit
  dom.cancelTaskEdit.addEventListener('click', resetTaskForm);

  // Event: Tag input
  dom.tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(dom.tagInput.value);
      dom.tagInput.value = '';
    }
  });

  // Click on tag wrapper focuses input
  dom.tagWrapper.addEventListener('click', (e) => {
    if (e.target === dom.tagWrapper || e.target === dom.tagList) {
      dom.tagInput.focus();
    }
  });

  // Event: Filters
  dom.searchInput.addEventListener('input', renderProjectList);
  dom.filterStatus.addEventListener('change', renderProjectList);
  dom.filterPriority.addEventListener('change', renderProjectList);

  // Event: Clear filters
  dom.clearFiltersBtn.addEventListener('click', () => {
    dom.searchInput.value = '';
    dom.filterStatus.value = 'all';
    dom.filterPriority.value = 'all';
    renderProjectList();
  });

  // Event: Modal hidden - clean up
  dom.taskModal.addEventListener('hidden.bs.modal', () => {
    resetTaskForm();
    currentTaskProjectId = null;
    renderAll(); // Update progress etc.
  });

  // Check if API is available, otherwise default to local
  try {
    const healthRes = await fetch(`${API_BASE}/health`);
    if (healthRes.ok) {
      currentMode = 'api';
      dom.modeToggle.checked = false;
    } else {
      currentMode = 'local';
      dom.modeToggle.checked = true;
    }
  } catch {
    currentMode = 'local';
    dom.modeToggle.checked = true;
  }

  dom.modeLabelLeft.textContent = currentMode === 'api' ? '🌐 API' : '🌐 API';
  dom.modeLabelRight.textContent = currentMode === 'local' ? '💾 Local' : '💾 Local';

  // Load data
  await loadData();
}

// ─── Start ───
document.addEventListener('DOMContentLoaded', init);