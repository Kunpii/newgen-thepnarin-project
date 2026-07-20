# 📋 SYSTEM_SPEC.md — ระบบจัดการโปรเจค (Project Management System)

> **Document Type**: System Specification
> **Author**: Principal System Architect
> **Version**: 1.0.0
> **Created**: 2026-07-20
> **Status**: Draft — Pending Approval

---

## สารบัญ (Table of Contents)

1. [บทนำ (Introduction)](#1-บทนำ-introduction)
2. [Tech Stack & Constraints](#2-tech-stack--constraints)
3. [Glossary — คำศัพท์สำคัญ](#3-glossary--คำศัพท์สำคัญ)
4. [Data Schema Design](#4-data-schema-design)
5. [API Endpoints Specification](#5-api-endpoints-specification)
6. [Frontend–Backend Integration](#6-frontendbackend-integration)
7. [Vercel Serverless Deployment](#7-vercel-serverless-deployment)
8. [Validation & Business Rules](#8-validation--business-rules)
9. [Security & Limitations](#9-security--limitations)
10. [Architectural Decision Records (ADR)](#10-architectural-decision-records-adr)
11. [Phase Roadmap](#11-phase-roadmap)
12. [Appendix](#12-appendix)

---

## 1. บทนำ (Introduction)

### 1.1 วัตถุประสงค์ (Purpose)

เอกสารฉบับนี้เป็น **System Specification** สำหรับ Mini Project "ระบบจัดการโปรเจค" ซึ่งครอบคลุมการออกแบบโครงสร้างข้อมูล, API, การเชื่อมต่อ Frontend–Backend และแนวทาง Deployment บน Vercel Serverless

### 1.2 ขอบเขตระบบ (Scope)

| ขอบเขต | รายละเอียด |
|---|---|
| **In Scope** | CRUD โปรเจค, CRUD Task (Sub-item), Dashboard สรุปภาพรวม, จัดการสถานะ/ลำดับความสำคัญ, ติดตามงบประมาณ & ความคืบหน้า |
| **Out of Scope** | Authentication/Authorization, Real-time collaboration, File upload, Notification system, Database จริง |

### 1.3 ผู้ใช้งานเป้าหมาย (Target Users)

- นักศึกษา / นักพัฒนาที่ต้องการจัดการโปรเจคส่วนตัว
- ทีมขนาดเล็กที่ต้องการ tracking tool แบบ lightweight

---

## 2. Tech Stack & Constraints

### 2.1 Technology Stack

| Layer | Technology | Version | หมายเหตุ |
|---|---|---|---|
| **Frontend** | HTML / CSS / Vanilla JS | HTML5 / ES6+ | ไม่ใช้ Framework |
| **UI Framework** | Bootstrap | 5.x (CDN) | Responsive + Component library |
| **Backend** | Node.js + Express | Node 18+ / Express 4.x | Serverless Functions |
| **Storage** | LocalStorage | Web Storage API | Client-side, ~5-10 MB limit |
| **Deployment** | Vercel | Serverless | File-based API routing |

### 2.2 Constraints & Assumptions

| # | Constraint | ผลกระทบ |
|---|---|---|
| C-1 | ไม่ใช้ Database จริง | ข้อมูลผูกกับ Browser → ไม่สามารถ share ข้ามอุปกรณ์ |
| C-2 | LocalStorage จำกัด ~5-10 MB | เพียงพอสำหรับ Mini Project (~1,000-5,000 records) |
| C-3 | Serverless Functions เป็น Stateless | ไม่สามารถเก็บ state ใน memory ฝั่ง Server |
| C-4 | ไม่มีระบบ Authentication | ทุกคนที่เข้าถึง URL สามารถใช้งานได้ |

---

## 3. Glossary — คำศัพท์สำคัญ

| คำศัพท์ | ความหมาย |
|---|---|
| **Project** | หน่วยงานหลักที่ต้องจัดการ มีงบประมาณ กำหนดส่ง และความคืบหน้า |
| **Task** | งานย่อย (Sub-item) ภายใต้ Project แต่ละรายการ |
| **Source of Truth** | แหล่งข้อมูลหลักที่ถือเป็นข้อมูลล่าสุดและถูกต้องที่สุด |
| **Optimistic UI** | รูปแบบการอัปเดต UI ทันทีก่อนรอ Server ยืนยัน |
| **Serverless Function** | Function ที่ทำงานบน Cloud โดยไม่ต้องจัดการ Server เอง |
| **Cold Start** | เวลาที่ใช้ในการ boot Serverless Function ครั้งแรก |
| **UUID v4** | รูปแบบ ID ที่สร้างแบบสุ่ม ไม่ซ้ำกัน (Universally Unique Identifier) |

---

## 4. Data Schema Design

### 4.1 Project Schema

```
Project {
  id            : String (UUID v4)        — Primary Key, สร้างฝั่ง Client
  name          : String (required)       — ชื่อโปรเจค
  description   : String                  — รายละเอียดโปรเจค
  status        : Enum                    — สถานะ ["planning", "in_progress", "on_hold", "completed", "cancelled"]
  priority      : Enum                    — ความสำคัญ ["low", "medium", "high", "critical"]
  startDate     : String (ISO 8601)       — วันเริ่มต้น เช่น "2026-07-20"
  dueDate       : String (ISO 8601)       — กำหนดส่ง
  completedDate : String (ISO 8601)|null  — วันที่เสร็จจริง (null ถ้ายังไม่เสร็จ)
  category      : String                  — หมวดหมู่ เช่น "Web", "Mobile", "Design", "Research"
  budget        : Number (≥ 0)            — งบประมาณ (บาท)
  spentAmount   : Number (≥ 0)            — ยอดที่ใช้ไปแล้ว (บาท)
  progress      : Number (0–100)          — เปอร์เซ็นต์ความคืบหน้า
  tags          : Array<String>           — แท็ก เช่น ["urgent", "frontend", "MVP"]
  note          : String                  — บันทึกเพิ่มเติม
  createdAt     : String (ISO 8601)       — Timestamp สร้าง
  updatedAt     : String (ISO 8601)       — Timestamp แก้ไขล่าสุด
}
```

#### ตัวอย่าง JSON — Project

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "เว็บไซต์ Portfolio",
  "description": "ออกแบบและพัฒนาเว็บไซต์แสดงผลงานส่วนตัว",
  "status": "in_progress",
  "priority": "high",
  "startDate": "2026-07-01",
  "dueDate": "2026-08-15",
  "completedDate": null,
  "category": "Web",
  "budget": 15000,
  "spentAmount": 4500,
  "progress": 35,
  "tags": ["frontend", "portfolio", "MVP"],
  "note": "ใช้ Bootstrap 5 + Vanilla JS",
  "createdAt": "2026-07-01T09:00:00.000Z",
  "updatedAt": "2026-07-20T14:30:00.000Z"
}
```

### 4.2 Task Schema (Sub-item ของ Project)

```
Task {
  id            : String (UUID v4)        — Primary Key
  projectId     : String (UUID v4)        — Foreign Key → Project.id
  title         : String (required)       — ชื่องาน
  description   : String                  — รายละเอียดงาน
  status        : Enum                    — ["todo", "in_progress", "review", "done"]
  assignee      : String                  — ผู้รับผิดชอบ
  priority      : Enum                    — ["low", "medium", "high", "critical"]
  dueDate       : String (ISO 8601)|null  — กำหนดส่ง
  completedDate : String (ISO 8601)|null  — วันที่เสร็จจริง
  createdAt     : String (ISO 8601)
  updatedAt     : String (ISO 8601)
}
```

#### ตัวอย่าง JSON — Task

```json
{
  "id": "f9e8d7c6-b5a4-3210-fedc-ba0987654321",
  "projectId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "title": "ออกแบบ Wireframe หน้า Home",
  "description": "สร้าง Wireframe ด้วย Figma สำหรับหน้าแรกของเว็บไซต์",
  "status": "done",
  "assignee": "สมชาย",
  "priority": "high",
  "dueDate": "2026-07-10",
  "completedDate": "2026-07-09",
  "createdAt": "2026-07-02T10:00:00.000Z",
  "updatedAt": "2026-07-09T16:45:00.000Z"
}
```

### 4.3 Enum Definitions

#### Project Status

| Value | Label (TH) | สี (แนะนำ) |
|---|---|---|
| `planning` | วางแผน | 🔵 Blue |
| `in_progress` | กำลังดำเนินการ | 🟡 Yellow |
| `on_hold` | ระงับชั่วคราว | 🟠 Orange |
| `completed` | เสร็จสิ้น | 🟢 Green |
| `cancelled` | ยกเลิก | 🔴 Red |

#### Task Status

| Value | Label (TH) | สี (แนะนำ) |
|---|---|---|
| `todo` | รอดำเนินการ | ⚪ Gray |
| `in_progress` | กำลังทำ | 🔵 Blue |
| `review` | รอตรวจสอบ | 🟡 Yellow |
| `done` | เสร็จแล้ว | 🟢 Green |

#### Priority Levels

| Value | Label (TH) | สี (แนะนำ) |
|---|---|---|
| `low` | ต่ำ | 🟢 Green |
| `medium` | ปานกลาง | 🔵 Blue |
| `high` | สูง | 🟠 Orange |
| `critical` | วิกฤต | 🔴 Red |

### 4.4 LocalStorage Key Convention

| Key | Value Type | คำอธิบาย |
|---|---|---|
| `pm_projects` | `Array<Project>` | รายการโปรเจคทั้งหมด |
| `pm_tasks` | `Array<Task>` | รายการ Task ทั้งหมด |
| `pm_settings` | `Object` | การตั้งค่าระบบ (theme, default view ฯลฯ) |

> **⚠️ IMPORTANT**: LocalStorage มีข้อจำกัด ~5–10 MB ต่อ origin — เพียงพอสำหรับ Mini Project แต่ไม่เหมาะกับ Production ที่มีข้อมูลจำนวนมาก

### 4.5 Entity Relationship

```
┌──────────────┐         ┌──────────────┐
│   Project    │ 1 ── * │    Task      │
│──────────────│         │──────────────│
│ id (PK)      │◀────────│ projectId(FK)│
│ name         │         │ id (PK)      │
│ status       │         │ title        │
│ priority     │         │ status       │
│ budget       │         │ assignee     │
│ progress     │         │ priority     │
│ ...          │         │ ...          │
└──────────────┘         └──────────────┘

ความสัมพันธ์: 1 Project มีได้หลาย Tasks (One-to-Many)
```

---

## 5. API Endpoints Specification

### 5.1 Base URL

| Environment | Base URL |
|---|---|
| Development | `http://localhost:3000` |
| Production | `https://<project-name>.vercel.app` |

### 5.2 Resource: Projects — CRUD

| # | Method | Endpoint | คำอธิบาย | Request Body | Success Response |
|---|---|---|---|---|---|
| P-1 | `GET` | `/api/projects` | ดึงโปรเจคทั้งหมด | — | `200` `{ success, data: Project[] }` |
| P-2 | `GET` | `/api/projects/:id` | ดึงโปรเจคตาม ID | — | `200` `{ success, data: Project }` |
| P-3 | `POST` | `/api/projects` | สร้างโปรเจคใหม่ | `Project` (ไม่ต้องส่ง id, timestamps) | `201` `{ success, data: Project }` |
| P-4 | `PUT` | `/api/projects/:id` | แก้ไขโปรเจค | `Partial<Project>` | `200` `{ success, data: Project }` |
| P-5 | `DELETE` | `/api/projects/:id` | ลบโปรเจค (+ Tasks ทั้งหมด) | — | `200` `{ success, message }` |

### 5.3 Resource: Tasks — CRUD

| # | Method | Endpoint | คำอธิบาย | Request Body | Success Response |
|---|---|---|---|---|---|
| T-1 | `GET` | `/api/projects/:projectId/tasks` | ดึง Task ทั้งหมดของโปรเจค | — | `200` `{ success, data: Task[] }` |
| T-2 | `GET` | `/api/tasks/:id` | ดึง Task ตาม ID | — | `200` `{ success, data: Task }` |
| T-3 | `POST` | `/api/projects/:projectId/tasks` | สร้าง Task ใหม่ | `Task` (ไม่ต้องส่ง id, projectId, timestamps) | `201` `{ success, data: Task }` |
| T-4 | `PUT` | `/api/tasks/:id` | แก้ไข Task | `Partial<Task>` | `200` `{ success, data: Task }` |
| T-5 | `DELETE` | `/api/tasks/:id` | ลบ Task | — | `200` `{ success, message }` |

### 5.4 Summary / Dashboard Endpoints

| # | Method | Endpoint | คำอธิบาย | Success Response |
|---|---|---|---|---|
| S-1 | `GET` | `/api/summary/overview` | สรุปภาพรวมทั้งระบบ | `200` ดูโครงสร้างด้านล่าง |
| S-2 | `GET` | `/api/summary/projects/:id` | สรุปข้อมูลโปรเจคเดียว | `200` ดูโครงสร้างด้านล่าง |
| S-3 | `GET` | `/api/summary/timeline` | ไทม์ไลน์โปรเจค (Gantt-like) | `200` ดูโครงสร้างด้านล่าง |

#### S-1 Overview Response Structure

```
{
  "success": true,
  "data": {
    "totalProjects"   : Number,
    "byStatus"        : { "planning": N, "in_progress": N, ... },
    "byPriority"      : { "low": N, "medium": N, ... },
    "totalBudget"     : Number,
    "totalSpent"      : Number,
    "budgetRemaining" : Number,
    "overallProgress" : Number (0–100, ค่าเฉลี่ย)
  }
}
```

#### S-2 Project Summary Response Structure

```
{
  "success": true,
  "data": {
    "project"           : Project,
    "taskStats"         : { "total": N, "todo": N, "inProgress": N, "review": N, "done": N },
    "budgetUsagePercent": Number (0–100),
    "daysRemaining"     : Number (จำนวนวันที่เหลือก่อน dueDate)
  }
}
```

#### S-3 Timeline Response Structure

```
{
  "success": true,
  "data": {
    "projects": [
      { "id": "...", "name": "...", "startDate": "...", "dueDate": "...", "progress": N, "status": "..." }
    ]
  }
}
```

### 5.5 Unified Response Format

#### Success

```json
{
  "success": true,
  "data": "<Object | Array>",
  "message": "optional description"
}
```

#### Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR | NOT_FOUND | SERVER_ERROR",
    "message": "รายละเอียด error ภาษาที่เข้าใจง่าย"
  }
}
```

### 5.6 HTTP Status Code Convention

| Status | ใช้เมื่อ | ตัวอย่าง |
|---|---|---|
| `200` | สำเร็จ (GET, PUT, DELETE) | ดึงข้อมูลสำเร็จ, แก้ไขสำเร็จ |
| `201` | สร้างสำเร็จ (POST) | สร้าง Project/Task ใหม่สำเร็จ |
| `400` | Request ไม่ถูกต้อง | Validation Error, Missing required field |
| `404` | ไม่พบข้อมูล | Project/Task ID ไม่มีอยู่ |
| `405` | Method ไม่อนุญาต | ใช้ PATCH กับ endpoint ที่รองรับแค่ PUT |
| `500` | Server Error | Unexpected error ภายใน Serverless Function |

### 5.7 Error Code Reference

| Error Code | HTTP Status | คำอธิบาย |
|---|---|---|
| `VALIDATION_ERROR` | 400 | ข้อมูลไม่ผ่าน Validation (missing field, wrong type, out of range) |
| `NOT_FOUND` | 404 | ไม่พบ Resource ที่ร้องขอ |
| `METHOD_NOT_ALLOWED` | 405 | HTTP Method ไม่ได้รับอนุญาตสำหรับ Endpoint นี้ |
| `SERVER_ERROR` | 500 | เกิดข้อผิดพลาดภายใน Server |

---

## 6. Frontend–Backend Integration

### 6.1 Architecture Pattern — Hybrid Client-First

```
┌─────────────────────────────────────────────────────────┐
│                       BROWSER                           │
│                                                         │
│  ┌─────────────┐      ┌───────────────┐                 │
│  │   UI Layer  │─────▶│  Data Service │                 │
│  │  (HTML/JS)  │◀─────│    Module     │                 │
│  └─────────────┘      └───────┬───────┘                 │
│                               │                         │
│                  ┌────────────▼────────────┐             │
│                  │     LocalStorage        │             │
│                  │  (Source of Truth)       │             │
│                  └─────────────────────────┘             │
│                                                         │
└─────────────────────────────────────────────────────────┘
                            │
                  (Validation Sync)
                            ▼
┌─────────────────────────────────────────────────────────┐
│                VERCEL SERVERLESS                        │
│                                                         │
│  ┌───────────────────────────────────────┐              │
│  │   /api/*  (Serverless Functions)      │              │
│  │   • Validation Logic                  │              │
│  │   • Business Rules                    │              │
│  │   • Data Transformation               │              │
│  └───────────────────────────────────────┘              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

> **📌 NOTE**: เนื่องจากไม่มี Database จริงฝั่ง Server — **LocalStorage คือ Source of Truth** ตัวจริง
> API Layer ทำหน้าที่เป็น **Validation & Business Logic Gateway** ไม่ได้เก็บข้อมูลเอง

### 6.2 Data Flow — Sequence Diagrams

#### Create Flow (สร้างโปรเจค/Task ใหม่)

```
  User          UI (JS)        API Server      LocalStorage
   │               │               │               │
   │──กรอกฟอร์ม──▶│               │               │
   │               │──Validate────▶│               │
   │               │  (client)     │               │
   │               │               │──Validate─────│
   │               │               │  (server)     │
   │               │               │               │
   │               │◀──201 + Data──│               │
   │               │               │               │
   │               │──────────────Save────────────▶│
   │               │               │               │
   │◀──UI Update───│               │               │
   │               │               │               │
```

#### Read Flow (อ่านข้อมูล)

```
  User          UI (JS)        LocalStorage     API Server
   │               │               │               │
   │──เปิดหน้า───▶│               │               │
   │               │──Read────────▶│               │
   │               │◀──Data────────│               │
   │◀──UI Render───│               │               │
   │  (ทันที)      │               │               │
   │               │──(Optional)──────Sync────────▶│
   │               │               │               │
```

#### Update / Delete Flow

```
  User          UI (JS)        LocalStorage     API Server
   │               │               │               │
   │──แก้ไข/ลบ──▶│               │               │
   │               │──Update──────▶│               │
   │◀──UI Update───│  (Optimistic) │               │
   │  (ทันที)      │               │               │
   │               │──Validate────────────────────▶│
   │               │                               │
   │               │◀──200 OK ─────────────────────│
   │               │   (Confirmed)                 │
   │               │                               │
   │               │  ถ้า Error:                   │
   │               │──Rollback────▶│               │
   │◀──แจ้ง Error──│               │               │
   │               │               │               │
```

### 6.3 Frontend Module Structure

```
public/
│
├── index.html                — หน้า Dashboard (สรุปภาพรวม)
├── projects.html             — หน้ารายการโปรเจคทั้งหมด
├── project-detail.html       — หน้ารายละเอียดโปรเจค + รายการ Tasks
│
├── css/
│   └── style.css             — Custom styles (เสริม Bootstrap 5)
│
├── js/
│   ├── app.js                — Entry point, Event binding, Page router
│   ├── api.js                — HTTP Client wrapper (fetch abstraction)
│   ├── storage.js            — LocalStorage CRUD abstraction layer
│   ├── project.js            — Project-specific UI logic & rendering
│   ├── task.js               — Task-specific UI logic & rendering
│   ├── dashboard.js          — Dashboard / Summary computation & rendering
│   └── utils.js              — Helpers (UUID generator, Date formatter, Validators)
```

### 6.4 Module Responsibilities

#### `api.js` — HTTP Client Abstraction

- ทุก function return `Promise`
- มี Base URL configuration (dev vs production)
- Centralized error handling
- ตั้ง `Content-Type: application/json` ทุก request
- Expose method-specific helpers: `apiGet()`, `apiPost()`, `apiPut()`, `apiDelete()`

#### `storage.js` — LocalStorage Data Access Layer

- `getAll(key)` — ดึงข้อมูลทั้งหมดจาก key ที่กำหนด
- `getById(key, id)` — ดึงข้อมูลรายการเดียวตาม ID
- `create(key, item)` — เพิ่มข้อมูลใหม่เข้า array
- `update(key, id, updates)` — อัปเดตข้อมูลบางฟิลด์ตาม ID
- `remove(key, id)` — ลบข้อมูลตาม ID
- `clear(key)` — ล้างข้อมูลทั้ง key

#### `utils.js` — Shared Utilities

- `generateUUID()` — สร้าง UUID v4
- `formatDate(isoString)` — แปลง ISO 8601 → รูปแบบแสดงผล
- `formatCurrency(amount)` — แปลงตัวเลข → รูปแบบเงินบาท
- `validateProject(data)` — ตรวจสอบข้อมูล Project
- `validateTask(data)` — ตรวจสอบข้อมูล Task

> **💡 TIP**: แยก `storage.js` ออกจาก `api.js` → ถ้าวันหลังเปลี่ยนไปใช้ IndexedDB หรือ DB จริง จะแก้แค่ไฟล์เดียว (Separation of Concerns)

---

## 7. Vercel Serverless Deployment

### 7.1 Project Directory Structure

```
project-root/
│
├── api/                             ← Vercel Serverless Functions
│   ├── projects/
│   │   ├── index.js                 → handles: GET /api/projects
│   │   │                                       POST /api/projects
│   │   └── [id].js                  → handles: GET /api/projects/:id
│   │                                            PUT /api/projects/:id
│   │                                            DELETE /api/projects/:id
│   │
│   ├── projects/[projectId]/
│   │   └── tasks.js                 → handles: GET /api/projects/:projectId/tasks
│   │                                            POST /api/projects/:projectId/tasks
│   │
│   ├── tasks/
│   │   └── [id].js                  → handles: GET /api/tasks/:id
│   │                                            PUT /api/tasks/:id
│   │                                            DELETE /api/tasks/:id
│   │
│   └── summary/
│       ├── overview.js              → handles: GET /api/summary/overview
│       ├── timeline.js              → handles: GET /api/summary/timeline
│       └── projects/
│           └── [id].js              → handles: GET /api/summary/projects/:id
│
├── public/                          ← Static files (served by Vercel)
│   ├── index.html
│   ├── projects.html
│   ├── project-detail.html
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── app.js
│       ├── api.js
│       ├── storage.js
│       ├── project.js
│       ├── task.js
│       ├── dashboard.js
│       └── utils.js
│
├── lib/                             ← Shared utilities สำหรับ API functions
│   ├── validators.js                → Validation functions
│   └── helpers.js                   → Common helpers
│
├── vercel.json                      ← Vercel configuration
├── package.json                     ← Dependencies & scripts
└── README.md                        ← Project documentation
```

### 7.2 vercel.json Configuration Guide

ต้องกำหนดค่าต่อไปนี้:

| Config | คำอธิบาย |
|---|---|
| **rewrites** | ชี้ static file requests ไปที่ `/public` directory |
| **headers** | ตั้ง CORS headers สำหรับ `/api/*` routes |
| **functions** | กำหนด runtime (Node.js 18.x), memory (128-256 MB), maxDuration (10s) |

### 7.3 Serverless Key Considerations

| หัวข้อ | คำอธิบาย | แนวทางรับมือ |
|---|---|---|
| **Stateless** | แต่ละ request เป็นอิสระ | ไม่เก็บ state ใน global variable |
| **Cold Start** | ~200-500ms ในการ boot ครั้งแรก | ทำ Function ให้เล็ก, import เฉพาะที่จำเป็น |
| **No Persistence** | ไม่มี filesystem หรือ memory ถาวร | Client เก็บข้อมูลใน LocalStorage เอง |
| **CORS** | Same-origin ถ้า deploy รวมที่เดียว | ตั้ง headers ใน vercel.json |
| **Timeout** | Default 10s (Hobby), 60s (Pro) | ออกแบบ API ให้ตอบเร็ว |

> **⚠️ WARNING**: เพราะ Serverless Functions เป็น Stateless — **อย่าเก็บข้อมูลใน memory หรือ global variable** ของ API ทุกอย่างต้องรับมาจาก Request Body และส่งกลับทาง Response

---

## 8. Validation & Business Rules

### 8.1 Validation Strategy — 2 Layers

```
Layer 1: Client-side (JS)              Layer 2: Server-side (API)
┌────────────────────────┐             ┌────────────────────────┐
│  • UX ดี ตอบเร็ว       │             │  • ปลอดภัย              │
│  • แสดง error ทันที     │ ──────────▶ │  • ป้องกัน bypass       │
│  • ลด request ที่ไม่จำเป็น │           │  • ตรวจ business rules  │
└────────────────────────┘             └────────────────────────┘
```

### 8.2 Project Validation Rules

| Field | Type | Rule |
|---|---|---|
| `name` | String | **Required**, ความยาว 1–200 ตัวอักษร, trim whitespace |
| `description` | String | Optional, ความยาวสูงสุด 2,000 ตัวอักษร |
| `status` | Enum | ต้องเป็นค่าใน `["planning", "in_progress", "on_hold", "completed", "cancelled"]` |
| `priority` | Enum | ต้องเป็นค่าใน `["low", "medium", "high", "critical"]` |
| `startDate` | String | ต้องเป็น ISO 8601 format (YYYY-MM-DD) |
| `dueDate` | String | ต้องเป็น ISO 8601 format, ต้อง ≥ `startDate` |
| `category` | String | Optional, ความยาวสูงสุด 50 ตัวอักษร |
| `budget` | Number | ต้อง ≥ 0 |
| `spentAmount` | Number | ต้อง ≥ 0 |
| `progress` | Number | ต้องเป็นจำนวนเต็ม อยู่ในช่วง 0–100 |
| `tags` | Array | Optional, แต่ละ tag ความยาว 1–30 ตัวอักษร, สูงสุด 10 tags |

### 8.3 Task Validation Rules

| Field | Type | Rule |
|---|---|---|
| `title` | String | **Required**, ความยาว 1–500 ตัวอักษร, trim whitespace |
| `description` | String | Optional, ความยาวสูงสุด 2,000 ตัวอักษร |
| `projectId` | String | **Required**, ต้องมี Project ที่ตรงกันอยู่จริง |
| `status` | Enum | ต้องเป็นค่าใน `["todo", "in_progress", "review", "done"]` |
| `assignee` | String | Optional, ความยาวสูงสุด 100 ตัวอักษร |
| `priority` | Enum | ต้องเป็นค่าใน `["low", "medium", "high", "critical"]` |
| `dueDate` | String | Optional, ต้องเป็น ISO 8601 format |

### 8.4 Business Rules

| # | Rule | คำอธิบาย |
|---|---|---|
| BR-1 | ลบ Project → ลบ Tasks ทั้งหมดที่ผูกอยู่ | Cascade delete |
| BR-2 | เปลี่ยน status เป็น `completed` → ตั้ง `completedDate` อัตโนมัติ | Auto-fill timestamp |
| BR-3 | เปลี่ยน status จาก `completed` กลับ → ล้าง `completedDate` เป็น null | Reset timestamp |
| BR-4 | `spentAmount` ไม่จำเป็นต้อง ≤ `budget` | แต่ UI ควรแสดง warning ถ้าเกินงบ |
| BR-5 | `progress` สามารถคำนวณอัตโนมัติจากสัดส่วน Task ที่ done | Optional auto-calculate |

---

## 9. Security & Limitations

### 9.1 ข้อจำกัดที่ทราบ (Known Limitations)

| # | ข้อจำกัด | ผลกระทบ | แนวทางแก้ไขในอนาคต |
|---|---|---|---|
| L-1 | ไม่มี Authentication | ใครเข้าถึง URL ก็ใช้งานได้ | เพิ่ม Auth (JWT, OAuth) |
| L-2 | ข้อมูลอยู่ใน LocalStorage | ล้าง Browser = ข้อมูลหาย | เพิ่ม Export/Import JSON |
| L-3 | ไม่สามารถ share ข้ามอุปกรณ์ | ข้อมูลผูกกับ Browser เดียว | เพิ่ม Database จริง |
| L-4 | LocalStorage ~5-10 MB | จำกัดจำนวน records | เปลี่ยนเป็น IndexedDB หรือ remote DB |
| L-5 | ไม่มี Real-time sync | ถ้าเปิดหลาย tab อาจข้อมูลไม่ตรงกัน | ใช้ BroadcastChannel API หรือ StorageEvent |

### 9.2 Security Considerations

| หัวข้อ | แนวทาง |
|---|---|
| **XSS Prevention** | Escape HTML ทุกครั้งก่อนแสดงผลข้อมูลจาก User input |
| **Input Sanitization** | Trim whitespace, ตัดอักขระพิเศษที่ไม่จำเป็น |
| **API Validation** | ตรวจสอบ type + range ทุก field ฝั่ง Server เสมอ |
| **CORS** | ตั้งค่า allowed origins อย่างเข้มงวด (ไม่ใช้ `*` ใน Production) |

---

## 10. Architectural Decision Records (ADR)

| # | Decision | เหตุผล | ทางเลือกที่พิจารณา |
|---|---|---|---|
| ADR-1 | ใช้ UUID v4 สร้างฝั่ง Client | ไม่ต้องพึ่ง Server สร้าง ID → รองรับ Optimistic UI | Auto-increment (ต้อง Server), nanoid |
| ADR-2 | LocalStorage เป็น Source of Truth | ตรงตามข้อกำหนด "ไม่ใช้ DB จริง" | IndexedDB (ซับซ้อนกว่า), SessionStorage (หายเมื่อปิด tab) |
| ADR-3 | API ทำ Validation เท่านั้น | Serverless = Stateless → ไม่สามารถเก็บ state | API + In-memory store (ไม่ persist ใน Serverless) |
| ADR-4 | แยก `storage.js` ออกจาก `api.js` | Separation of Concerns → เปลี่ยน storage ได้ง่าย | รวมไว้ไฟล์เดียว (ยากต่อการ maintain) |
| ADR-5 | Vercel File-based Routing | ไม่ต้อง config Express Router → ใช้ convention ของ Vercel | Custom Express server (ไม่เหมาะกับ Serverless) |
| ADR-6 | Optimistic UI Pattern | UX ดี — แสดงผลทันที, rollback ถ้า error | Pessimistic (รอ server ตอบก่อน, UX ช้ากว่า) |
| ADR-7 | Nested REST Routes สำหรับ Tasks | `projects/:id/tasks` สื่อ relationship ชัดเจน | Flat route `/api/tasks?projectId=x` (ไม่ RESTful) |

---

## 11. Phase Roadmap

### Phase 1 — MVP (Current Scope)

- [x] System Specification Document (เอกสารนี้)
- [ ] Project CRUD (สร้าง, อ่าน, แก้ไข, ลบ)
- [ ] Task CRUD (สร้าง, อ่าน, แก้ไข, ลบ)
- [ ] Dashboard สรุปภาพรวม
- [ ] LocalStorage persistence
- [ ] Deploy บน Vercel

### Phase 2 — Enhancement (อนาคต)

- [ ] Export / Import ข้อมูล JSON
- [ ] Dark Mode toggle
- [ ] Filter & Search โปรเจค/Task
- [ ] Drag & Drop จัดลำดับ Task
- [ ] Gantt Chart view (Timeline)

### Phase 3 — Production Ready (อนาคตไกล)

- [ ] Authentication (Login/Register)
- [ ] Database จริง (e.g., MongoDB, PostgreSQL)
- [ ] Real-time collaboration
- [ ] Notification system
- [ ] File attachments

---

## 12. Appendix

### A. HTTP Request/Response Examples

#### สร้างโปรเจคใหม่

```
POST /api/projects
Content-Type: application/json

Request Body:
{
  "name": "Mobile App MVP",
  "description": "พัฒนา MVP สำหรับ Mobile App",
  "status": "planning",
  "priority": "high",
  "startDate": "2026-08-01",
  "dueDate": "2026-09-30",
  "category": "Mobile",
  "budget": 50000,
  "tags": ["MVP", "mobile", "flutter"]
}

Response (201):
{
  "success": true,
  "data": {
    "id": "generated-uuid-v4",
    "name": "Mobile App MVP",
    ... (all fields with generated id, timestamps)
  },
  "message": "สร้างโปรเจคสำเร็จ"
}
```

#### ดึงโปรเจคตาม ID — กรณีไม่พบ

```
GET /api/projects/non-existent-id

Response (404):
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "ไม่พบโปรเจคที่ร้องขอ"
  }
}
```

### B. LocalStorage Data Example

```
Key: "pm_projects"
Value: [
  { "id": "uuid-1", "name": "Project A", ... },
  { "id": "uuid-2", "name": "Project B", ... }
]

Key: "pm_tasks"
Value: [
  { "id": "uuid-t1", "projectId": "uuid-1", "title": "Task 1", ... },
  { "id": "uuid-t2", "projectId": "uuid-1", "title": "Task 2", ... },
  { "id": "uuid-t3", "projectId": "uuid-2", "title": "Task 3", ... }
]
```

---

> **Document Status**: Draft — Pending Approval
> **Next Step**: เมื่อ approve spec นี้แล้ว จะเริ่ม implement ตาม Phase 1 Roadmap
