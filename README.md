# Email Job Scheduler & Dashboard

A full-stack email campaign scheduling platform built with Next.js, Node.js/Express, Supabase, and BullMQ/Redis for delayed background job execution with rate-limiting controls.

---

## Features Implemented

* **Google OAuth Authentication**: Real Google OAuth integration using Supabase Auth with session persistence, user profile display (name, email, avatar), and logout functionality.
* **Email Scheduling & Throttling**:
* Customizable scheduling options (start date/time, delay per email, and hourly sending limits per sender).
* Automatic lead extraction from uploaded `.csv` or `.txt` files with regex email parsing and duplicate stripping.


* **Campaign & Job Queue Management**:
* BullMQ/Redis back-end queue processing to handle delayed sending, rate limiting, and execution.


* **Dashboard Interface**:
* Tabbed management interface for viewing scheduled and sent campaign statuses.
* Interactive modal dialog with form validation and real-time toast feedback.



---

## Tech Stack

* **Frontend**: Next.js 14/15 (`/app` router), React, Tailwind CSS, Shadcn UI, Lucide Icons, Sonner (Toasts)
* **Backend**: Node.js, Express / Next.js API Routes
* **Database & Auth**: Supabase (PostgreSQL + Auth)
* **Queue / Storage**: Redis + BullMQ

---

## Local Setup & Installation

### 1. Prerequisites

* Node.js (v18+)
* npm or pnpm
* Running Redis instance (Local or Redis Cloud)
* Supabase project instance

### 2. Environment Configuration

Create a `.env.local` file in the project root:

```env
# Next.js / Frontend
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_URL=http://localhost:3000

# Backend / Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

```

### 3. Installation & Database Setup

1. **Install dependencies**:
```bash
npm install

```


2. **Database Schema Setup** (Execute in your Supabase SQL Editor):
```sql
CREATE TABLE sender_configs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

```


3. **Start Development Servers**:
```bash
# Run local Next.js frontend & API
npm run dev

```



---

## Known Edge Cases & Considerations

* **Sender Configuration Association**: If a user schedules an email without a pre-existing `sender_configs` record, the API falls back to generating or referencing an active configuration for the logged-in user.
* **Redis Connection**: Ensure Redis is running locally (`redis-server`) or update `REDIS_HOST` in `.env.local` to point to a managed cloud instance.
* **Timezone Offset**: Date and time selections are converted into ISO UTC format (`toISOString()`) prior to queueing to prevent server/client timezone drift.

---

## Submission Checklist

* [x] Google OAuth Setup & Dashboard UI
* [x] File upload & Lead email extraction logic
* [x] Scheduling modal & validation
* [x] Database schemas & API queue handler
* [x] Pushed to GitHub repository
