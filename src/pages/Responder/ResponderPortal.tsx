import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Activity, Users, AlertOctagon, ScrollText, Clock } from 'lucide-react';
import Navbar from '../../components/Navbar/Navbar';
import GlassCard from '../../components/GlassCard/GlassCard';
import HotelMap from '../../components/HotelMap/HotelMap';
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
  const setActiveRole = useAppStore((s) => s.setActiveRole);
  const clock = useClockTick();
  const [lastUpdated, setLastUpdated] = useState(0);
  const [shimmer, setShimmer] = useState(true);
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
    fetchData();
    const id = setInterval(fetchData, 5000);
    return () => clearInterval(id);
  }, [fetchData]);

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
    return activeAlerts.slice().sort((a, b) => b.severity - a.severity || new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map(a => ({
      roomNumber: a.room_number,
      floor: a.floor,
      severity: a.severity,
      elapsedMinutes: Math.floor((Date.now() - new Date(a.timestamp).getTime()) / 60000),
      status: 'unconfirmed'
    }));
  }, [activeAlerts]);

  const appEvents = useMemo(() => {
    const arr: any[] = [];
    alerts.forEach(a => {
      arr.push({
        time: new Date(a.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        timestamp: new Date(a.timestamp).getTime(),
        text: `[Room ${a.room_number}] ${a.message}`,
        color: a.status === 'active' ? 'red' : 'green'
      });
    });
    broadcasts.forEach(b => {
      arr.push({
        time: new Date(b.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        timestamp: new Date(b.timestamp).getTime(),
        text: `[Broadcast: ${b.target}] ${b.message}`,
        color: 'blue'
      });
    });
    return arr.sort((x, y) => y.timestamp - x.timestamp);
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
            <Activity size={20} className="text-gold" />
            <h2 className="font-playfair text-white text-xl font-semibold">Live Floor Plan</h2>
          </div>

          {shimmer ? (
            <div className="w-full h-[400px] rounded-xl shimmer" />
          ) : (
            <div className="bg-navy-light rounded-xl overflow-hidden border border-white/10" style={{ height: '400px' }}>
              <HotelMap
                rooms={rooms}
                activeAlerts={activeAlerts}
                readOnly={false}
              />
            </div>
          )}

          <p className="text-white/40 text-xs">
            Last updated {lastUpdated}s ago
          </p>

          {/* Legend */}
          <div className="flex gap-4 flex-wrap text-xs">
            <span className="flex items-center gap-1.5 text-gold">
              <span className="w-3 h-3 rounded bg-gold/60 inline-block" /> Occupied
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
            <Users size={20} className="text-gold" />
            <h2 className="font-playfair text-white text-xl font-semibold">Occupancy Summary</h2>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-left border-b border-white/10">
                <th className="pb-2 font-medium">Floor</th>
                <th className="pb-2 font-medium">Rooms</th>
                <th className="pb-2 font-medium">Occupied</th>
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
              <tr className="text-gold font-semibold">
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
                background: `conic-gradient(#D4AF37 0% ${occupancyPct}%, #112240 ${occupancyPct}% 100%)`,
              }}
            >
              <div className="w-16 h-16 bg-navy-light rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">{occupancyPct}%</span>
              </div>
            </div>
            <p className="text-white/40 text-xs mt-2">Occupancy Rate</p>
          </div>
        </GlassCard>

        {/* COLUMN 3: Priority Rooms */}
        <GlassCard className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <AlertOctagon size={20} className="text-red-400" />
            <h2 className="font-playfair text-white text-xl font-semibold">Priority Rooms</h2>
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
                      <span className="text-gold font-bold">Room {room.roomNumber}</span>
                      <span className="text-white/60 text-sm">Floor {room.floor}</span>
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
              <ScrollText size={20} className="text-gold" />
              <h2 className="font-playfair text-white text-xl font-semibold">Event Log</h2>
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
