# StaffSync — HR Management System

A runnable full-stack HR management project based on the supplied SkillWallet project brief.
Features: dashboard, employee directory, attendance, leave requests/approval, announcements, training programs, JWT login/register.

## Requirements
- Node.js 18+ and npm
- MongoDB (optional). If `MONGO_URI` is not set, the backend uses local JSON-file storage for a quick demo.

## Run locally
1. Open a terminal in this folder.
2. Install backend dependencies:
   ```bash
   cd backend
   npm install
   ```
3. Start the API:
   ```bash
   npm run dev
   ```
4. In a second terminal:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
5. Open the Vite URL shown (normally http://localhost:5173).

The frontend proxies `/api` requests to `http://localhost:5000`.
Demo login: `admin@staffsync.demo` / `Admin@123`
You can also register a new account. The demo admin account is seeded on first backend start.

## MongoDB (optional)
Create `backend/.env` from `.env.example` and set `MONGO_URI=mongodb://127.0.0.1:27017/staffsync`.
If MongoDB is not configured, data is saved in `backend/data.json`.

## Notes
This is a student/demo project. Change the JWT secret and use proper security controls before production deployment.
