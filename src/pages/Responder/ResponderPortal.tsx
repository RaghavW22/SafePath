import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { collection, query, orderBy, onSnapshot, where, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { motion } from 'framer-motion';
import { Activity, Users, AlertOctagon, ScrollText, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import Navbar from '../../components/Navbar/Navbar';
import GlassCard from '../../components/GlassCard/GlassCard';
import SafetyMap from '../../components/HotelMap/SafetyMap';
import { useAppStore } from '../../store/useAppStore';
import { api, type ApiAlert, type RoomStatus, type StatsResponse, type ApiBroadcast } from '../../api/client';

function useClockTick(): string {
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

const eventDotColor: Record<string, string> = {
  red: 'bg-danger',
  amber: 'bg-warning',
  blue: 'bg-blue-400',
  green: 'bg-safe',
};

export default function ResponderPortal() {
  const dangerZones = useAppStore((s) => s.dangerZones);
  const setDangerZones = useAppStore((s) => s.setDangerZones);
  const setActiveRole = useAppStore((s) => s.setActiveRole);
  const toggleDangerZone = async (roomId: string) => {
    try {
      const existing = dangerZones.find(z => z.roomId === roomId);
      if (!existing) {
        await setDoc(doc(db, 'danger_zones', roomId), { roomId, level: 'warning' });
      } else if (existing.level === 'warning') {
        await setDoc(doc(db, 'danger_zones', roomId), { roomId, level: 'danger' }, { merge: true });
      } else {
        await deleteDoc(doc(db, 'danger_zones', roomId));
      }
    } catch (error) {
      console.error("Firestore Danger Zone Error:", error);
      toast.error("Failed to update safety status.");
    }
  };

  const clock = useClockTick();
  const [lastUpdated, setLastUpdated] = useState(0);
  const [shimmer, setShimmer] = useState(true);
  const [isDangerMode, setIsDangerMode] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const [rooms,           setRooms]           = useState<RoomStatus[]>([]);
  const [stats,           setStats]           = useState<StatsResponse | null>(null);
  const [alerts,          setAlerts]          = useState<ApiAlert[]>([]);
  const [broadcasts,      setBroadcasts]      = useState<ApiBroadcast[]>([]);

  const activeAlerts = alerts.filter(a => a.status === 'active');

  const fetchData = useCallback(async () => {
    try {
      const [rRes, sRes, aRes, bRes] = await Promise.all([
        api.getRooms(),
        api.getStats(),
        api.getAlerts(),
        api.getBroadcasts()
      ]);
      setRooms(rRes);
      setStats(sRes);
      setAlerts(aRes);
      setBroadcasts(bRes);
      setLastUpdated(0);
    } catch (e) {
      // offline/error handling
    }
  }, []);

  useEffect(() => {
    setActiveRole('responder');
    const timeout = setTimeout(() => setShimmer(false), 1500);
    return () => clearTimeout(timeout);
  }, [setActiveRole]);

  useEffect(() => {
    fetchData(); // Initial full fetch
    
    // Real-time Firestore listeners for Responder
    const alertsQuery = query(collection(db, 'alerts'), orderBy('timestamp', 'desc'));
    const unsubAlerts = onSnapshot(alertsQuery, (snap) => {
        setAlerts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    });

    const broadcastsQuery = query(collection(db, 'broadcasts'), orderBy('timestamp', 'desc'));
    const unsubBroadcasts = onSnapshot(broadcastsQuery, (snap) => {
        setBroadcasts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    });

    const roomsQuery = query(collection(db, 'rooms'));
    const unsubRooms = onSnapshot(roomsQuery, (snap) => {
        setRooms(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    });

    const dangerQuery = query(collection(db, 'danger_zones'));
    const unsubDanger = onSnapshot(dangerQuery, (snap) => {
      const data = snap.docs.map(doc => doc.data() as any);
      console.log("🔥 Responder Danger Sync:", data);
      setDangerZones(data);
    }, (error) => {
      console.error("Responder Danger Listener Error:", error);
    });

    return () => {
      unsubAlerts();
      unsubBroadcasts();
      unsubRooms();
      unsubDanger();
    };
  }, [fetchData, setActiveRole]);

  useEffect(() => {
    const id = setInterval(() => setLastUpdated((p) => p + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [alerts, broadcasts]);

  const occupancyRows = useMemo(() => {
    return stats?.byFloor.map(f => ({
      floor: f.floor,
      rooms: f.total,
      occupied: f.occupied,
      sos: activeAlerts.filter(a => a.floor === f.floor).length
    })) || [];
  }, [stats, activeAlerts]);

  const totalOccupied = stats?.occupied || 0;
  const totalRooms    = stats?.total || 1;
  const totalSOS      = activeAlerts.length;
  const occupancyPct  = Math.round((totalOccupied / totalRooms) * 100) || 0;

  const priorityRooms = useMemo(() => {
    return activeAlerts
      .slice()
      .sort((a, b) => (Number(b.severity) - Number(a.severity)) || (new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()))
      .map(a => ({
        roomNumber: a.room_number,
        floor: a.floor,
        severity: a.severity,
        elapsedMinutes: a.timestamp ? Math.floor((Date.now() - new Date(a.timestamp).getTime()) / 60000) : 0,
        status: 'unconfirmed'
      }));
  }, [activeAlerts]);

  const appEvents = useMemo(() => {
    const arr: any[] = [];
    alerts.forEach(a => {
      const timeStr = a.timestamp?.includes('T') ? a.timestamp.split('T')[1].substring(0, 5) : '??:??';
      arr.push({
        time: timeStr,
        timestamp: a.timestamp ? new Date(a.timestamp).getTime() : 0,
        text: `[Unit ${a.room_number}] SOS Level ${a.severity}: ${a.message}`,
        color: a.status === 'active' ? 'red' : 'green'
      });
    });
    broadcasts.forEach(b => {
      const timeStr = b.timestamp?.includes('T') ? b.timestamp.split('T')[1].substring(0, 5) : '??:??';
      arr.push({
        time: timeStr,
        timestamp: b.timestamp ? new Date(b.timestamp).getTime() : 0,
        text: `[Broadcast: ${b.target}] ${b.message}`,
        color: 'blue'
      });
    });
    return arr.sort((x, y) => (y.timestamp || 0) - (x.timestamp || 0));
  }, [alerts, broadcasts]);

  return (
    <div className="min-h-screen bg-navy flex flex-col">
      <Navbar role="responder" />

      {/* Emergency Banner */}
      <div className="bg-danger/90 py-3 px-6 flex items-center gap-3">
        <span className="blink-dot w-3 h-3 rounded-full bg-white flex-shrink-0" />
        <span className="text-white font-bold text-sm tracking-widest flex-1">
          ACTIVE EMERGENCY — LIVE VIEW
        </span>
        <div className="flex items-center gap-2 text-white/80 text-sm">
          <Clock size={14} />
          {clock}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 p-4 sm:p-6">

        {/* COLUMN 1: Digital Twin */}
        <GlassCard className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Activity size={20} className="text-emerald-400" />
            <h2 className="font-outfit text-white text-xl font-semibold">Live Community Map</h2>
          </div>

          {shimmer ? (
            <div className="w-full h-[400px] rounded-xl shimmer" />
          ) : (
            <div className="bg-navy-light rounded-xl overflow-hidden border border-white/10" style={{ height: '400px' }}>
              <div className="p-3 border-b border-white/10 flex items-center justify-between">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${isDangerMode ? 'text-red-400' : 'text-white/30'}`}>
                  {isDangerMode ? '🚨 Danger Mode: ON' : 'Viewer Mode'}
                </span>
                <button
                  onClick={() => setIsDangerMode(!isDangerMode)}
                  className={`relative w-10 h-5 rounded-full transition-all duration-300 ${isDangerMode ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]' : 'bg-white/20'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-300 ${isDangerMode ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
              <SafetyMap
                rooms={rooms}
                activeAlerts={activeAlerts}
                dangerZones={dangerZones}
                readOnly={!isDangerMode}
                onRoomClick={(r) => {
                  if (isDangerMode) {
                    toggleDangerZone(String(r));
                  }
                }}
              />
            </div>
          )}

          <p className="text-white/40 text-xs">
            Last updated {lastUpdated}s ago
          </p>

          {/* Legend */}
          <div className="flex gap-4 flex-wrap text-xs">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-3 h-3 rounded bg-emerald-500/60 inline-block" /> Active
            </span>
            <span className="flex items-center gap-1.5 text-danger">
              <span className="w-3 h-3 rounded bg-danger/70 inline-block" /> Danger
            </span>
            <span className="flex items-center gap-1.5 text-warning">
              <span className="w-3 h-3 rounded-full bg-warning/80 inline-block animate-pulse" /> SOS
            </span>
          </div>
        </GlassCard>

        {/* COLUMN 2: Occupancy Summary */}
        <GlassCard className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-emerald-400" />
            <h2 className="font-outfit text-white text-xl font-semibold">Population Summary</h2>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-left border-b border-white/10">
                <th className="pb-2 font-medium">Level</th>
                <th className="pb-2 font-medium">Units</th>
                <th className="pb-2 font-medium">Active</th>
                <th className="pb-2 font-medium">SOS</th>
              </tr>
            </thead>
            <tbody>
              {occupancyRows.map((row) => (
                <tr key={row.floor} className="border-b border-white/10">
                  <td className="py-2 text-white/80">{row.floor}</td>
                  <td className="py-2 text-white/60">{row.rooms}</td>
                  <td className="py-2 text-white/80">{row.occupied}</td>
                  <td className={`py-2 font-bold ${row.sos > 0 ? 'bg-danger/10 text-red-400' : 'text-white/40'}`}>
                    {row.sos}
                  </td>
                </tr>
              ))}
              <tr className="text-emerald-400 font-semibold">
                <td className="pt-3">Total</td>
                <td className="pt-3">{totalRooms}</td>
                <td className="pt-3">{totalOccupied}</td>
                <td className="pt-3 text-red-400">{totalSOS}</td>
              </tr>
            </tbody>
          </table>

          <p className="text-white/30 text-xs">Names withheld — privacy protected</p>

          {/* Occupancy Donut */}
          <div className="flex flex-col items-center mt-2">
            <div
              className="w-24 h-24 rounded-full relative flex items-center justify-center"
              style={{
                background: `conic-gradient(#10B981 0% ${occupancyPct}%, #112240 ${occupancyPct}% 100%)`,
              }}
            >
              <div className="w-16 h-16 bg-navy-light rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">{occupancyPct}%</span>
              </div>
            </div>
            <p className="text-white/40 text-xs mt-2">Population Density</p>
          </div>
        </GlassCard>

        {/* COLUMN 3: Priority Rooms */}
        <GlassCard className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <AlertOctagon size={20} className="text-red-400" />
            <h2 className="font-outfit text-white text-xl font-semibold">Priority Units</h2>
          </div>

          <div className="flex flex-col gap-4">
            {priorityRooms.length === 0 ? (
              <p className="text-white/40 text-sm py-4 text-center">No active emergencies</p>
            ) : (
              priorityRooms.map((room, index) => (
                <motion.div
                  key={`${room.roomNumber}-${index}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex flex-col gap-1.5"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-danger flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    S{room.severity}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">Unit {room.roomNumber}</span>
                      <span className="text-white/60 text-sm">Level {room.floor}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-white/60 text-xs flex items-center gap-1">
                        <Clock size={10} />
                        {room.elapsedMinutes} mins ago
                      </span>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          room.status === 'unconfirmed'
                            ? 'bg-danger/20 text-red-400'
                            : 'bg-white/10 text-white/50'
                        }`}
                      >
                        {room.status}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="bg-danger/20 h-1 rounded-full overflow-hidden">
                  <div
                    className="bg-danger h-1 rounded-full transition-all"
                    style={{ width: `${Math.min((room.elapsedMinutes / 10) * 100, 100)}%` }}
                  />
                </div>
              </motion.div>
            )))}
          </div>
        </GlassCard>

        {/* BOTTOM: Event Log — full width */}
        <div className="lg:col-span-3">
          <GlassCard>
            <div className="flex items-center gap-2 mb-4">
              <ScrollText size={20} className="text-emerald-400" />
              <h2 className="font-outfit text-white text-xl font-semibold">Safety Log</h2>
            </div>
            <div
              ref={logRef}
              className="max-h-48 overflow-y-auto custom-scroll flex flex-col gap-0"
            >
              {appEvents.length === 0 && (
                 <p className="text-white/40 text-sm p-4 text-center mb-8">No events logged yet.</p>
              )}
              {appEvents.map((event, idx) => (
                <div
                  key={idx}
                  className="flex gap-3 items-start py-2 border-b border-white/5"
                >
                  <span
                    className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${eventDotColor[event.color]}`}
                  />
                  <span className="text-white/40 text-xs w-12 flex-shrink-0">{event.time}</span>
                  <span className="text-white/80 text-sm">{event.text}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
