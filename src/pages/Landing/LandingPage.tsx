import { useNavigate, Navigate } from 'react-router-dom';
import { motion, Variants } from 'framer-motion';
import { QrCode, ShieldCheck, Siren, HeartHandshake, Globe, Activity } from 'lucide-react';
import Layout from '../../components/Layout/Layout';
import GlassCard from '../../components/GlassCard/GlassCard';
import Button from '../../components/Button/Button';
import { useAppStore } from '../../store/useAppStore';

const CARD_VARIANTS: Variants = {
  hidden:  { opacity: 0, y: 28 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.12, duration: 0.45, ease: 'easeOut' },
  }),
};

export default function LandingPage() {
  const navigate = useNavigate();
  const guestProfile = useAppStore((s) => s.guestProfile);
  const activeRole   = useAppStore((s) => s.activeRole);

  // Auto-login from cache
  if (guestProfile) {
    return <Navigate to="/guest-dashboard" replace />;
  }
  if (activeRole === 'staff') {
    return <Navigate to="/staff" replace />;
  }
  if (activeRole === 'responder') {
    return <Navigate to="/responder" replace />;
  }

  const roles = [
    {
      key: 'guest',
      icon: <HeartHandshake size={36} className="text-emerald-400" />,
      title: 'Citizen Support',
      desc: 'Access real-time safety guidance, evacuation routes, and emergency assistance tailored to your location.',
      buttonLabel: 'Access Safety Hub',
      buttonVariant: 'gold' as const, // We'll redefine gold in CSS or just use it as a primary action
      action: () => navigate('/guest-login'),
    },
    {
      key: 'staff',
      icon: <Globe size={36} className="text-blue-400" />,
      title: 'Community Lead',
      desc: 'Coordinate relief efforts, register residents, monitor high-risk zones, and broadcast life-saving instructions.',
      buttonLabel: 'Coordinator Login',
      buttonVariant: 'ghost' as const,
      action: () => navigate('/staff-login'),
    },
    {
      key: 'responder',
      icon: <Activity size={36} className="text-red-400" />,
      title: 'Emergency Response',
      desc: 'Live zone-map with real-time occupancy data, priority intervention areas, and incident logs.',
      buttonLabel: 'Responder Portal',
      buttonVariant: 'danger' as const,
      action: () => navigate('/responder'),
    },
  ];

  return (
    <Layout showBackground={true}>
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 mb-4 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1 text-xs font-bold text-emerald-400 uppercase tracking-widest">
            <ShieldCheck size={14} /> Tech For Good · Social Impact
          </div>
          <h1 className="font-outfit text-white text-6xl sm:text-7xl font-extrabold tracking-tight">
            Safe<span className="text-emerald-400">Path</span>
          </h1>
          <p className="text-white/65 text-lg mt-4 max-w-lg mx-auto leading-relaxed">
            AI-powered emergency ecosystem designed to democratize safety and build community resilience in underserved areas.
          </p>

          {/* Impact pill */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="inline-flex items-center gap-2 mt-6 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm text-white/50"
          >
            <Siren size={14} className="text-emerald-400" />
            Zero-barrier digital SOS · Real-time Triage · Global Scalability
          </motion.div>
        </motion.div>

        {/* Role cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-4xl">
          {roles.map((role, i) => (
            <motion.div
              key={role.key}
              custom={i}
              variants={CARD_VARIANTS}
              initial="hidden"
              animate="visible"
            >
              <GlassCard className="flex flex-col items-center text-center gap-5 h-full p-8 border-white/5 hover:border-emerald-500/30 transition-colors group">
                <div className="p-4 rounded-2xl bg-white/5 group-hover:bg-emerald-500/10 transition-colors">{role.icon}</div>
                <div>
                  <h2 className="font-outfit text-white text-2xl font-bold mb-2">{role.title}</h2>
                  <p className="text-white/55 text-sm leading-relaxed">{role.desc}</p>
                </div>
                <div className="mt-auto w-full pt-4">
                  <Button variant={role.buttonVariant} fullWidth onClick={role.action} className="rounded-xl py-6">
                    {role.buttonLabel}
                  </Button>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-white/25 text-xs mt-12 text-center max-w-sm"
        >
          Aligned with UN Sustainable Development Goals 3, 10, and 11. 
          Empowering communities through accessible technology.
        </motion.p>
      </div>
    </Layout>
  );
}
