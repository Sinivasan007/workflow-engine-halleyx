<div align="center">

# ⚡ HALLEYX WORKFLOW ENGINE

![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=for-the-badge&logo=node.js)
![React](https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react)
![MySQL](https://img.shields.io/badge/MySQL-8.0-orange?style=for-the-badge&logo=mysql)
![JWT](https://img.shields.io/badge/Auth-JWT-red?style=for-the-badge)
![Challenge](https://img.shields.io/badge/Halleyx-Challenge%202026-purple?style=for-the-badge)

> A full-stack workflow automation platform with a dynamic rule engine,
> multi-step approvals, email notifications, and real-time execution tracking.

[Features](#-features) · [Tech Stack](#️-tech-stack) · [Getting Started](#-getting-started) · [API Docs](#-api-documentation) · [Rule Engine](#-rule-engine) · [Samples](#-sample-workflows)

</div>

---

## 🎬 Demo Video

[![Watch Demo](https://img.shields.io/badge/▶_Watch_Demo-Google_Drive-blue?style=for-the-badge&logo=googledrive)](https://drive.google.com/file/d/1-S5wl2GgkBV_QThhxrJRWpEAVwSGe-Fp/view?usp=drive_link)

---

## 🌐 Live Demo

> 🔗 **Hosted App:** https://workflowenginehalleyx.vercel.app/
> 
> **Test Credentials:**
> ```
> Email    : demo@gmail.com
> Password : Demo@1234
> ```
>
> **Note:** Email notifications in the demo only 
> send to verified addresses (Resend free tier).
> Approval emails will work if the assignee_email
> in step metadata matches a verified address.

| Workflow List | Workflow Editor |
|:---:|:---:|
| Search, filter, paginate workflows | 3-step wizard: Details → Steps → Rules |

| Execution View | Audit Log |
|:---:|:---:|
| Real-time step progress + logs | Full execution history with search |

---

## ✨ Features

### ⚡ Dynamic Rule Engine
- Comparison operators: `==` `!=` `<` `>` `<=` `>=`
- Logical operators: `&&` (AND), `||` (OR)
- String functions: `contains()`, `startsWith()`, `endsWith()`
- `DEFAULT` fallback rule (matches when no other rule does)
- Priority-based evaluation (lowest number = highest priority)
- All evaluations logged per step for full auditability

### 🔄 Workflow Execution Engine
- Multi-step sequential execution
- Conditional branching via rule evaluation
- Real-time status tracking with polling
- Comprehensive per-step execution logs
- Version stamping on every execution

### ✅ Approval System
- Pause execution for human approval
- Email notification to approver (Gmail SMTP)
- One-click Approve / Reject via email link
- Manual approve/reject from the UI
- Auto-resume workflow after approval
- 24-hour token expiry for security

### 📧 Notification System
- Email notifications via Nodemailer
- Template variable replacement (`{{field_name}}` syntax)
- In-app notification bell with unread count
- Toast notifications for real-time feedback
- Persistent notification history (localStorage)

### 🔁 Retry & Cancel
- Retry failed executions (reruns only the failed step)
- Cancel in-progress or pending executions
- Retry counter tracked per execution

### 🔒 Loop Detection
- Configurable max iterations per step (default: 10)
- Prevents infinite loops automatically
- Marks execution as `failed` with descriptive error

### 🌿 Branching
- Multiple execution paths based on input data
- Dynamic next-step selection via rule priority
- Visual step flow in the 3-step wizard editor

### 🌙 Moonlight Theme UI
- Dark sidebar + white content areas
- Violet (`#7C3AED`) accent colors
- Framer Motion animations throughout
- Fully responsive design

### 👤 Authentication & Security
- JWT-based auth with 7-day expiry
- bcrypt password hashing (10 rounds)
- Protected routes with middleware
- User data isolation (multi-tenant)
- Rate limiting on auth endpoints
- CORS restricted to frontend origin
- Input validation on all endpoints

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React.js 18 | UI framework |
| **Styling** | Tailwind CSS 3 | Utility-first CSS |
| **Animations** | Framer Motion 10 | Page transitions & micro-interactions |
| **HTTP Client** | Axios | API communication |
| **Routing** | React Router v6 | Client-side routing |
| **Icons** | Lucide React | SVG icon library |
| **Backend** | Node.js + Express | REST API server |
| **Database** | MySQL 8.0 | Relational data store |
| **Auth** | JWT + bcryptjs | Token auth & password hashing |
| **Email** | Resend API | Transactional email service |
| **IDs** | uuid v9 | UUID generation |
| **Security** | express-rate-limit | Brute-force protection |

---

## 📁 Project Structure

```
workflow-engine-halleyx/
├── 📁 backend/
│   ├── 📁 config/
│   │   └── db.js                   # MySQL connection pool
│   ├── 📁 controllers/
│   │   ├── authController.js       # Signup, signin, profile
│   │   ├── workflowController.js   # CRUD + search + pagination
│   │   ├── stepController.js       # Step CRUD with ownership
│   │   ├── ruleController.js       # Rule CRUD with ownership
│   │   └── executionController.js  # Execute, approve, cancel, retry
│   ├── 📁 middleware/
│   │   └── auth.js                 # JWT verification middleware
│   ├── 📁 routes/
│   │   ├── auth.js                 # /auth routes
│   │   ├── workflows.js            # /workflows routes
│   │   ├── steps.js                # /steps routes
│   │   ├── rules.js                # /rules routes
│   │   ├── executions.js           # /executions routes
│   │   └── approval.js             # /approval (public, email links)
│   ├── 📁 services/
│   │   ├── ruleEngine.js           # Core rule evaluator
│   │   ├── executionService.js     # Execution loop engine
│   │   └── emailService.js         # Resend API email sender
│   ├── .env.example                # Environment template
│   ├── server.js                   # Express app entry point
│   └── package.json
│
├── 📁 frontend/
│   ├── 📁 src/
│   │   ├── 📁 components/
│   │   │   ├── Layout.jsx          # Main layout wrapper
│   │   │   ├── Sidebar.jsx         # Navigation sidebar
│   │   │   ├── Modal.jsx           # Reusable modal
│   │   │   ├── StatusBadge.jsx     # Status indicator
│   │   │   ├── Toast.jsx           # Toast notification system
│   │   │   └── 📁 ui/
│   │   │       ├── ConfirmModal.jsx
│   │   │       ├── LoadingSkeleton.jsx
│   │   │       ├── MetricCard.jsx
│   │   │       ├── NotificationBell.jsx
│   │   │       └── NotificationToast.jsx
│   │   ├── 📁 context/
│   │   │   ├── AuthContext.jsx      # Auth state + 401 interceptor
│   │   │   └── NotificationContext.jsx
│   │   ├── 📁 pages/
│   │   │   ├── LandingPage.jsx
│   │   │   ├── SignIn.jsx
│   │   │   ├── SignUp.jsx
│   │   │   ├── WorkflowList.jsx     # Dashboard with search/filter
│   │   │   ├── WorkflowEditor.jsx   # 3-step wizard
│   │   │   ├── RuleEditor.jsx       # Per-step rule management
│   │   │   ├── ExecutionView.jsx    # Real-time execution tracker
│   │   │   └── AuditLog.jsx        # Execution history
│   │   ├── 📁 services/
│   │   │   └── api.js              # Axios instance + interceptors
│   │   └── App.jsx                 # Routes definition
│   └── package.json
│
├── 📁 sample-workflows/
│   ├── expense-approval.json       # Sample: expense approval flow
│   └── employee-onboarding.json    # Sample: onboarding flow
│
├── schema.sql                      # Complete database schema
├── .gitignore
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| MySQL | 8.0+ | [dev.mysql.com](https://dev.mysql.com/downloads) |
| npm | 9+ | Comes with Node.js |
| Git | Any | [git-scm.com](https://git-scm.com) |

### Installation

#### 1️⃣ Clone the Repository

```bash
git clone https://github.com/Sinivasan007/workflow-engine-halleyx.git
cd workflow-engine-halleyx
```

#### 2️⃣ Setup Database

```sql
-- Open MySQL CLI
mysql -u root -p

-- Run these commands
CREATE DATABASE IF NOT EXISTS halleyx_workflow;
USE halleyx_workflow;

-- Import schema
SOURCE schema.sql;
```

Or import directly:
```bash
mysql -u root -p halleyx_workflow < schema.sql
```

#### 3️⃣ Setup Backend

```bash
cd backend
npm install

# Create environment file
cp .env.example .env
```

Edit `.env` with your values:

```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=halleyx_workflow
JWT_SECRET=your_very_strong_secret_key_minimum_32_characters

# Resend Email Configuration
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=Workflow Engine <onboarding@resend.dev>
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:5000
```

> [!IMPORTANT]
> **Email Setup with Resend:**
> 1. Sign up at [resend.com](https://resend.com)
> 2. Go to API Keys → Create API Key
> 3. Copy the key to `RESEND_API_KEY` in `.env`
> 4. **Important:** Resend free tier only sends 
>    emails to **verified email addresses**.
>    To send to any email, verify your domain 
>    at Resend Dashboard → Domains.
> 5. For testing: verify your own email address
>    at Resend Dashboard → Audiences

#### 4️⃣ Setup Frontend

```bash
cd ../frontend
npm install
```

#### 5️⃣ Run the Application

Open **two terminals**:

```bash
# Terminal 1 — Backend
cd backend
npm run dev
# ✅ Output: 🚀 Server running on port 5000
# ✅ Output: ✅ MySQL connected successfully
```

```bash
# Terminal 2 — Frontend
cd frontend
npm start
# Opens http://localhost:3000
```

---

## 📡 API Documentation

**Base URL:** `http://localhost:5000`

All protected routes require:
```
Authorization: Bearer <your_jwt_token>
```

### Auth Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|:----:|
| `POST` | `/auth/signup` | Register new user | ❌ |
| `POST` | `/auth/signin` | Login | ❌ |
| `GET` | `/auth/me` | Get current user | ✅ |
| `PUT` | `/auth/profile` | Update profile | ✅ |

<details>
<summary><b>POST /auth/signup</b> — Example</summary>

**Request:**
```json
{
  "username": "sinivasan",
  "email": "sinivasan@example.com",
  "password": "password123"
}
```

**Response** `201`:
```json
{
  "message": "User created successfully",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "sinivasan",
    "email": "sinivasan@example.com"
  }
}
```
</details>

### Workflow Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|:----:|
| `POST` | `/workflows` | Create workflow | ✅ |
| `GET` | `/workflows` | List (search + pagination) | ✅ |
| `GET` | `/workflows/:id` | Get with nested steps + rules | ✅ |
| `PUT` | `/workflows/:id` | Update (auto version bump) | ✅ |
| `DELETE` | `/workflows/:id` | Delete workflow | ✅ |

### Step Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|:----:|
| `POST` | `/workflows/:id/steps` | Add step | ✅ |
| `GET` | `/workflows/:id/steps` | List steps | ✅ |
| `PUT` | `/steps/:id` | Update step | ✅ |
| `DELETE` | `/steps/:id` | Delete step | ✅ |

### Rule Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|:----:|
| `POST` | `/steps/:id/rules` | Add rule | ✅ |
| `GET` | `/steps/:id/rules` | List rules (priority order) | ✅ |
| `PUT` | `/rules/:id` | Update rule | ✅ |
| `DELETE` | `/rules/:id` | Delete rule | ✅ |

### Execution Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|:----:|
| `POST` | `/workflows/:id/execute` | Start execution | ✅ |
| `GET` | `/executions` | List all executions | ✅ |
| `GET` | `/executions/:id` | Get with full logs + timeline | ✅ |
| `POST` | `/executions/:id/approve` | Approve paused step | ✅ |
| `POST` | `/executions/:id/cancel` | Cancel execution | ✅ |
| `POST` | `/executions/:id/retry` | Retry failed execution | ✅ |

### Approval Endpoints (Public — No Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/approval/approve/:token` | Approve via email link |
| `GET` | `/approval/reject/:token` | Reject via email link |

---

## ⚡ Rule Engine

The rule engine evaluates conditions dynamically at runtime against the workflow's input data.

### Supported Operators

| Type | Operators | Example |
|------|-----------|---------|
| Comparison | `==` `!=` `<` `>` `<=` `>=` | `amount > 100` |
| Logical | `&&` `\|\|` | `amount > 100 && country == 'US'` |
| String | `contains()` | `contains(email, '@company.com')` |
| String | `startsWith()` | `startsWith(name, 'John')` |
| String | `endsWith()` | `endsWith(email, '.com')` |
| Special | `DEFAULT` | Always matches (fallback) |

### How Rules Work

```
Rules are evaluated in PRIORITY ORDER (lowest number first).
The FIRST matching rule wins → its next_step_id is used.
If no rule matches and no DEFAULT exists → execution FAILS.

Example:
  Priority 1: amount > 100 && country == 'US'    → Finance Review
  Priority 2: amount <= 100                       → Auto Approve
  Priority 3: DEFAULT                             → Manager Review
```

### Security

- Dangerous keywords blocked: `eval`, `Function`, `require`, `process`, `constructor`, `prototype`
- Bracket notation access blocked
- Expression evaluated in strict mode sandbox
- Syntax validated before saving to database

### Loop Detection

- Max 10 iterations per step (configurable)
- If the same step is visited 10+ times → execution marked as `failed`
- Error: `"Max iterations reached for step: <name>"`

---

## 📊 Sample Workflows

### 1. Expense Approval Workflow

**Purpose:** Route expense requests through appropriate approval chains based on amount, country, and priority.

| Input Field | Type | Required | Example Values |
|-------------|------|:--------:|----------------|
| `amount` | number | ✅ | `250`, `50`, `5000` |
| `country` | string | ✅ | `US`, `UK`, `IN` |
| `department` | string | ❌ | `Finance`, `HR`, `IT` |
| `priority` | string | ✅ | `High`, `Medium`, `Low` |

**Execution Path Example:**
```
Input: { amount: 250, country: "US", priority: "High" }

Step 1: Manager Approval (approval) → Rule: amount > 100 && country == 'US' ✅
Step 2: Finance Notification (notification) → Emails finance team
Step 3: CEO Approval (approval) → Awaits CEO decision
Step 4: Task Completion (task) → Marks workflow done ✅
```

### 2. Employee Onboarding Workflow

**Purpose:** Automate the new employee onboarding process with conditional routing based on role and salary.

| Input Field | Type | Required | Example Values |
|-------------|------|:--------:|----------------|
| `employee_name` | string | ✅ | `John Smith` |
| `department` | string | ✅ | `HR`, `IT`, `Finance` |
| `salary` | number | ✅ | `45000`, `75000` |
| `role_level` | string | ✅ | `Junior`, `Senior`, `Director` |

> 💡 Both sample workflow JSON files are available in the `sample-workflows/` directory.

---

## 🗄️ Database Schema

```
┌──────────────┐     ┌──────────┐     ┌─────────┐
│   users      │     │ workflows│     │  steps  │
│──────────────│     │──────────│     │─────────│
│ id (PK)      │◄────│ user_id  │     │ id (PK) │
│ username     │     │ id (PK)  │◄────│workflow_id│
│ email        │     │ name     │     │ name    │
│ password     │     │ version  │     │step_type│
└──────────────┘     │input_schema│   │metadata │
                     │start_step_id│  └────┬────┘
                     └──────────┘         │
                                          │
                     ┌──────────┐    ┌────▼────┐
                     │executions│    │  rules  │
                     │──────────│    │─────────│
                     │ id (PK)  │    │ id (PK) │
                     │workflow_id│   │ step_id │
                     │ status   │    │condition│
                     │input_data│    │next_step│
                     │ retries  │    │priority │
                     └────┬─────┘    └─────────┘
                          │
                     ┌────▼──────────┐
                     │execution_logs │
                     │───────────────│
                     │ id (PK)       │
                     │ execution_id  │
                     │ step_id       │
                     │evaluated_rules│
                     │ status        │
                     └───────────────┘
```

> Full schema available in [`schema.sql`](schema.sql).

---
## 🔧 Troubleshooting

<details>
<summary><b>MySQL Connection Error</b></summary>

```
Error: "Access denied for user root"
```
**Fix:** Check `DB_PASSWORD` in your `.env` file matches your MySQL root password.
</details>

<details>
<summary><b>Port Already in Use</b></summary>

```
Error: "EADDRINUSE: address already in use :5000"
```
**Fix:**
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Mac/Linux
kill -9 $(lsof -ti:5000)
```
</details>

<details>
<summary><b>Frontend Cannot Connect to Backend</b></summary>

```
Error: "Network Error" in browser console
```
**Fix:**
1. Make sure the backend is running (`npm run dev`)
2. Verify `FRONTEND_URL` in `.env` matches your frontend port
3. Check CORS config in `server.js`
</details>

---

<details>
<summary><b>Email Only Sends to Verified Addresses</b></summary>

**Resend Free Tier Limitation:**
On the free plan, Resend only delivers emails 
to addresses you have verified in your 
Resend dashboard.

**Fix for Testing:**
1. Go to [resend.com/audiences](https://resend.com/audiences)
2. Add and verify your email address
3. Use that verified email in step metadata

**Fix for Production:**
1. Go to [resend.com/domains](https://resend.com/domains)
2. Add and verify your domain (e.g., yourdomain.com)
3. Update EMAIL_FROM to use your verified domain
4. After domain verification, send to ANY email

**Current behavior:**
- Unverified email → email silently not delivered
- Verified email → email delivered successfully ✅
</details>

<details>
<summary><b>Workflow Execution Fails Immediately</b></summary>

```
Error: "Workflow has no start step"
```
**Fix:** Edit the workflow → in Step 3 (Configure Rules), select a **Start Step** from the dropdown → Save.
</details>

---

## 👤 Author

**Sinivasan S**
Final Year B.E. Computer Science
Kamaraj College of Engineering and Technology
Virudhunagar, Tamil Nadu

[![GitHub](https://img.shields.io/badge/GitHub-@Sinivasan007-181717?style=flat&logo=github)](https://github.com/Sinivasan007)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-sinivasan--s-0A66C2?style=flat&logo=linkedin)](https://linkedin.com/in/sinivasan-s)
[![Email](https://img.shields.io/badge/Email-sinivasans157@gmail.com-EA4335?style=flat&logo=gmail)](mailto:sinivasans157@gmail.com)

---

## 🏢 Built For

**Halleyx Full Stack Engineer Challenge 2026**
[Halleyx](https://halleyx.com) — AI-powered Telecom BSS Solutions, Toronto, Canada

---

<div align="center">

⭐ **If you found this project helpful, please give it a star on GitHub!** ⭐

</div>
