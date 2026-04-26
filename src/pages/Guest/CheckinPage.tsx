import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { AlertCircle } from 'lucide-react';
import Layout from '../../components/Layout/Layout';
import Navbar from '../../components/Navbar/Navbar';
import GlassCard from '../../components/GlassCard/GlassCard';
import Button from '../../components/Button/Button';
import { useAppStore } from '../../store/useAppStore';
import { api } from '../../api/client';

const LANGUAGES = [
  'English', 'Hindi', 'Spanish', 'French', 'Arabic',
  'German', 'Chinese', 'Japanese', 'Russian', 'Portuguese',
] as const;

const schema = z.object({
  name:       z.string().min(2, 'Name must be at least 2 characters'),
  roomNumber: z.number().min(101, 'Rooms start from 101').max(310, 'Room must be ≤ 310'),
  language:   z.enum(LANGUAGES),
  email:      z.string().email('Invalid email address'),
  mobile:     z.string().min(10, 'Mobile number must be at least 10 digits'),
});

type CheckinFormData = z.infer<typeof schema>;

function getFloor(room: number) {
  if (room >= 100 && room <= 199) return 1;
  if (room >= 200 && room <= 299) return 2;
  return 3;
}

const FIELD_VARIANTS = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.07, duration: 0.35 },
  }),
};

const INPUT =
  'w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-emerald-400 transition-colors';

export default function CheckinPage() {
  const navigate   = useNavigate();
  const setGuest   = useAppStore((s) => s.setGuestProfile);
  const [apiError, setApiError] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [detectedFloor, setDetectedFloor] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CheckinFormData>({
    resolver: zodResolver(schema),
    defaultValues: { language: 'English' },
  });

  const roomWatch = watch('roomNumber');

  const onSubmit = async (data: CheckinFormData) => {
    setApiError('');
    setLoading(true);
    try {
      const res = await api.registerGuest({
        name:       data.name,
        roomNumber: data.roomNumber,
        language:   data.language,
        email:      data.email,
        mobile:     data.mobile,
        guestsCount: 1,
      });

      const guest = res.guest;
      setGuest({
        id:          `guest-${guest.roomNumber}`,
        name:        guest.name,
        roomNumber:  guest.roomNumber,
        floor:       guest.floor,
        language:    guest.language,
        checkedIn:   true,
      });

      toast.success(`Welcome ${guest.name}! Unit ${guest.roomNumber} confirmed.`);
      navigate('/guest-dashboard');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Check-in failed';
      setApiError(msg);
      // If room is occupied surface as a distinct warning
      if (msg.toLowerCase().includes('occupied')) {
        toast.error('Unit is already registered — choose another unit.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout showBackground={true}>
      <Navbar role="guest" />
      <div className="flex-1 flex items-start justify-center px-4 py-8">
        <GlassCard className="w-full max-w-md">
          <div className="mb-6">
            <h1 className="font-outfit text-white text-3xl font-bold mb-1">
              Resident <span className="text-emerald-400">Access</span>
            </h1>
            <p className="text-white/60 text-sm">
              Enter your details to receive your personalised community safety guide.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">

            {/* Full Name */}
            <motion.div custom={0} variants={FIELD_VARIANTS} initial="hidden" animate="visible">
              <label className="text-white/50 text-xs mb-1 block">Full Name</label>
              <input {...register('name')} placeholder="e.g. Rahul Mehta" className={INPUT} />
              {errors.name && (
                <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>
              )}
            </motion.div>

            {/* Contact Details Grid */}
            <div className="grid grid-cols-2 gap-4">
              <motion.div custom={1} variants={FIELD_VARIANTS} initial="hidden" animate="visible">
                <label className="text-white/50 text-xs mb-1 block">Email Address</label>
                <input {...register('email')} type="email" placeholder="rahul@example.com" className={INPUT} />
                {errors.email && (
                  <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
                )}
              </motion.div>
              <motion.div custom={1.5} variants={FIELD_VARIANTS} initial="hidden" animate="visible">
                <label className="text-white/50 text-xs mb-1 block">Mobile Number</label>
                <input {...register('mobile')} type="tel" placeholder="+91 98765 43210" className={INPUT} />
                {errors.mobile && (
                  <p className="text-red-400 text-xs mt-1">{errors.mobile.message}</p>
                )}
              </motion.div>
            </div>

            {/* Unit Number */}
            <motion.div custom={2} variants={FIELD_VARIANTS} initial="hidden" animate="visible">
              <label className="text-white/50 text-xs mb-1 block">Unit / Zone Number</label>
              <input
                {...register('roomNumber', {
                  valueAsNumber: true,
                  onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                    const v = parseInt(e.target.value);
                    setDetectedFloor(isNaN(v) ? null : getFloor(v));
                    setApiError('');
                  },
                })}
                type="number"
                placeholder="101 – 310"
                className={INPUT}
              />
              <AnimatePresence>
                {detectedFloor && roomWatch && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-emerald-400 text-xs mt-1"
                  >
                    📍 Level {detectedFloor} detected
                  </motion.p>
                )}
              </AnimatePresence>
              {errors.roomNumber && (
                <p className="text-red-400 text-xs mt-1">{errors.roomNumber.message}</p>
              )}
            </motion.div>

            {/* Language */}
            <motion.div custom={3} variants={FIELD_VARIANTS} initial="hidden" animate="visible">
              <label className="text-white/50 text-xs mb-1 block">Language Preference</label>
              <select {...register('language')} className={`${INPUT} appearance-none`}>
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang} className="bg-navy text-white">
                    {lang}
                  </option>
                ))}
              </select>
            </motion.div>

            {/* API error banner */}
            <AnimatePresence>
              {apiError && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-start gap-2 bg-danger/10 border border-danger/40 rounded-xl px-4 py-3"
                >
                  <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-300 text-sm">{apiError}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <motion.div custom={3} variants={FIELD_VARIANTS} initial="hidden" animate="visible">
              <Button variant="gold" type="submit" fullWidth disabled={loading} className="bg-emerald-500 hover:bg-emerald-600 border-none text-navy font-bold">
                {loading ? 'Accessing…' : 'Get My Safety Guide'}
              </Button>
            </motion.div>
          </form>
        </GlassCard>
      </div>
    </Layout>
  );
}
