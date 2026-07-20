const express = require('express');
const cors = require('cors');

const app = express();

// ─── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── In-Memory Data Store (simulates LocalStorage) ──────────
// Note: In Vercel Serverless, this resets on each cold start.
// The frontend (client-side LocalStorage) is the true Source of Truth.
const transactions = [];
let nextId = 1;

// ─── Helper: Generate ISO 8601 timestamp ────────────────────
const timestamp = () => new Date().toISOString();

// ─── Validation Helper ──────────────────────────────────────
function validateTransaction(body, isUpdate = false) {
  const errors = [];

  if (!isUpdate || body.type !== undefined) {
    if (!body.type || !['income', 'expense'].includes(body.type)) {
      errors.push('type must be "income" or "expense"');
    }
  }

  if (!isUpdate || body.amount !== undefined) {
    if (body.amount === undefined || body.amount === null) {
      errors.push('amount is required');
    } else if (typeof body.amount !== 'number' || body.amount < 0) {
      errors.push('amount must be a non-negative number');
    }
  }

  if (!isUpdate || body.description !== undefined) {
    if (!body.description || typeof body.description !== 'string' || body.description.trim().length === 0) {
      errors.push('description is required and must be a non-empty string');
    }
  }

  if (!isUpdate || body.category !== undefined) {
    if (!body.category || typeof body.category !== 'string' || body.category.trim().length === 0) {
      errors.push('category is required and must be a non-empty string');
    }
  }

  if (body.date !== undefined && body.date !== null) {
    const parsed = Date.parse(body.date);
    if (isNaN(parsed)) {
      errors.push('date must be a valid ISO 8601 date string');
    }
  }

  return errors;
}

// ─── GET /api/health — Health Check ─────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ─── GET /api/transactions — List All ───────────────────────
app.get('/api/transactions', (req, res) => {
  res.json({
    success: true,
    data: transactions,
  });
});

// ─── POST /api/transactions — Create New ────────────────────
app.post('/api/transactions', (req, res) => {
  const errors = validateTransaction(req.body);
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: errors.join('; '),
      },
    });
  }

  const now = timestamp();
  const transaction = {
    id: String(nextId++),
    type: req.body.type,
    amount: req.body.amount,
    description: req.body.description.trim(),
    category: req.body.category.trim(),
    date: req.body.date || now,
    createdAt: now,
    updatedAt: now,
  };

  transactions.push(transaction);

  res.status(201).json({
    success: true,
    data: transaction,
    message: 'สร้างรายการสำเร็จ',
  });
});

// ─── PUT /api/transactions/:id — Update ─────────────────────
app.put('/api/transactions/:id', (req, res) => {
  const { id } = req.params;
  const index = transactions.findIndex((t) => t.id === id);

  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'ไม่พบรายการที่ร้องขอ',
      },
    });
  }

  const errors = validateTransaction(req.body, true);
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: errors.join('; '),
      },
    });
  }

  const existing = transactions[index];

  // Only update fields that are provided
  if (req.body.type !== undefined) existing.type = req.body.type;
  if (req.body.amount !== undefined) existing.amount = req.body.amount;
  if (req.body.description !== undefined) existing.description = req.body.description.trim();
  if (req.body.category !== undefined) existing.category = req.body.category.trim();
  if (req.body.date !== undefined) existing.date = req.body.date;
  existing.updatedAt = timestamp();

  res.json({
    success: true,
    data: existing,
    message: 'แก้ไขรายการสำเร็จ',
  });
});

// ─── DELETE /api/transactions/:id — Delete ──────────────────
app.delete('/api/transactions/:id', (req, res) => {
  const { id } = req.params;
  const index = transactions.findIndex((t) => t.id === id);

  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'ไม่พบรายการที่ร้องขอ',
      },
    });
  }

  transactions.splice(index, 1);

  res.json({
    success: true,
    message: 'ลบรายการสำเร็จ',
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