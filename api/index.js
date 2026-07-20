const express = require('express');
const cors = require('cors');

const app = express();

// ─── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── In-Memory Data Store ────────────────────────────────────
// Note: In Vercel Serverless, this resets on each cold start.
// The frontend (client-side LocalStorage) is the true Source of Truth.
const projects = [];
const tasks = [];
let nextProjectId = 1;
let nextTaskId = 1;

// ─── Helper: Generate ISO 8601 timestamp ────────────────────
const timestamp = () => new Date().toISOString();

// ─── Helper: UUID for compatibility with frontend ────────────
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── Validation Helpers ─────────────────────────────────────
function validateProject(body, isUpdate = false) {
  const errors = [];
  if (!isUpdate || body.name !== undefined) {
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      errors.push('name is required and must be a non-empty string');
    }
  }
  if (body.status !== undefined && !['planning', 'in_progress', 'on_hold', 'completed', 'cancelled'].includes(body.status)) {
    errors.push('status must be one of: planning, in_progress, on_hold, completed, cancelled');
  }
  if (body.priority !== undefined && !['low', 'medium', 'high', 'critical'].includes(body.priority)) {
    errors.push('priority must be one of: low, medium, high, critical');
  }
  if (body.amount !== undefined && (typeof body.amount !== 'number' || body.amount < 0)) {
    errors.push('budget must be a non-negative number');
  }
  if (body.progress !== undefined && (typeof body.progress !== 'number' || body.progress < 0 || body.progress > 100)) {
    errors.push('progress must be between 0 and 100');
  }
  return errors;
}

function validateTask(body, isUpdate = false) {
  const errors = [];
  if (!isUpdate || body.title !== undefined) {
    if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
      errors.push('title is required and must be a non-empty string');
    }
  }
  if (body.status !== undefined && !['todo', 'in_progress', 'review', 'done'].includes(body.status)) {
    errors.push('status must be one of: todo, in_progress, review, done');
  }
  if (body.priority !== undefined && !['low', 'medium', 'high', 'critical'].includes(body.priority)) {
    errors.push('priority must be one of: low, medium, high, critical');
  }
  return errors;
}

// ─── GET /api/health — Health Check ─────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ══════════════════════════════════════════════════════════════
// PROJECT ENDPOINTS
// ══════════════════════════════════════════════════════════════

// ─── GET /api/projects — List All Projects ──────────────────
app.get('/api/projects', (req, res) => {
  res.json({
    success: true,
    data: projects,
  });
});

// ─── POST /api/projects — Create New Project ────────────────
app.post('/api/projects', (req, res) => {
  const errors = validateProject(req.body);
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: errors.join('; ') },
    });
  }

  const now = timestamp();
  const project = {
    id: uuidv4(),
    name: req.body.name.trim(),
    description: (req.body.description || '').trim(),
    status: req.body.status || 'planning',
    priority: req.body.priority || 'medium',
    category: (req.body.category || '').trim(),
    startDate: req.body.startDate || null,
    dueDate: req.body.dueDate || null,
    budget: Number(req.body.budget) || 0,
    spentAmount: Number(req.body.spentAmount) || 0,
    progress: Number(req.body.progress) || 0,
    tags: req.body.tags || [],
    note: (req.body.note || '').trim(),
    completedDate: req.body.status === 'completed' ? now : null,
    createdAt: now,
    updatedAt: now,
  };

  projects.push(project);

  res.status(201).json({
    success: true,
    data: project,
    message: 'สร้างโปรเจคสำเร็จ',
  });
});

// ─── PUT /api/projects/:id — Update Project ─────────────────
app.put('/api/projects/:id', (req, res) => {
  const { id } = req.params;
  const index = projects.findIndex((p) => p.id === id);

  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'ไม่พบโปรเจคที่ร้องขอ' },
    });
  }

  const errors = validateProject(req.body, true);
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: errors.join('; ') },
    });
  }

  const existing = projects[index];

  if (req.body.name !== undefined) existing.name = req.body.name.trim();
  if (req.body.description !== undefined) existing.description = req.body.description.trim();
  if (req.body.status !== undefined) {
    existing.status = req.body.status;
    if (req.body.status === 'completed' && !existing.completedDate) {
      existing.completedDate = timestamp();
    }
  }
  if (req.body.priority !== undefined) existing.priority = req.body.priority;
  if (req.body.category !== undefined) existing.category = req.body.category.trim();
  if (req.body.startDate !== undefined) existing.startDate = req.body.startDate;
  if (req.body.dueDate !== undefined) existing.dueDate = req.body.dueDate;
  if (req.body.budget !== undefined) existing.budget = Number(req.body.budget);
  if (req.body.spentAmount !== undefined) existing.spentAmount = Number(req.body.spentAmount);
  if (req.body.progress !== undefined) existing.progress = Number(req.body.progress);
  if (req.body.tags !== undefined) existing.tags = req.body.tags;
  if (req.body.note !== undefined) existing.note = req.body.note.trim();
  existing.updatedAt = timestamp();

  res.json({
    success: true,
    data: existing,
    message: 'แก้ไขโปรเจคสำเร็จ',
  });
});

// ─── DELETE /api/projects/:id — Delete Project ──────────────
app.delete('/api/projects/:id', (req, res) => {
  const { id } = req.params;
  const index = projects.findIndex((p) => p.id === id);

  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'ไม่พบโปรเจคที่ร้องขอ' },
    });
  }

  // Also delete associated tasks
  const projectId = projects[index].id;
  for (let i = tasks.length - 1; i >= 0; i--) {
    if (tasks[i].projectId === projectId) {
      tasks.splice(i, 1);
    }
  }

  projects.splice(index, 1);

  res.json({
    success: true,
    message: 'ลบโปรเจคสำเร็จ',
  });
});

// ══════════════════════════════════════════════════════════════
// TASK ENDPOINTS (under projects)
// ══════════════════════════════════════════════════════════════

// ─── GET /api/projects/:id/tasks — List Tasks for a Project ─
app.get('/api/projects/:id/tasks', (req, res) => {
  const { id } = req.params;
  const project = projects.find((p) => p.id === id);
  if (!project) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'ไม่พบโปรเจคที่ร้องขอ' },
    });
  }

  const projectTasks = tasks.filter((t) => t.projectId === id);
  res.json({
    success: true,
    data: projectTasks,
  });
});

// ─── POST /api/projects/:id/tasks — Create Task for a Project ─
app.post('/api/projects/:id/tasks', (req, res) => {
  const { id } = req.params;
  const project = projects.find((p) => p.id === id);
  if (!project) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'ไม่พบโปรเจคที่ร้องขอ' },
    });
  }

  const errors = validateTask(req.body);
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: errors.join('; ') },
    });
  }

  const now = timestamp();
  const task = {
    id: uuidv4(),
    projectId: id,
    title: req.body.title.trim(),
    description: (req.body.description || '').trim(),
    status: req.body.status || 'todo',
    priority: req.body.priority || 'medium',
    assignee: (req.body.assignee || '').trim(),
    dueDate: req.body.dueDate || null,
    completedDate: req.body.status === 'done' ? now : null,
    createdAt: now,
    updatedAt: now,
  };

  tasks.push(task);

  res.status(201).json({
    success: true,
    data: task,
    message: 'สร้าง Task สำเร็จ',
  });
});

// ══════════════════════════════════════════════════════════════
// TASK ENDPOINTS (standalone)
// ══════════════════════════════════════════════════════════════

// ─── GET /api/tasks — List All Tasks (with optional filter) ─
app.get('/api/tasks', (req, res) => {
  // If ?all=true is passed, return all tasks
  if (req.query.all === 'true') {
    return res.json({
      success: true,
      data: tasks,
    });
  }

  // Otherwise filter by projectId if provided
  const projectId = req.query.projectId;
  if (projectId) {
    const filtered = tasks.filter((t) => t.projectId === projectId);
    return res.json({
      success: true,
      data: filtered,
    });
  }

  res.json({
    success: true,
    data: tasks,
  });
});

// ─── PUT /api/tasks/:id — Update Task ─────────────────────
app.put('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const index = tasks.findIndex((t) => t.id === id);

  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'ไม่พบ Task ที่ร้องขอ' },
    });
  }

  const errors = validateTask(req.body, true);
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: errors.join('; ') },
    });
  }

  const existing = tasks[index];

  if (req.body.title !== undefined) existing.title = req.body.title.trim();
  if (req.body.description !== undefined) existing.description = req.body.description.trim();
  if (req.body.status !== undefined) {
    existing.status = req.body.status;
    if (req.body.status === 'done' && !existing.completedDate) {
      existing.completedDate = timestamp();
    }
  }
  if (req.body.priority !== undefined) existing.priority = req.body.priority;
  if (req.body.assignee !== undefined) existing.assignee = req.body.assignee.trim();
  if (req.body.dueDate !== undefined) existing.dueDate = req.body.dueDate;
  existing.updatedAt = timestamp();

  res.json({
    success: true,
    data: existing,
    message: 'แก้ไข Task สำเร็จ',
  });
});

// ─── DELETE /api/tasks/:id — Delete Task ──────────────────
app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const index = tasks.findIndex((t) => t.id === id);

  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'ไม่พบ Task ที่ร้องขอ' },
    });
  }

  tasks.splice(index, 1);

  res.json({
    success: true,
    message: 'ลบ Task สำเร็จ',
  });
});

// ─── GET /api/projects/all-tasks — Get All Tasks (legacy support) ─
app.get('/api/projects/all-tasks', (req, res) => {
  res.json({
    success: true,
    data: tasks,
  });
});

// ─── 404 Handler for unknown routes ─────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `ไม่พบ endpoint: ${req.method} ${req.originalUrl}`,
    },
  });
});

// ─── Global Error Handler ───────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'SERVER_ERROR',
      message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์',
    },
  });
});

// ─── Export for Vercel Serverless ───────────────────────────
module.exports = app;