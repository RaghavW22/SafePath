import { useState, useCallback } from 'react';
import type { RoomStatus } from '../../api/client';
import type { DangerZone } from '../../types';
import { useAppStore } from '../../store/useAppStore';

// ─── SVG layout constants ────────────────────────────────────────────────────
const VB_W = 900;
const VB_H = 560;
const ROOM_W = 90;
const ROOM_H = 72;
const ROOM_STEP = 74; // ROOM_H + 2px gap
const N_ROOMS = 5;
const TOP_H = 50;     // top bar height
const CORR_H = 26;    // corridor strip height
const CONTENT_Y = TOP_H + CORR_H; // 76 — where rooms & amenities start
const CONTENT_END_Y = CONTENT_Y + N_ROOMS * ROOM_STEP; // 76+370=446
const BOT_CORR_Y = CONTENT_END_Y; // 446
const BOTTOM_Y = BOT_CORR_Y + CORR_H; // 472
const BOTTOM_H = VB_H - BOTTOM_Y; // 88
const LEFT_X = 0;
const RIGHT_X = VB_W - ROOM_W; // 810
const CX = ROOM_W; // center zone start: 90
const CX2 = RIGHT_X; // center zone end: 810
const C_H = CONTENT_END_Y - CONTENT_Y; // 370 (amenity zone height)

// Center x columns (all within 90…810 = 720px)
const LU_X = CX, LU_W = 62;                      // left utility:   90–152
const ML_X = LU_X + LU_W + 2, ML_W = 174;        // main left:     154–328
const MC_X = ML_X + ML_W + 2, MC_W = 236;        // center:        330–566
const MR_X = MC_X + MC_W + 2, MR_W = 174;        // main right:    568–742
const RU_X = MR_X + MR_W + 2, RU_W = CX2 - (MR_X + MR_W + 2); // right util: 744–810

// Top/bottom bar x sub-elements
const EM_W = 70;
const TB_EX1_X = CX;                    // 90
const TB_EX2_X = CX2 - EM_W;           // 740
const TB_LOBBY_X = TB_EX1_X + EM_W + 2; // 162
const TB_LOBBY_W = TB_EX2_X - TB_LOBBY_X - 2; // 576

// Utility element y positions within amenity zone
const U_E1_Y = CONTENT_Y;           // 76
const U_E1_H = 90;
const U_WC1_Y = U_E1_Y + U_E1_H + 2; // 168
const U_WC_H = 84;
const U_WC2_Y = U_WC1_Y + U_WC_H + 2; // 254
const U_E2_Y = U_WC2_Y + U_WC_H + 2; // 340
const U_E2_H = CONTENT_END_Y - U_E2_Y; // 106

// Main amenity rows
const MA_Y1 = CONTENT_Y, MA_H1 = 183;
const MA_Y2 = MA_Y1 + MA_H1 + 2, MA_H2 = C_H - MA_H1 - 2; // 185

// Center amenity rows
const CA_Y1 = CONTENT_Y, CA_H1 = 244;
const CA_Y2 = CA_Y1 + CA_H1 + 2, CA_H2 = C_H - CA_H1 - 2; // 124

// ─── Types ───────────────────────────────────────────────────────────────────
type AreaType =
  | 'exit' | 'lobby' | 'stairwell' | 'elevator' | 'restaurant' | 'bar'
  | 'pool' | 'gym' | 'conference' | 'wc' | 'kids' | 'lounge' | 'spa'
  | 'business' | 'corridor' | 'assembly' | 'vending';

interface AreaDef {
  id: string;
  label: string;
  sublabel?: string;
  type: AreaType;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface FloorConfig {
  leftNums: number[];
  rightNums: number[];
  areas: AreaDef[];
}

// ─── Area styles ─────────────────────────────────────────────────────────────
const AREA_STYLE: Record<AreaType, { fill: string; stroke: string; color: string }> = {
  exit:       { fill: '#052e16', stroke: '#16a34a', color: '#4ade80' },
  lobby:      { fill: '#1e3560', stroke: '#3b82f6', color: '#93c5fd' },
  stairwell:  { fill: '#1e2d3d', stroke: '#475569', color: '#94a3b8' },
  elevator:   { fill: '#1c1f2e', stroke: '#6b7280', color: '#cbd5e1' },
  restaurant: { fill: '#3b1702', stroke: '#d97706', color: '#fbbf24' },
  bar:        { fill: '#2e1065', stroke: '#7c3aed', color: '#c084fc' },
  pool:       { fill: '#082f49', stroke: '#0369a1', color: '#38bdf8' },
  gym:        { fill: '#14532d', stroke: '#16a34a', color: '#4ade80' },
  conference: { fill: '#172554', stroke: '#1d4ed8', color: '#7dd3fc' },
  wc:         { fill: '#1c1917', stroke: '#57534e', color: '#a8a29e' },
  kids:       { fill: '#713f12', stroke: '#d97706', color: '#fde68a' },
  lounge:     { fill: '#3b0764', stroke: '#9333ea', color: '#e879f9' },
  spa:        { fill: '#500724', stroke: '#db2777', color: '#f9a8d4' },
  business:   { fill: '#0c1a2e', stroke: '#1e40af', color: '#bae6fd' },
  corridor:   { fill: '#060e1a', stroke: '#1e293b', color: '#475569' },
  assembly:   { fill: '#7f1d1d', stroke: '#dc2626', color: '#fca5a5' },
  vending:    { fill: '#1a2a1a', stroke: '#3d5427', color: '#86efac' },
};

// ─── Room styles ─────────────────────────────────────────────────────────────
const ROOM_STYLE = {
  available: { fill: '#052e16', stroke: '#16a34a', numColor: '#4ade80', label: 'Available' },
  occupied:  { fill: '#450a0a', stroke: '#dc2626', numColor: '#f87171', label: 'Occupied' },
  warning:   { fill: '#431407', stroke: '#f97316', numColor: '#fb923c', label: 'Warning' },
  danger:    { fill: '#3b0000', stroke: '#991b1b', numColor: '#fca5a5', label: 'Danger' },
  unknown:   { fill: '#0f1f35', stroke: '#D4AF3780', numColor: '#ffffff', label: 'Unknown' },
};

// ─── Shared utility area definitions ─────────────────────────────────────────
const sharedUtilAreas = (): AreaDef[] => [
  // Left column stairwells
  { id: 'stair-lt', label: '🪜', sublabel: 'Stair A', type: 'stairwell', x: LEFT_X, y: 0, w: ROOM_W, h: TOP_H },
  { id: 'stair-lb', label: '🪜', sublabel: 'Stair C', type: 'stairwell', x: LEFT_X, y: BOTTOM_Y, w: ROOM_W, h: BOTTOM_H },
  // Right column stairwells
  { id: 'stair-rt', label: '🪜', sublabel: 'Stair B', type: 'stairwell', x: RIGHT_X, y: 0, w: ROOM_W, h: TOP_H },
  { id: 'stair-rb', label: '🪜', sublabel: 'Stair D', type: 'stairwell', x: RIGHT_X, y: BOTTOM_Y, w: ROOM_W, h: BOTTOM_H },
  // Top corridor
  { id: 'top-corr', label: '', sublabel: '', type: 'corridor', x: CX, y: TOP_H, w: CX2 - CX, h: CORR_H },
  // Bottom corridor
  { id: 'bot-corr', label: '', sublabel: '', type: 'corridor', x: CX, y: BOT_CORR_Y, w: CX2 - CX, h: CORR_H },
  // Left utility elevators & WC
  { id: 'elev-1', label: '🛗', sublabel: 'Elevator 1', type: 'elevator', x: LU_X, y: U_E1_Y, w: LU_W, h: U_E1_H },
  { id: 'wc-1',   label: '🚻', sublabel: "Men's WC",   type: 'wc',       x: LU_X, y: U_WC1_Y, w: LU_W, h: U_WC_H },
  { id: 'wc-2',   label: '🚻', sublabel: "Women's WC", type: 'wc',       x: LU_X, y: U_WC2_Y, w: LU_W, h: U_WC_H },
  { id: 'elev-2', label: '🛗', sublabel: 'Elevator 2', type: 'elevator', x: LU_X, y: U_E2_Y, w: LU_W, h: U_E2_H },
  // Right utility
  { id: 'elev-3', label: '🛗', sublabel: 'Elevator 3', type: 'elevator', x: RU_X, y: U_E1_Y, w: RU_W, h: U_E1_H },
  { id: 'wc-3',   label: '🚻', sublabel: "Men's WC",   type: 'wc',       x: RU_X, y: U_WC1_Y, w: RU_W, h: U_WC_H },
  { id: 'wc-4',   label: '🚻', sublabel: "Women's WC", type: 'wc',       x: RU_X, y: U_WC2_Y, w: RU_W, h: U_WC_H },
  { id: 'elev-4', label: '🛗', sublabel: 'Elevator 4', type: 'elevator', x: RU_X, y: U_E2_Y, w: RU_W, h: U_E2_H },
];

// ─── Floor configurations ─────────────────────────────────────────────────────
const FLOOR_DATA: Record<number, FloorConfig> = {
  1: {
    leftNums: [101, 102, 103, 104, 105],
    rightNums: [106, 107, 108, 109, 110],
    areas: [
      ...sharedUtilAreas(),
      // Top bar (entry)
      { id: 'ex-a', label: '🚨', sublabel: 'Emergency Exit A', type: 'exit',   x: TB_EX1_X, y: 0, w: EM_W, h: TOP_H },
      { id: 'lobby', label: '🏨', sublabel: 'Lobby & Reception', type: 'lobby', x: TB_LOBBY_X, y: 0, w: TB_LOBBY_W, h: TOP_H },
      { id: 'ex-b', label: '🚨', sublabel: 'Emergency Exit B', type: 'exit',   x: TB_EX2_X, y: 0, w: EM_W, h: TOP_H },
      // Center amenities
      { id: 'restaurant', label: '🍽️', sublabel: 'Restaurant & Dining', type: 'restaurant', x: ML_X, y: MA_Y1, w: ML_W, h: MA_H1 },
      { id: 'bar',        label: '🍸', sublabel: 'Bar & Lounge',         type: 'bar',        x: ML_X, y: MA_Y2, w: ML_W, h: MA_H2 },
      { id: 'pool',       label: '🏊', sublabel: 'Swimming Pool & Spa', type: 'pool',       x: MC_X, y: CA_Y1, w: MC_W, h: CA_H1 },
      { id: 'conf',       label: '📋', sublabel: 'Grand Conference Hall',type: 'conference', x: MC_X, y: CA_Y2, w: MC_W, h: CA_H2 },
      { id: 'gym',        label: '💪', sublabel: 'Gym & Fitness Centre', type: 'gym',        x: MR_X, y: MA_Y1, w: MR_W, h: MA_H1 },
      { id: 'kids',       label: '🎮', sublabel: 'Kids Zone & Play Area', type: 'kids',      x: MR_X, y: MA_Y2, w: MR_W, h: MA_H2 },
      // Bottom bar (assembly)
      { id: 'ex-c',     label: '🚨', sublabel: 'Emergency Exit C', type: 'exit',     x: TB_EX1_X, y: BOTTOM_Y, w: EM_W, h: BOTTOM_H },
      { id: 'assembly', label: '⛑️', sublabel: 'Fire Assembly Point', type: 'assembly', x: TB_LOBBY_X, y: BOTTOM_Y, w: TB_LOBBY_W, h: BOTTOM_H },
      { id: 'ex-d',     label: '🚨', sublabel: 'Emergency Exit D', type: 'exit',     x: TB_EX2_X, y: BOTTOM_Y, w: EM_W, h: BOTTOM_H },
    ],
  },
  2: {
    leftNums: [201, 202, 203, 204, 205],
    rightNums: [206, 207, 208, 209, 210],
    areas: [
      ...sharedUtilAreas(),
      { id: 'ex-a',    label: '🚨', sublabel: 'Emergency Exit',       type: 'exit',       x: TB_EX1_X,   y: 0,        w: EM_W,        h: TOP_H    },
      { id: 'eloblby', label: '🛗', sublabel: 'Elevator Lobby',       type: 'lobby',      x: TB_LOBBY_X, y: 0,        w: TB_LOBBY_W,  h: TOP_H    },
      { id: 'ex-b',    label: '🚨', sublabel: 'Emergency Exit',       type: 'exit',       x: TB_EX2_X,   y: 0,        w: EM_W,        h: TOP_H    },
      { id: 'meet-a',  label: '📋', sublabel: 'Meeting Room A',       type: 'conference', x: ML_X,       y: MA_Y1,    w: ML_W,        h: MA_H1    },
      { id: 'meet-b',  label: '📋', sublabel: 'Meeting Room B',       type: 'conference', x: ML_X,       y: MA_Y2,    w: ML_W,        h: MA_H2    },
      { id: 'skybar',  label: '🌅', sublabel: 'Sky Lounge & Bar',     type: 'lounge',     x: MC_X,       y: CA_Y1,    w: MC_W,        h: CA_H1    },
      { id: 'minibar', label: '🍹', sublabel: 'Mini-Bar & Café',      type: 'bar',        x: MC_X,       y: CA_Y2,    w: MC_W,        h: CA_H2    },
      { id: 'biz',     label: '💼', sublabel: 'Business Hub',         type: 'business',   x: MR_X,       y: MA_Y1,    w: MR_W,        h: MA_H1    },
      { id: 'vend',    label: '🥤', sublabel: 'Vending & Ice Machine', type: 'vending',   x: MR_X,       y: MA_Y2,    w: MR_W,        h: MA_H2    },
      { id: 'ex-c',   label: '🚨', sublabel: 'Emergency Exit',       type: 'exit',       x: TB_EX1_X,   y: BOTTOM_Y, w: EM_W,        h: BOTTOM_H },
      { id: 'corr2b', label: '',   sublabel: 'Walkway',              type: 'corridor',   x: TB_LOBBY_X, y: BOTTOM_Y, w: TB_LOBBY_W,  h: BOTTOM_H },
      { id: 'ex-d',   label: '🚨', sublabel: 'Emergency Exit',       type: 'exit',       x: TB_EX2_X,   y: BOTTOM_Y, w: EM_W,        h: BOTTOM_H },
    ],
  },
  3: {
    leftNums: [301, 302, 303, 304, 305],
    rightNums: [306, 307, 308, 309, 310],
    areas: [
      ...sharedUtilAreas(),
      { id: 'ex-a',   label: '🚨', sublabel: 'Emergency Exit',       type: 'exit',      x: TB_EX1_X,   y: 0,        w: EM_W,       h: TOP_H    },
      { id: 'elobby', label: '🛗', sublabel: 'Elevator Lobby',       type: 'lobby',     x: TB_LOBBY_X, y: 0,        w: TB_LOBBY_W, h: TOP_H    },
      { id: 'ex-b',   label: '🚨', sublabel: 'Emergency Exit',       type: 'exit',      x: TB_EX2_X,   y: 0,        w: EM_W,       h: TOP_H    },
      { id: 'spa',    label: '🧖', sublabel: 'Luxury Spa & Wellness', type: 'spa',       x: ML_X,       y: MA_Y1,    w: ML_W,       h: MA_H1    },
      { id: 'hkp',    label: '🧹', sublabel: 'Housekeeping',         type: 'wc',        x: ML_X,       y: MA_Y2,    w: ML_W,       h: MA_H2    },
      { id: 'terrace',label: '🌿', sublabel: 'Sky Terrace & Garden', type: 'lounge',    x: MC_X,       y: CA_Y1,    w: MC_W,       h: CA_H1    },
      { id: 'rtbar',  label: '🌙', sublabel: 'Rooftop Bar',          type: 'bar',       x: MC_X,       y: CA_Y2,    w: MC_W,       h: CA_H2    },
      { id: 'pgym',   label: '🏋️', sublabel: 'Premium Gym',          type: 'gym',       x: MR_X,       y: MA_Y1,    w: MR_W,       h: MA_H1    },
      { id: 'laundry',label: '👔', sublabel: 'Laundry Service',      type: 'wc',        x: MR_X,       y: MA_Y2,    w: MR_W,       h: MA_H2    },
      { id: 'ex-c',   label: '🚨', sublabel: 'Emergency Exit',       type: 'exit',      x: TB_EX1_X,   y: BOTTOM_Y, w: EM_W,       h: BOTTOM_H },
      { id: 'corr3b', label: '',   sublabel: 'Service Corridor',     type: 'corridor',  x: TB_LOBBY_X, y: BOTTOM_Y, w: TB_LOBBY_W, h: BOTTOM_H },
      { id: 'ex-d',   label: '🚨', sublabel: 'Emergency Exit',       type: 'exit',      x: TB_EX2_X,   y: BOTTOM_Y, w: EM_W,       h: BOTTOM_H },
    ],
  },
};

// ─── Component props ──────────────────────────────────────────────────────────
interface HotelMapProps {
  rooms?: RoomStatus[];
  dangerZones?: DangerZone[];
  defaultFloor?: number;
  onRoomClick?: (roomNumber: number) => void;
  showLegend?: boolean;
  readOnly?: boolean;
  sosRooms?: number[];
}

interface SelectedInfo {
  kind: 'room' | 'area';
  label: string;
  sublabel: string;
  type: string;
  roomData?: RoomStatus;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function HotelMap({
  rooms = [],
  dangerZones = [],
  defaultFloor = 1,
  onRoomClick,
  showLegend = true,
  readOnly = false,
  sosRooms = [],
}: HotelMapProps) {
  const [activeFloor, setActiveFloor] = useState(defaultFloor);
  const [selected, setSelected] = useState<SelectedInfo | null>(null);
  const activeRole = useAppStore((s) => s.activeRole);

  const floor = FLOOR_DATA[activeFloor];

  const roomMap = new Map<number, RoomStatus>(rooms.map((r) => [r.room_number, r]));

  const getDangerLevel = useCallback(
    (roomNum: number): 'warning' | 'danger' | null => {
      const dz = dangerZones.find((z) => z.roomId === String(roomNum));
      return dz ? dz.level : null;
    },
    [dangerZones]
  );

  const getRoomStyle = useCallback(
    (roomNum: number) => {
      const danger = getDangerLevel(roomNum);
      if (danger === 'danger') return ROOM_STYLE.danger;
      if (danger === 'warning') return ROOM_STYLE.warning;
      const rd = roomMap.get(roomNum);
      if (!rd) return ROOM_STYLE.unknown;
      return rd.status === 'occupied' ? ROOM_STYLE.occupied : ROOM_STYLE.available;
    },
    [roomMap, getDangerLevel]
  );

  const handleRoomClick = useCallback(
    (roomNum: number) => {
      const rd = roomMap.get(roomNum);
      const danger = getDangerLevel(roomNum);
      const statusLabel = danger
        ? danger.charAt(0).toUpperCase() + danger.slice(1) + ' Zone'
        : rd?.status === 'occupied'
        ? 'Occupied'
        : 'Available';

      setSelected({
        kind: 'room',
        label: `Room ${roomNum}`,
        sublabel: statusLabel,
        type: rd?.status ?? 'unknown',
        roomData: rd,
      });
      onRoomClick?.(roomNum);
    },
    [roomMap, getDangerLevel, onRoomClick]
  );

  const handleAreaClick = useCallback((area: AreaDef) => {
    setSelected({
      kind: 'area',
      label: area.sublabel ?? area.id,
      sublabel: area.type.charAt(0).toUpperCase() + area.type.slice(1),
      type: area.type,
    });
  }, []);

  const renderRoom = (num: number, x: number, idx: number) => {
    const y = CONTENT_Y + idx * ROOM_STEP;
    const style = getRoomStyle(num);
    const isSos = sosRooms.includes(num);

    return (
      <g
        key={`room-${num}`}
        onClick={() => handleRoomClick(num)}
        style={{ cursor: readOnly ? 'default' : 'pointer' }}
      >
        <rect
          x={x + 1}
          y={y + 1}
          width={ROOM_W - 2}
          height={ROOM_H - 2}
          fill={style.fill}
          stroke={style.stroke}
          strokeWidth="1.5"
          rx="5"
        />
        {/* Room number */}
        <text
          x={x + ROOM_W / 2}
          y={y + ROOM_H / 2 - 6}
          textAnchor="middle"
          fill={style.numColor}
          fontSize="16"
          fontWeight="700"
          fontFamily="Inter, sans-serif"
        >
          {num}
        </text>
        {/* Status dot + label */}
        <circle
          cx={x + ROOM_W / 2}
          cy={y + ROOM_H / 2 + 12}
          r="4"
          fill={style.stroke}
        />
        {/* SOS pulse */}
        {isSos && (
          <>
            <circle cx={x + ROOM_W / 2} cy={y + ROOM_H / 2} fill="rgba(251,146,60,0.8)" r="5">
              <animate attributeName="r" values="5;20;5" dur="1.8s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.8;0;0.8" dur="1.8s" repeatCount="indefinite" />
            </circle>
          </>
        )}
      </g>
    );
  };

  const renderArea = (area: AreaDef) => {
    const s = AREA_STYLE[area.type];
    const isClickable = area.type !== 'corridor';
    const labelFontSize = area.w < 80 || area.h < 50 ? 9 : area.w < 120 ? 11 : 13;

    return (
      <g
        key={area.id}
        onClick={() => isClickable && handleAreaClick(area)}
        style={{ cursor: isClickable ? 'pointer' : 'default' }}
      >
        <rect
          x={area.x}
          y={area.y}
          width={area.w}
          height={area.h}
          fill={s.fill}
          stroke={s.stroke}
          strokeWidth={area.type === 'exit' || area.type === 'assembly' ? 2 : 1}
          rx={area.type === 'elevator' ? 4 : area.type === 'corridor' ? 0 : 6}
        />
        {/* Emoji icon (only if area is big enough) */}
        {area.label && area.h >= 40 && area.w >= 55 && (
          <text
            x={area.x + area.w / 2}
            y={area.y + area.h / 2 - (area.sublabel && area.h > 55 ? 8 : 0)}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={area.w < 80 ? 14 : 20}
            fontFamily="sans-serif"
          >
            {area.label}
          </text>
        )}
        {/* Text label */}
        {area.sublabel && area.h > 55 && area.w > 60 && (
          <text
            x={area.x + area.w / 2}
            y={area.y + area.h / 2 + (area.label ? 18 : 0)}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={s.color}
            fontSize={labelFontSize}
            fontWeight="600"
            fontFamily="Inter, sans-serif"
          >
            {area.sublabel}
          </text>
        )}
      </g>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Floor tabs */}
      <div className="flex gap-2">
        {[1, 2, 3].map((f) => {
          const floorRooms = FLOOR_DATA[f];
          const allNums = [...floorRooms.leftNums, ...floorRooms.rightNums];
          const occupiedCount = allNums.filter(
            (n) => roomMap.get(n)?.status === 'occupied'
          ).length;
          return (
            <button
              key={f}
              onClick={() => { setActiveFloor(f); setSelected(null); }}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                activeFloor === f
                  ? 'bg-gold text-navy'
                  : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}
            >
              Floor {f}
              <span
                className={`text-xs rounded-full px-1.5 py-0.5 ${
                  activeFloor === f ? 'bg-navy/30' : 'bg-white/10'
                }`}
              >
                {occupiedCount}/{allNums.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* SVG Map */}
      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="w-full rounded-xl border border-white/10"
          style={{ background: '#060E1A' }}
        >
          {/* Building outline */}
          <rect x={0} y={0} width={VB_W} height={VB_H} fill="#0A1628" rx={8} />

          {/* Floor label */}
          <text
            x={VB_W / 2}
            y={VB_H - 8}
            textAnchor="middle"
            fill="rgba(255,255,255,0.2)"
            fontSize="11"
            fontFamily="Inter, sans-serif"
          >
            Floor {activeFloor} — Interactive Hotel Map
          </text>

          {/* Render areas */}
          {floor.areas.map(renderArea)}

          {/* Render left rooms */}
          {floor.leftNums.map((num, i) => renderRoom(num, LEFT_X, i))}

          {/* Render right rooms */}
          {floor.rightNums.map((num, i) => renderRoom(num, RIGHT_X, i))}
        </svg>

        {/* Info panel overlay */}
        {selected && (
          <div className="absolute bottom-3 left-3 right-3 bg-navy-light/95 backdrop-blur border border-white/20 rounded-xl p-3 flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-white font-semibold text-sm">{selected.label}</span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full w-fit ${
                  selected.type === 'occupied'
                    ? 'bg-danger/20 text-red-400'
                    : selected.type === 'available'
                    ? 'bg-safe/20 text-green-400'
                    : 'bg-white/10 text-white/60'
                }`}
              >
                {selected.sublabel}
              </span>
              {(activeRole === 'staff' || activeRole === 'responder') && selected.roomData?.guest_name && (
                <span className="text-white/60 text-xs">
                  Guest: {selected.roomData.guest_name} · {selected.roomData.language}
                </span>
              )}
              {selected.roomData?.checkin_datetime && (
                <span className="text-white/40 text-xs">
                  Checked in: {selected.roomData.checkin_datetime}
                </span>
              )}
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-white/40 hover:text-white text-lg leading-none flex-shrink-0"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-green-400">
            <span className="w-3 h-3 rounded bg-safe/20 border border-green-500 inline-block" />
            Available
          </span>
          <span className="flex items-center gap-1.5 text-red-400">
            <span className="w-3 h-3 rounded bg-danger/20 border border-red-600 inline-block" />
            Occupied
          </span>
          <span className="flex items-center gap-1.5 text-yellow-400">
            <span className="w-3 h-3 rounded bg-warning/20 border border-warning inline-block" />
            Warning Zone
          </span>
          <span className="flex items-center gap-1.5 text-green-400">
            <span className="w-3 h-3 rounded bg-[#052e16] border border-green-600 inline-block" />
            Emergency Exit
          </span>
          <span className="flex items-center gap-1.5 text-blue-400">
            <span className="w-3 h-3 rounded bg-[#082f49] border border-blue-600 inline-block" />
            Amenity
          </span>
        </div>
      )}
    </div>
  );
}
