# SafePath: Emergency Response System

An **AI-Powered Emergency Guidance System** for Hospitals.

This project enhances resident safety and staff responsiveness during emergencies using real-time floor maps, broadcast communications, and dynamic SOS tools.

## Features
- **Citizen Dashboard**: Accessed securely via QR code login. Provides dynamic routing, targeted announcements, and an emergency SOS panic button.
- **Community Lead Dashboard**: Allows staff to register residents with QR tokens, monitor real-time hospital occupancy, track active alarms, and broadcast instructions to specific floors or zones.
- **Responder Portal**: Live situational awareness tracking for emergency first-responders.

## Tech Stack
- Frontend: React 18+, TypeScript, Vite, Tailwind CSS, Framer Motion, Zustand, Supabase client
- Backend: Python 3.10+, Flask, Supabase (PostgREST API via httpx), Google Gemini AI

## Setup Instructions

### Environment Variables
Create a `.env` file in the project root with the following:
```
# Backend
SUPABASE_URL=your_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GEMINI_API_KEY=your_google_ai_key
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_app_password

# Frontend
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### Backend Setup
1. `pip install -r backend/requirements.txt`
2. `python backend/app.py`

### Frontend
1. `npm install`
2. `npm run dev`
