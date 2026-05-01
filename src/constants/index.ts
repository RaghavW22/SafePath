import type { Alert } from '../types';

export const APP_NAME = 'SafePath';

// ─── Mock alerts ─────────────────────────────────────────────────────────────
export const MOCK_ALERTS: Alert[] = [
  {
    id: '1', guestName: 'Resident 102', roomNumber: 102, floor: 1, severity: 5,
    message: 'Structural damage reported near Zone A', timestamp: new Date(), status: 'active',
  },
  {
    id: '2', guestName: 'Resident 205', roomNumber: 205, floor: 2, severity: 3,
    message: 'Water leakage in Unit 205', timestamp: new Date(Date.now() - 120000), status: 'active',
  },
  {
    id: '3', guestName: 'Resident 301', roomNumber: 301, floor: 3, severity: 2,
    message: 'Medical assistance requested', timestamp: new Date(Date.now() - 300000), status: 'active',
  },
  {
    id: '4', guestName: 'Resident 104', roomNumber: 104, floor: 1, severity: 4,
    message: 'Gas leak detected in Level 1', timestamp: new Date(Date.now() - 60000), status: 'active',
  },
];

// ─── 30-unit hospital layout is now handled dynamically by HospitalMap components ─

// ─── Priority rooms (Responder Portal) ───────────────────────────────────────
export const MOCK_PRIORITY_ROOMS = [
  { rank: 1, roomNumber: 102, floor: 1, elapsedMinutes: 8, status: 'unconfirmed' as const },
  { rank: 2, roomNumber: 301, floor: 3, elapsedMinutes: 5, status: 'unconfirmed' as const },
  { rank: 3, roomNumber: 104, floor: 1, elapsedMinutes: 2, status: 'acknowledged' as const },
];

// ─── Event log (Responder Portal) ────────────────────────────────────────────
export const MOCK_EVENTS = [
  { time: '14:32', text: 'Distress signal — Unit 102, Level 1, Severity 5', color: 'red' },
  { time: '14:33', text: 'Hazard zone marked — Sector B, Level 1',       color: 'amber' },
  { time: '14:35', text: 'Safety broadcast sent — All Residents',           color: 'blue' },
  { time: '14:36', text: 'Evacuation route optimized for 4 units',          color: 'green' },
  { time: '14:38', text: 'Medical alert — Unit 301, Level 3, Severity 4',   color: 'red' },
];
