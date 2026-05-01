-- SafePath Supabase Migration Script
-- Paste this ENTIRE script into the Supabase SQL Editor and click "Run"

-- ============================================================
-- 1. ROOMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS rooms (
  room_number INT PRIMARY KEY,
  floor INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  guest_name TEXT,
  language TEXT,
  checkin_datetime TEXT
);

-- Bootstrap 30 rooms (3 floors × 10 rooms)
INSERT INTO rooms (room_number, floor, status)
SELECT f * 100 + r, f, 'available'
FROM generate_series(1, 3) AS f, generate_series(1, 10) AS r
ON CONFLICT (room_number) DO NOTHING;

-- ============================================================
-- 2. CHECKINS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS checkins (
  id TEXT PRIMARY KEY,
  guest_name TEXT NOT NULL,
  room_number INT NOT NULL,
  floor INT NOT NULL,
  language TEXT DEFAULT 'English',
  email TEXT,
  mobile TEXT,
  guests_count INT DEFAULT 1,
  qr_token TEXT UNIQUE,
  checkin_datetime TEXT,
  checkout_datetime TEXT,
  status TEXT DEFAULT 'active'
);

-- ============================================================
-- 3. ALERTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  guest_name TEXT,
  room_number INT,
  floor INT,
  severity INT DEFAULT 1,
  message TEXT,
  timestamp TEXT,
  status TEXT DEFAULT 'active'
);

-- ============================================================
-- 4. BROADCASTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS broadcasts (
  id TEXT PRIMARY KEY,
  target TEXT DEFAULT 'all',
  message TEXT,
  timestamp TEXT
);

-- ============================================================
-- 5. DANGER ZONES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS danger_zones (
  room_id TEXT PRIMARY KEY,
  level TEXT DEFAULT 'warning'
);

-- ============================================================
-- 6. STAFF TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS staff (
  staff_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pin TEXT NOT NULL,
  role TEXT DEFAULT 'staff'
);

-- Bootstrap admin user
INSERT INTO staff (staff_id, name, pin, role)
VALUES ('admin', 'Admin', 'admin123', 'admin')
ON CONFLICT (staff_id) DO NOTHING;

-- ============================================================
-- 7. ENABLE REALTIME FOR ALL TABLES
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE checkins;
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE broadcasts;
ALTER PUBLICATION supabase_realtime ADD TABLE danger_zones;
ALTER PUBLICATION supabase_realtime ADD TABLE staff;

-- ============================================================
-- 8. ROW LEVEL SECURITY (permissive for hackathon)
-- ============================================================
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE danger_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- Allow all operations with anon key (hackathon-safe, not production-safe)
CREATE POLICY "Allow all on rooms" ON rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on checkins" ON checkins FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on alerts" ON alerts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on broadcasts" ON broadcasts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on danger_zones" ON danger_zones FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on staff" ON staff FOR ALL USING (true) WITH CHECK (true);
