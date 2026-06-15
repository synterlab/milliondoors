import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";

const STORAGE_USER = "md_username";

/* ─── Overscroll off ─────────────────────────────────────────── */
if (typeof document !== "undefined") {
  document.documentElement.style.overscrollBehavior = "none";
}

/* ═══════════════════════════════════════════════════════════════
   TYPES & CONSTANTS
═══════════════════════════════════════════════════════════════ */
const COINS = ["ORYNTH","ARTMAP","KWOK","COINFLIP","BASEFUN","CULTURE","VISION","NOTE","CITY","ORBIT"] as const;
type CoinName = typeof COINS[number];
type Rarity   = "nothing"|"common"|"rare"|"epic"|"legendary"|"mythic";
type View     = "home"|"collection"|"stats"|"daily";
type Phase    = "idle"|"selected"|"opening"|"revealed";

interface Reward     { rarity: Rarity; coin?: CoinName; doorNumber: number; }
interface StoredFind { id: string; rarity: Rarity; coin: CoinName; doorNumber: number; ts: number; }
interface Stats      { opened: number; found: number; legendary: number; mythic: number; }
interface Achievement{ id: string; title: string; desc: string; icon: string; }

const STORAGE = { collection:"md_col", stats:"md_stats", achievements:"md_ach", daily:"md_daily" };

const ACHIEVEMENTS: Achievement[] = [
  { id:"first",           title:"First Door",    desc:"You opened your first door.",        icon:"🚪" },
  { id:"ten",             title:"Ten Doors",      desc:"Ten doors opened.",                  icon:"🔟" },
  { id:"fifty",           title:"Fifty Doors",    desc:"Fifty doors and counting.",          icon:"🔑" },
  { id:"hundred",         title:"Century",        desc:"One hundred doors opened.",          icon:"💯" },
  { id:"first_legendary", title:"Legendary Find", desc:"Your first legendary discovery.",   icon:"✨" },
  { id:"first_mythic",    title:"Mythic Find",    desc:"You found the rarest of all.",       icon:"👁" },
];

/* Rarity color tokens — explicit, no string manipulation */
const RC: Record<Rarity,{ text:string; border:string; bg:string; glow:string; shadow:string }> = {
  nothing:   { text:"rgba(255,255,255,0.28)", border:"rgba(255,255,255,0.09)", bg:"rgba(255,255,255,0.03)", glow:"none",                                          shadow:"none" },
  common:    { text:"rgba(255,255,255,0.78)", border:"rgba(255,255,255,0.16)", bg:"rgba(255,255,255,0.05)", glow:"none",                                          shadow:"none" },
  rare:      { text:"rgba(147,197,253,0.94)", border:"rgba(147,197,253,0.22)", bg:"rgba(147,197,253,0.07)", glow:"0 0 32px rgba(147,197,253,0.32)",               shadow:"0 0 18px rgba(147,197,253,0.22)" },
  epic:      { text:"rgba(196,181,253,0.94)", border:"rgba(196,181,253,0.22)", bg:"rgba(196,181,253,0.08)", glow:"0 0 40px rgba(196,181,253,0.40)",               shadow:"0 0 20px rgba(196,181,253,0.30)" },
  legendary: { text:"rgba(251,191,36,0.97)",  border:"rgba(251,191,36,0.28)",  bg:"rgba(251,191,36,0.09)",  glow:"0 0 60px rgba(251,191,36,0.52)",               shadow:"0 0 24px rgba(251,191,36,0.42)" },
  mythic:    { text:"rgba(255,255,255,1.00)",  border:"rgba(255,255,255,0.34)", bg:"rgba(255,255,255,0.08)", glow:"0 0 80px rgba(255,255,255,0.62),0 0 160px rgba(255,255,255,0.18)", shadow:"0 0 40px rgba(255,255,255,0.5)" },
};

const RARITY_LABEL: Record<Rarity,string> = {
  nothing:"Empty",common:"Common",rare:"Rare",epic:"Epic",legendary:"Legendary",mythic:"Mythic",
};
const RARITY_PCT: Record<Rarity,string> = {
  nothing:"70% of all doors",common:"20% of players find this",rare:"7% of players",
  epic:"2% of players",legendary:"0.9% of players",mythic:"0.1% — rarest of all",
};

const X_URL  = "https://x.com/million_doors";
const SITE   = "milliondoors.xyz";

/* ─── Helpers ────────────────────────────────────────────────── */
function randomDoor() { return Math.floor(Math.random() * 9_000_000) + 1_000_000; }

function generateReward(dn: number): Reward {
  const roll = Math.random() * 100;
  const coin = COINS[Math.floor(Math.random() * COINS.length)];
  if (roll < 70)   return { rarity:"nothing",   dn } as unknown as Reward;
  if (roll < 90)   return { rarity:"common",    coin, doorNumber:dn };
  if (roll < 97)   return { rarity:"rare",      coin, doorNumber:dn };
  if (roll < 99)   return { rarity:"epic",      coin, doorNumber:dn };
  if (roll < 99.9) return { rarity:"legendary", coin, doorNumber:dn };
  return                   { rarity:"mythic",   coin, doorNumber:dn };
}
function fixReward(r: Reward, dn: number): Reward { return { ...r, doorNumber: r.doorNumber || dn }; }

function loadJson<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
}
function haptic(pattern: number | number[]) { try { navigator.vibrate?.(pattern); } catch {} }
const btnBase: React.CSSProperties = {
  WebkitTapHighlightColor:"transparent", touchAction:"manipulation", userSelect:"none", cursor:"pointer",
};

/* ═══════════════════════════════════════════════════════════════
   DOOR SVG — Realistic mahogany door with brass hardware
═══════════════════════════════════════════════════════════════ */
function RealDoor({ size = 1, lit = false }: { size?: number; lit?: boolean }) {
  const W = 160, H = 240;
  return (
    <svg
      width={W * size} height={H * size}
      viewBox={`0 0 ${W} ${H}`}
      style={{ filter: lit ? "drop-shadow(0 0 28px rgba(251,191,36,0.55))" : "drop-shadow(0 4px 24px rgba(0,0,0,0.8))" }}
      aria-hidden
    >
      <defs>
        {/* Frame gradient */}
        <linearGradient id="frameG" x1="0" y1="0" x2="160" y2="240" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#2a1600"/>
          <stop offset="100%" stopColor="#0e0700"/>
        </linearGradient>
        {/* Frame highlight (top/left edge) */}
        <linearGradient id="frameHL" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="rgba(255,190,80,0.18)"/>
          <stop offset="100%" stopColor="rgba(255,190,80,0.00)"/>
        </linearGradient>
        {/* Door slab wood grain */}
        <linearGradient id="slabG" x1="0" y1="0" x2="160" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#1e0e04"/>
          <stop offset="18%"  stopColor="#231208"/>
          <stop offset="35%"  stopColor="#1c0d04"/>
          <stop offset="52%"  stopColor="#241306"/>
          <stop offset="70%"  stopColor="#1a0b03"/>
          <stop offset="85%"  stopColor="#221106"/>
          <stop offset="100%" stopColor="#190b03"/>
        </linearGradient>
        {/* Panel inset (darker recessed look) */}
        <linearGradient id="panelG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="rgba(0,0,0,0.35)"/>
          <stop offset="50%"  stopColor="rgba(0,0,0,0.12)"/>
          <stop offset="100%" stopColor="rgba(0,0,0,0.32)"/>
        </linearGradient>
        {/* Panel fill with wood tones */}
        <linearGradient id="panelFill" x1="0" y1="0" x2="56" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#170b03"/>
          <stop offset="30%"  stopColor="#1e0f05"/>
          <stop offset="70%"  stopColor="#1a0c04"/>
          <stop offset="100%" stopColor="#160a02"/>
        </linearGradient>
        {/* Brass gradient for hinges/knob */}
        <linearGradient id="brassG" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#c49a2a"/>
          <stop offset="40%"  stopColor="#e8c050"/>
          <stop offset="70%"  stopColor="#a07818"/>
          <stop offset="100%" stopColor="#7a5c10"/>
        </linearGradient>
        {/* Knob sphere gradient */}
        <radialGradient id="knobG" cx="35%" cy="30%" r="65%">
          <stop offset="0%"   stopColor="#ffe090"/>
          <stop offset="30%"  stopColor="#c49a2a"/>
          <stop offset="70%"  stopColor="#8b6818"/>
          <stop offset="100%" stopColor="#5a4010"/>
        </radialGradient>
        {/* Panel molding highlight */}
        <linearGradient id="moldingHL" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="rgba(255,180,60,0.14)"/>
          <stop offset="100%" stopColor="rgba(0,0,0,0.18)"/>
        </linearGradient>
        {/* Door light seam (visible at crack when ajar) */}
        <linearGradient id="lightG" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="rgba(255,210,100,0.00)"/>
          <stop offset="100%" stopColor="rgba(255,210,100,0.90)"/>
        </linearGradient>
        {/* Ambient glow behind door */}
        <radialGradient id="ambientG" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgba(251,191,36,0.28)"/>
          <stop offset="100%" stopColor="rgba(251,191,36,0.00)"/>
        </radialGradient>
        <filter id="softShadow">
          <feDropShadow dx="1" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.7)"/>
        </filter>
      </defs>

      {/* ── FRAME ────────────────────────────────────────────── */}
      {/* Outer frame body */}
      <rect x="0" y="0" width="160" height="240" rx="3" fill="url(#frameG)"/>
      {/* Frame top highlight */}
      <rect x="0" y="0" width="160" height="1.5" rx="1" fill="rgba(255,190,80,0.22)"/>
      {/* Frame left highlight */}
      <rect x="0" y="0" width="1.5" height="240" fill="url(#frameHL)"/>
      {/* Frame bottom shadow */}
      <rect x="0" y="238.5" width="160" height="1.5" fill="rgba(0,0,0,0.55)"/>
      {/* Frame right shadow */}
      <rect x="158.5" y="0" width="1.5" height="240" fill="rgba(0,0,0,0.45)"/>
      {/* Frame gold border line */}
      <rect x="0.5" y="0.5" width="159" height="239" rx="2.5" fill="none" stroke="rgba(200,148,30,0.20)" strokeWidth="1"/>

      {/* ── DOOR SLAB ─────────────────────────────────────────── */}
      <rect x="8" y="8" width="144" height="224" rx="2" fill="url(#slabG)"/>
      {/* Slab top bevel */}
      <rect x="8" y="8" width="144" height="1.5" fill="rgba(255,160,50,0.12)"/>
      {/* Slab bottom shadow */}
      <rect x="8" y="230.5" width="144" height="1.5" fill="rgba(0,0,0,0.4)"/>

      {/* ── VERTICAL STILE (center) ───────────────────────────── */}
      <rect x="74" y="8" width="12" height="224" fill="url(#slabG)"/>
      <line x1="74" y1="8" x2="74" y2="232" stroke="rgba(0,0,0,0.22)" strokeWidth="0.8"/>
      <line x1="86" y1="8" x2="86" y2="232" stroke="rgba(255,150,40,0.08)" strokeWidth="0.8"/>

      {/* ── HORIZONTAL RAIL (center) ──────────────────────────── */}
      <rect x="8" y="112" width="144" height="16" fill="url(#slabG)"/>
      <line x1="8" y1="112" x2="152" y2="112" stroke="rgba(0,0,0,0.24)" strokeWidth="1"/>
      <line x1="8" y1="128" x2="152" y2="128" stroke="rgba(255,150,40,0.08)" strokeWidth="0.8"/>

      {/* ── TOP RAIL & BOTTOM RAIL ────────────────────────────── */}
      <rect x="8" y="8" width="144" height="10" fill="url(#slabG)"/>
      <rect x="8" y="222" width="144" height="10" fill="url(#slabG)"/>

      {/* ══ PANEL TOP-LEFT ════════════════════════════════════════ */}
      {/* Outer molding shadow */}
      <rect x="16" y="16" width="56" height="94" rx="2.5" fill="rgba(0,0,0,0.32)"/>
      {/* Outer molding highlight */}
      <rect x="16" y="16" width="56" height="2" fill="rgba(255,160,50,0.14)"/>
      <rect x="16" y="16" width="2" height="94" fill="rgba(255,160,50,0.10)"/>
      {/* Panel inner recess */}
      <rect x="20" y="20" width="48" height="86" rx="1.5" fill="url(#panelFill)"/>
      {/* Panel inner shadow top */}
      <rect x="20" y="20" width="48" height="4" rx="1.5" fill="rgba(0,0,0,0.28)"/>
      {/* Panel inner shadow left */}
      <rect x="20" y="20" width="3" height="86" fill="rgba(0,0,0,0.20)"/>
      {/* Panel ambient highlight */}
      <rect x="22" y="22" width="44" height="82" rx="1" fill="none" stroke="rgba(255,140,30,0.05)" strokeWidth="1"/>

      {/* ══ PANEL TOP-RIGHT ═══════════════════════════════════════ */}
      <rect x="88" y="16" width="56" height="94" rx="2.5" fill="rgba(0,0,0,0.32)"/>
      <rect x="88" y="16" width="56" height="2" fill="rgba(255,160,50,0.14)"/>
      <rect x="88" y="16" width="2" height="94" fill="rgba(255,160,50,0.10)"/>
      <rect x="92" y="20" width="48" height="86" rx="1.5" fill="url(#panelFill)"/>
      <rect x="92" y="20" width="48" height="4" rx="1.5" fill="rgba(0,0,0,0.28)"/>
      <rect x="92" y="20" width="3" height="86" fill="rgba(0,0,0,0.20)"/>
      <rect x="94" y="22" width="44" height="82" rx="1" fill="none" stroke="rgba(255,140,30,0.05)" strokeWidth="1"/>

      {/* ══ PANEL BOTTOM-LEFT ════════════════════════════════════ */}
      <rect x="16" y="130" width="56" height="90" rx="2.5" fill="rgba(0,0,0,0.32)"/>
      <rect x="16" y="130" width="56" height="2" fill="rgba(255,160,50,0.14)"/>
      <rect x="16" y="130" width="2" height="90" fill="rgba(255,160,50,0.10)"/>
      <rect x="20" y="134" width="48" height="82" rx="1.5" fill="url(#panelFill)"/>
      <rect x="20" y="134" width="48" height="4" rx="1.5" fill="rgba(0,0,0,0.28)"/>
      <rect x="20" y="134" width="3" height="82" fill="rgba(0,0,0,0.20)"/>
      <rect x="22" y="136" width="44" height="78" rx="1" fill="none" stroke="rgba(255,140,30,0.05)" strokeWidth="1"/>

      {/* ══ PANEL BOTTOM-RIGHT ════════════════════════════════════ */}
      <rect x="88" y="130" width="56" height="90" rx="2.5" fill="rgba(0,0,0,0.32)"/>
      <rect x="88" y="130" width="56" height="2" fill="rgba(255,160,50,0.14)"/>
      <rect x="88" y="130" width="2" height="90" fill="rgba(255,160,50,0.10)"/>
      <rect x="92" y="134" width="48" height="82" rx="1.5" fill="url(#panelFill)"/>
      <rect x="92" y="134" width="48" height="4" rx="1.5" fill="rgba(0,0,0,0.28)"/>
      <rect x="92" y="134" width="3" height="82" fill="rgba(0,0,0,0.20)"/>
      <rect x="94" y="136" width="44" height="78" rx="1" fill="none" stroke="rgba(255,140,30,0.05)" strokeWidth="1"/>

      {/* ── HINGES (left, 2 pieces) ───────────────────────────── */}
      {/* Top hinge */}
      <rect x="8" y="36" width="10" height="26" rx="1.5" fill="url(#brassG)" filter="url(#softShadow)"/>
      <rect x="8" y="36" width="10" height="1.5" fill="rgba(255,230,140,0.60)"/>
      <circle cx="13" cy="42" r="2.2" fill="rgba(0,0,0,0.35)"/>
      <circle cx="13" cy="42" r="1.2" fill="rgba(255,220,100,0.60)"/>
      <circle cx="13" cy="56" r="2.2" fill="rgba(0,0,0,0.35)"/>
      <circle cx="13" cy="56" r="1.2" fill="rgba(255,220,100,0.60)"/>
      {/* Bottom hinge */}
      <rect x="8" y="178" width="10" height="26" rx="1.5" fill="url(#brassG)" filter="url(#softShadow)"/>
      <rect x="8" y="178" width="10" height="1.5" fill="rgba(255,230,140,0.60)"/>
      <circle cx="13" cy="184" r="2.2" fill="rgba(0,0,0,0.35)"/>
      <circle cx="13" cy="184" r="1.2" fill="rgba(255,220,100,0.60)"/>
      <circle cx="13" cy="198" r="2.2" fill="rgba(0,0,0,0.35)"/>
      <circle cx="13" cy="198" r="1.2" fill="rgba(255,220,100,0.60)"/>

      {/* ── KNOB ASSEMBLY ─────────────────────────────────────── */}
      {/* Back plate */}
      <rect x="118" y="104" width="20" height="32" rx="5" fill="url(#brassG)" filter="url(#softShadow)"/>
      <rect x="118" y="104" width="20" height="2" fill="rgba(255,230,140,0.65)"/>
      <rect x="118" y="104" width="2" height="32" fill="rgba(255,220,120,0.30)"/>
      {/* Knob circle */}
      <circle cx="128" cy="116" r="10" fill="url(#knobG)" filter="url(#softShadow)"/>
      {/* Knob specular highlight */}
      <ellipse cx="124" cy="112" rx="3.5" ry="2.5" fill="rgba(255,240,180,0.65)"/>
      {/* Keyhole */}
      <circle cx="128" cy="129" r="3.5" fill="#0a0500"/>
      <rect x="126.5" y="129" width="3" height="6" rx="0.5" fill="#0a0500"/>
      {/* Keyhole rim */}
      <circle cx="128" cy="129" r="3.5" fill="none" stroke="rgba(180,130,20,0.35)" strokeWidth="0.8"/>

      {/* ── LIGHT SEAM at right edge (when door is ajar) ──────── */}
      {lit && <rect x="150" y="8" width="2" height="224" fill="url(#lightG)" opacity="0.7"/>}
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PARTICLES — burst of sparks when door opens
═══════════════════════════════════════════════════════════════ */
interface Particle { id: number; angle: number; dist: number; size: number; delay: number; color: string }

function DoorParticles({ active }: { active: boolean }) {
  const particles: Particle[] = useMemo(() => {
    const COLORS = [
      "rgba(255,220,80,0.9)","rgba(251,191,36,0.85)","rgba(255,240,140,0.8)",
      "rgba(255,200,60,0.75)","rgba(255,255,200,0.70)","rgba(200,160,30,0.65)",
    ];
    return Array.from({ length: 18 }, (_, i) => ({
      id: i,
      angle: -80 + (Math.random() * 160),
      dist:  90  + Math.random() * 120,
      size:  2   + Math.random() * 4,
      delay: Math.random() * 0.35,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));
  }, []);

  if (!active) return null;
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex:10 }}>
      {particles.map(p => {
        const rad = (p.angle * Math.PI) / 180;
        const tx  = Math.cos(rad) * p.dist;
        const ty  = Math.sin(rad) * p.dist;
        return (
          <motion.div key={p.id}
            className="absolute rounded-full"
            style={{ width:p.size, height:p.size, background:p.color, top:"50%", left:"50%", marginLeft:-p.size/2, marginTop:-p.size/2 }}
            initial={{ opacity:1, x:0, y:0, scale:1 }}
            animate={{ opacity:0, x:tx, y:ty, scale:0 }}
            transition={{ duration:0.9+Math.random()*0.5, delay:p.delay, ease:[0.2,0,0.8,1] }}
          />
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DOOR OPENING ANIMATION — full cinematic sequence
═══════════════════════════════════════════════════════════════ */
function DoorOpening({ onDone }: { onDone: () => void }) {
  const [showParticles, setShowParticles] = useState(false);
  const controls = useAnimationControls();

  useEffect(() => {
    (async () => {
      // 1. Shake
      await controls.start({
        x:[0,-6,6,-5,5,-3,3,-1,1,0],
        transition:{ duration:0.55, ease:"easeOut" }
      });
      // 2. Swing open
      controls.start({
        rotateY:-82,
        transition:{ duration:2.1, ease:[0.35,0,0.25,1] }
      });
      // 3. Particles at mid-swing
      await new Promise(r => setTimeout(r, 900));
      setShowParticles(true);
      await new Promise(r => setTimeout(r, 1500));
      onDone();
    })();
  }, [controls, onDone]);

  return (
    <div className="flex flex-col items-center justify-center"
      style={{ minHeight:"calc(100dvh - 104px - env(safe-area-inset-bottom) - env(safe-area-inset-top))" }}>

      {/* Label */}
      <motion.p className="font-mono text-[10px] text-white/25 tracking-[0.45em] uppercase mb-10"
        initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.1 }}>
        opening…
      </motion.p>

      {/* 3-D scene */}
      <div className="relative flex items-center justify-center" style={{ perspective:"700px", height:280, width:200 }}>

        {/* Ambient glow behind door */}
        <motion.div className="absolute inset-0 rounded-xl"
          initial={{ opacity:0 }}
          animate={{ opacity:[0,0.4,0.85] }}
          transition={{ duration:2.6, times:[0,0.4,1], ease:"easeOut" }}
          style={{ background:"radial-gradient(circle,rgba(251,191,36,0.35) 0%,transparent 68%)" }}
        />

        {/* Light bleed from behind */}
        <motion.div className="absolute rounded-2xl"
          style={{ width:8, height:220, left:"50%", transform:"translateX(-50%)",
            background:"linear-gradient(to right,transparent,rgba(255,215,80,0.55),transparent)" }}
          initial={{ opacity:0, scaleY:0.6 }}
          animate={{ opacity:[0,0,0.7,1], scaleY:[0.6,0.6,1,1] }}
          transition={{ duration:2.6, times:[0,0.35,0.65,1] }}
        />

        {/* Door with 3-D swing */}
        <motion.div
          animate={controls}
          style={{ transformOrigin:"left center", transformStyle:"preserve-3d" }}
        >
          <RealDoor size={1.15} lit />
        </motion.div>

        {/* Particles */}
        <DoorParticles active={showParticles} />

        {/* Flash burst at full open */}
        <motion.div className="absolute inset-0 rounded-xl pointer-events-none"
          initial={{ opacity:0 }}
          animate={{ opacity:[0,0,0,0.55,0] }}
          transition={{ duration:2.8, times:[0,0.5,0.65,0.72,1] }}
          style={{ background:"radial-gradient(circle,rgba(255,230,120,0.45) 0%,transparent 70%)" }}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MISC COMPONENTS
═══════════════════════════════════════════════════════════════ */
function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631Zm-1.161 17.52h1.833L7.084 4.126H5.117Z"/>
    </svg>
  );
}

function RarityBadge({ rarity }: { rarity: Rarity }) {
  const c = RC[rarity];
  return (
    <span className="inline-block text-[10px] font-mono uppercase tracking-widest px-3 py-1 rounded-full"
      style={{ color:c.text, border:`1px solid ${c.border}`, background:c.bg }}>
      {RARITY_LABEL[rarity]}
    </span>
  );
}

function GlobalCounter({ base }: { base: number }) {
  const [count, setCount] = useState(base);
  useEffect(() => {
    const id = setInterval(() => setCount(c => c + Math.floor(Math.random() * 3)), 3200);
    return () => clearInterval(id);
  }, []);
  return <>{count.toLocaleString()}</>;
}

const FEED_PLAYERS = Array.from({ length: 30 }, () => `#${Math.floor(Math.random() * 9000) + 1000}`);
const FEED_RARITIES: Rarity[] = ["common","common","rare","rare","epic","legendary"];
interface FeedItem { id: number; player: string; coin: CoinName; rarity: Rarity; }

function FeedTicker() {
  const make = useCallback((): FeedItem => ({
    id: Date.now() + Math.random(),
    player: FEED_PLAYERS[Math.floor(Math.random() * FEED_PLAYERS.length)],
    coin:   COINS[Math.floor(Math.random() * COINS.length)],
    rarity: FEED_RARITIES[Math.floor(Math.random() * FEED_RARITIES.length)],
  }), []);
  const [items, setItems] = useState<FeedItem[]>(() => Array.from({ length: 5 }, make));
  useEffect(() => {
    const id = setInterval(() => setItems(p => [make(), ...p.slice(0, 4)]), 3800);
    return () => clearInterval(id);
  }, [make]);
  return (
    <div className="space-y-1.5">
      <AnimatePresence initial={false}>
        {items.map(item => (
          <motion.div key={item.id}
            initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            transition={{ duration:0.32 }}
            className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-white/22">Player {item.player}</span>
            <span className="text-white/10">·</span>
            <span className="font-mono text-[11px]" style={{ color:RC[item.rarity].text }}>{item.coin}</span>
            <span className="font-mono text-[9px]" style={{ color:RC[item.rarity].border }}>
              [{RARITY_LABEL[item.rarity]}]
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FLOATING DOOR CARD — pre-open state
═══════════════════════════════════════════════════════════════ */
function FloatingDoorCard({ doorNumber, onOpen }: { doorNumber:number; onOpen:()=>void }) {
  return (
    <div className="flex flex-col items-center text-center w-full px-6">
      <motion.p className="font-mono text-[10px] text-white/22 tracking-[0.45em] uppercase mb-8"
        initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }}>
        Your door awaits
      </motion.p>

      {/* Floating door */}
      <motion.div className="relative mb-8"
        animate={{ y:[0,-10,0] }}
        transition={{ duration:4, repeat:Infinity, ease:"easeInOut" }}>

        {/* Glow under door */}
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2"
          style={{ width:100, height:20, background:"radial-gradient(ellipse,rgba(251,191,36,0.22) 0%,transparent 70%)", filter:"blur(6px)" }} />

        {/* Ambient halo */}
        <motion.div className="absolute -inset-8 rounded-full -z-10"
          animate={{ opacity:[0.4,0.7,0.4] }}
          transition={{ duration:3, repeat:Infinity, ease:"easeInOut" }}
          style={{ background:"radial-gradient(circle,rgba(251,191,36,0.08) 0%,transparent 68%)" }} />

        <RealDoor size={1.1} />
      </motion.div>

      {/* Door number */}
      <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }}>
        <p className="font-mono text-[10px] text-white/22 uppercase tracking-widest mb-1.5">Door Number</p>
        <p className="text-4xl font-bold mb-10 text-amber-200/92"
          style={{ fontFamily:"'Cinzel',serif", letterSpacing:"0.04em", textShadow:"0 0 30px rgba(251,191,36,0.28)" }}>
          #{doorNumber.toLocaleString()}
        </p>
      </motion.div>

      <motion.button
        onClick={() => { haptic([15,40,20]); onOpen(); }}
        className="w-full max-w-[220px] rounded-full text-black font-bold uppercase tracking-widest"
        style={{ ...btnBase, height:54, fontSize:"0.78rem", fontFamily:"'Cinzel',serif",
          background:"linear-gradient(135deg,#fef3c7 0%,#fbbf24 42%,#f59e0b 100%)",
          boxShadow:"0 0 32px rgba(251,191,36,0.38),0 4px 20px rgba(0,0,0,0.5)" }}
        initial={{ opacity:0, scale:0.94 }} animate={{ opacity:1, scale:1 }} transition={{ delay:0.3, type:"spring", stiffness:260, damping:20 }}
        whileTap={{ scale:0.95 }}>
        Open Door
      </motion.button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   REWARD REVEAL
═══════════════════════════════════════════════════════════════ */
function RewardReveal({ reward, onClose, onShare }: { reward:Reward; onClose:()=>void; onShare:()=>void }) {
  const isEmpty = reward.rarity === "nothing";
  const c = RC[reward.rarity];
  const isGlowing = reward.rarity==="legendary"||reward.rarity==="mythic";

  const s = (i: number) => ({
    initial:{ opacity:0, y:20, filter:"blur(6px)" },
    animate:{ opacity:1, y:0, filter:"blur(0px)" },
    transition:{ duration:0.7, delay:i*0.13, ease:[0.16,1,0.3,1] as never },
  });

  return (
    <motion.div className="flex flex-col items-center text-center w-full px-6 py-8"
      initial={{ opacity:0, scale:0.92, y:28 }}
      animate={{ opacity:1, scale:1, y:0 }}
      transition={{ duration:0.7, ease:[0.16,1,0.3,1] }}>

      <motion.div className="mb-5" {...s(0)}><RarityBadge rarity={reward.rarity} /></motion.div>

      {isEmpty ? (
        <motion.div className="mb-8" {...s(1)}>
          <div className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center"
            style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)" }}>
            <span style={{ opacity:0.12, fontFamily:"'Cinzel',serif", fontSize:"1.8rem" }}>□</span>
          </div>
          <p className="font-mono text-[10px] text-white/20 uppercase tracking-[0.35em] mb-2">Nothing found</p>
          <p className="text-white/22 text-sm font-light">Door #{reward.doorNumber.toLocaleString()} was empty.</p>
          <p className="font-mono text-[9px] text-white/10 mt-2">{RARITY_PCT["nothing"]}</p>
        </motion.div>
      ) : (
        <motion.div className="mb-8" {...s(1)}>
          {/* Coin orb with outer ring */}
          <div className="relative mx-auto w-32 h-32 mb-6 flex items-center justify-center">
            {isGlowing && (
              <motion.div className="absolute inset-0 rounded-full -z-10"
                animate={{ opacity:[0.4,0.9,0.4], scale:[0.95,1.05,0.95] }}
                transition={{ duration:2.4, repeat:Infinity, ease:"easeInOut" }}
                style={{ background:`radial-gradient(circle,${c.bg} 0%,transparent 70%)`, filter:"blur(8px)" }}
              />
            )}
            <motion.div className="w-28 h-28 rounded-full flex items-center justify-center"
              style={{ background:`linear-gradient(145deg,${c.bg},rgba(0,0,0,0.4))`, border:`1px solid ${c.border}` }}
              animate={
                reward.rarity==="mythic"    ? { boxShadow:["0 0 40px rgba(255,255,255,0.28)","0 0 80px rgba(255,255,255,0.62)","0 0 40px rgba(255,255,255,0.28)"] }
              : reward.rarity==="legendary" ? { boxShadow:["0 0 28px rgba(251,191,36,0.38)","0 0 65px rgba(251,191,36,0.68)","0 0 28px rgba(251,191,36,0.38)"] }
              : { boxShadow: c.glow }
              }
              transition={{ duration:2.2, repeat:Infinity, ease:"easeInOut" }}>
              <span className="font-bold text-lg tracking-widest" style={{ color:c.text, fontFamily:"'Cinzel',serif",
                textShadow:isGlowing?`0 0 16px ${c.border}`:"none" }}>
                {reward.coin?.slice(0,2)}
              </span>
            </motion.div>
          </div>

          <h2 className="text-4xl font-bold mb-2"
            style={{ color:c.text, fontFamily:"'Cinzel',serif", letterSpacing:"0.09em",
              filter:isGlowing?`drop-shadow(0 0 20px ${c.border})`:"none" }}>
            {reward.coin}
          </h2>
          <p className="font-mono text-[10px] text-white/28 tracking-[0.3em] uppercase mb-1.5">
            Door #{reward.doorNumber.toLocaleString()}
          </p>
          <p className="font-mono text-[9px] text-white/16">{RARITY_PCT[reward.rarity]}</p>
        </motion.div>
      )}

      <motion.div className="flex items-center gap-2.5 w-full max-w-xs" {...s(isEmpty ? 2 : 3)}>
        {!isEmpty && (
          <button onClick={onShare}
            className="flex-shrink-0 px-5 rounded-full font-mono text-xs tracking-widest"
            style={{ ...btnBase, border:"1px solid rgba(255,255,255,0.10)", color:"rgba(255,255,255,0.40)",
              background:"rgba(255,255,255,0.04)", height:50 }}>
            Share
          </button>
        )}
        <motion.button onClick={() => { haptic(8); onClose(); }}
          className="flex-1 rounded-full text-black font-bold uppercase tracking-widest overflow-hidden relative"
          style={{ ...btnBase, height:52, fontSize:"0.76rem", fontFamily:"'Cinzel',serif",
            background:"linear-gradient(135deg,#fef3c7 0%,#fbbf24 42%,#f59e0b 100%)",
            boxShadow:"0 0 28px rgba(251,191,36,0.34),0 4px 16px rgba(0,0,0,0.5)" }}
          whileTap={{ scale:0.96 }}>
          <motion.div className="absolute inset-0 pointer-events-none"
            style={{ background:"linear-gradient(105deg,transparent 25%,rgba(255,255,255,0.38) 50%,transparent 75%)", backgroundSize:"220% 100%" }}
            animate={{ backgroundPosition:["-110% 0%","210% 0%"] }}
            transition={{ duration:2.2, repeat:Infinity, repeatDelay:2.2, ease:"easeInOut" }} />
          <span className="relative z-10">{isEmpty ? "Try Another" : "Open Next"}</span>
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HOME VIEW
═══════════════════════════════════════════════════════════════ */
function HomeView({ onOpenDoor }: { onOpenDoor:()=>void }) {
  const s = (i: number) => ({
    initial:{ opacity:0, y:16, filter:"blur(5px)" },
    animate:{ opacity:1, y:0, filter:"blur(0px)" },
    transition:{ duration:0.85, delay:0.15+i*0.13, ease:[0.16,1,0.3,1] as never },
  });
  return (
    <div className="flex flex-col items-center text-center px-5 py-8"
      style={{ minHeight:"calc(100dvh - 48px - 56px - env(safe-area-inset-top) - env(safe-area-inset-bottom))" }}>

      {/* Live counter */}
      <motion.div className="flex items-center gap-2.5 mb-7" {...s(0)}>
        <motion.span className="w-1.5 h-1.5 rounded-full bg-amber-400"
          animate={{ opacity:[1,0.2,1], scale:[1,1.6,1] }}
          transition={{ duration:2.1, repeat:Infinity, ease:"easeInOut" }} />
        <span className="font-mono text-[11px] text-amber-200/35 tracking-[0.3em] uppercase">
          <GlobalCounter base={4_821_943} /> doors opened
        </span>
      </motion.div>

      {/* Eyebrow */}
      <motion.p className="font-mono text-[10px] text-white/16 tracking-[0.55em] uppercase mb-5" {...s(1)}>
        10,000,000 doors exist
      </motion.p>

      {/* Headline */}
      <motion.div {...s(2)} className="mb-1">
        <h1 className="text-white leading-[0.92]"
          style={{ fontSize:"clamp(2.8rem,9vw,5.5rem)", fontWeight:700, letterSpacing:"0.03em", fontFamily:"'Cinzel',serif" }}>
          Each door
        </h1>
      </motion.div>
      <motion.div {...s(3)} className="mb-7">
        <h1 className="leading-[0.92] inline-block"
          style={{ fontSize:"clamp(2.8rem,9vw,5.5rem)", fontWeight:700, letterSpacing:"0.03em", fontFamily:"'Cinzel',serif",
            background:"linear-gradient(135deg,#fef9e7 0%,#fcd34d 28%,#f59e0b 62%,#d97706 100%)",
            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
            filter:"drop-shadow(0 0 22px rgba(251,191,36,0.42))" }}>
          opens once.
        </h1>
      </motion.div>

      <motion.div className="w-10 h-px mb-6"
        style={{ background:"linear-gradient(90deg,transparent,rgba(251,191,36,0.42),transparent)" }} {...s(4)} />

      <motion.p className="text-white/32 text-sm leading-loose tracking-wide mb-8 font-light" {...s(5)}>
        Most contain nothing.<br/>
        <span className="text-white/55 font-normal">Some hide rare discoveries.</span>
      </motion.p>

      {/* CTA */}
      <motion.button onClick={() => { haptic([18,30,12]); onOpenDoor(); }}
        className="relative flex items-center justify-center px-12 rounded-full overflow-hidden text-black mb-10 w-full max-w-xs"
        style={{ ...btnBase, height:56,
          background:"linear-gradient(135deg,#fef3c7 0%,#fbbf24 42%,#f59e0b 100%)",
          boxShadow:"0 0 36px rgba(251,191,36,0.36),0 0 72px rgba(251,191,36,0.10)",
          fontFamily:"'Cinzel',serif", fontWeight:700, fontSize:"0.76rem", letterSpacing:"0.22em" }}
        initial={{ opacity:0, y:12 }}
        animate={{ opacity:1, y:0 }}
        transition={{ delay:1.0, type:"spring", stiffness:260, damping:22 }}
        whileTap={{ scale:0.97 }}>
        <motion.div className="absolute inset-0 pointer-events-none"
          style={{ background:"linear-gradient(105deg,transparent 25%,rgba(255,255,255,0.44) 50%,transparent 75%)", backgroundSize:"220% 100%" }}
          animate={{ backgroundPosition:["-110% 0%","210% 0%"] }}
          transition={{ duration:2.6, repeat:Infinity, repeatDelay:2.8, ease:"easeInOut" }} />
        <span className="relative z-10 uppercase">Open a Door</span>
      </motion.button>

      {/* Live feed */}
      <motion.div className="w-full max-w-xs" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:1.2 }}>
        <p className="font-mono text-[9px] text-white/14 uppercase tracking-widest mb-3 text-left">Recent discoveries</p>
        <FeedTicker />
      </motion.div>

      {/* X follow link */}
      <motion.a href={X_URL} target="_blank" rel="noopener noreferrer"
        className="mt-8 flex items-center gap-2 px-4 py-2.5 rounded-full"
        style={{ color:"rgba(255,255,255,0.32)", border:"1px solid rgba(255,255,255,0.08)",
          background:"rgba(255,255,255,0.03)", WebkitTapHighlightColor:"transparent", textDecoration:"none" }}
        initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:1.6 }}
        whileTap={{ scale:0.96 }}>
        <XIcon size={13}/>
        <span className="font-mono text-[10px] tracking-widest">Follow @million_doors</span>
      </motion.a>

      {/* Lore */}
      <motion.div className="mt-8 max-w-xs" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:1.9 }}>
        <p className="text-white/11 text-[10px] font-light leading-relaxed italic">
          "No one knows who built the doors.<br/>
          Some believe they were created to preserve forgotten discoveries.<br/>
          Others believe every door remembers who opened it."
        </p>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   COLLECTION
═══════════════════════════════════════════════════════════════ */
function CollectionView({ collection }: { collection: StoredFind[] }) {
  if (collection.length === 0) {
    return (
      <motion.div className="flex flex-col items-center justify-center py-24 px-6 text-center"
        initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ duration:0.5 }}>
        <div className="mb-6" style={{ opacity:0.18 }}><RealDoor size={0.5}/></div>
        <p className="font-mono text-[10px] text-white/20 uppercase tracking-[0.3em] mb-2">No discoveries yet</p>
        <p className="text-white/14 text-sm font-light">Open a door to begin your collection.</p>
      </motion.div>
    );
  }
  return (
    <div className="px-4 pb-6">
      <p className="font-mono text-[9px] text-white/16 tracking-[0.3em] uppercase mb-4 pt-1">
        {collection.length} {collection.length===1?"discovery":"discoveries"}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {collection.map((item,i) => {
          const c = RC[item.rarity];
          const isGlowing = item.rarity==="legendary"||item.rarity==="mythic";
          return (
            <motion.div key={item.id}
              initial={{ opacity:0, scale:0.90, y:8 }} animate={{ opacity:1, scale:1, y:0 }}
              transition={{ delay:Math.min(i*0.045,0.45), type:"spring", stiffness:280, damping:24 }}
              className="rounded-2xl p-3.5 flex flex-col gap-2"
              style={{ background:"linear-gradient(145deg,#0e0b06,#09070300)",
                border:`1px solid ${c.border}`,
                boxShadow:isGlowing?c.shadow:"0 2px 12px rgba(0,0,0,0.5)" }}>
              <RarityBadge rarity={item.rarity}/>
              <div>
                <p className="font-bold text-sm truncate leading-tight"
                  style={{ color:c.text, fontFamily:"'Cinzel',serif", letterSpacing:"0.06em",
                    textShadow:isGlowing?`0 0 12px ${c.border}`:"none" }}>
                  {item.coin}
                </p>
                <p className="font-mono text-[9px] text-white/18 mt-0.5">#{item.doorNumber.toLocaleString()}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STATS
═══════════════════════════════════════════════════════════════ */
function StatsView({ stats, earned }: { stats:Stats; earned:string[] }) {
  const pct = Math.min(100, (stats.found / Math.max(stats.opened, 1)) * 100);
  const STAT_ITEMS: [string, number, string][] = [
    ["Doors Opened", stats.opened, "rgba(251,191,36,0.85)"],
    ["Coins Found",  stats.found,  "rgba(147,197,253,0.85)"],
    ["Legendary",    stats.legendary, "rgba(251,191,36,0.92)"],
    ["Mythic",       stats.mythic, "rgba(255,255,255,0.95)"],
  ];
  return (
    <div className="px-4 pb-6 space-y-3">
      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-2">
        {STAT_ITEMS.map(([label, value, color], i) => (
          <motion.div key={label}
            initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
            transition={{ delay:i*0.07, type:"spring", stiffness:280, damping:24 }}
            className="rounded-2xl p-4"
            style={{ background:"linear-gradient(145deg,#0e0b06,#07050200)", border:"1px solid rgba(255,255,255,0.07)" }}>
            <p className="font-mono text-[9px] text-white/20 uppercase tracking-[0.28em] mb-2">{label}</p>
            <p className="text-3xl font-bold leading-none" style={{ fontFamily:"'Cinzel',serif", color }}>{value.toLocaleString()}</p>
          </motion.div>
        ))}
      </div>

      {/* Find rate bar */}
      <motion.div className="rounded-2xl p-4"
        initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.28 }}
        style={{ background:"linear-gradient(145deg,#0e0b06,#07050200)", border:"1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center justify-between mb-3">
          <p className="font-mono text-[9px] text-white/20 uppercase tracking-[0.28em]">Find Rate</p>
          <p className="font-mono text-[9px] text-amber-300/60">{pct.toFixed(1)}%</p>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background:"rgba(255,255,255,0.06)" }}>
          <motion.div className="h-full rounded-full"
            style={{ background:"linear-gradient(90deg,#b45309,#fbbf24,#fef3c7)" }}
            initial={{ width:0 }} animate={{ width:`${pct}%` }}
            transition={{ duration:1.4, ease:[0.16,1,0.3,1] }} />
        </div>
      </motion.div>

      {/* Achievements */}
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.35 }}>
        <p className="font-mono text-[9px] text-white/18 uppercase tracking-[0.28em] mb-3">Achievements</p>
        <div className="space-y-2">
          {ACHIEVEMENTS.map((a, i) => {
            const unlocked = earned.includes(a.id);
            return (
              <motion.div key={a.id}
                initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }}
                transition={{ delay:0.38 + i*0.06 }}
                className="rounded-2xl p-3.5 flex items-center gap-3"
                style={{ background:unlocked?"linear-gradient(145deg,#100d04,#07060100)":"rgba(255,255,255,0.02)",
                  border:`1px solid ${unlocked?"rgba(251,191,36,0.18)":"rgba(255,255,255,0.055)"}`,
                  opacity:unlocked?1:0.32 }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0"
                  style={{ background:unlocked?"rgba(251,191,36,0.10)":"rgba(255,255,255,0.04)",
                    border:unlocked?"1px solid rgba(251,191,36,0.15)":"1px solid rgba(255,255,255,0.06)" }}>
                  {a.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-white/80 text-xs font-semibold truncate" style={{ fontFamily:"'Cinzel',serif" }}>{a.title}</p>
                  <p className="text-white/22 text-[10px] font-light mt-0.5">{a.desc}</p>
                </div>
                {unlocked && (
                  <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400/60 ml-auto" />
                )}
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DAILY DOOR
═══════════════════════════════════════════════════════════════ */
function DailyDoorView({ used, onOpen }: { used:boolean; onOpen:()=>void }) {
  const now  = new Date();
  const tmrw = new Date(now); tmrw.setDate(tmrw.getDate()+1); tmrw.setHours(0,0,0,0);
  const ms   = tmrw.getTime() - now.getTime();
  const h    = Math.floor(ms/3_600_000);
  const m    = Math.floor((ms%3_600_000)/60_000);
  return (
    <div className="flex flex-col items-center py-10 px-6 text-center">
      <motion.div className="relative mb-8"
        animate={used?{}:{ y:[0,-8,0] }}
        transition={{ duration:3.5, repeat:Infinity, ease:"easeInOut" }}>
        {!used && (
          <motion.div className="absolute -inset-6 -z-10 rounded-full"
            animate={{ opacity:[0.4,0.8,0.4] }} transition={{ duration:2.5, repeat:Infinity, ease:"easeInOut" }}
            style={{ background:"radial-gradient(circle,rgba(251,191,36,0.12) 0%,transparent 70%)" }} />
        )}
        <div style={{ opacity: used ? 0.22 : 1 }}>
          <RealDoor size={0.85} lit={!used} />
        </div>
      </motion.div>

      <p className="text-xl font-bold mb-2"
        style={{ fontFamily:"'Cinzel',serif", letterSpacing:"0.1em",
          color:used?"rgba(255,255,255,0.22)":"rgba(251,191,36,0.90)" }}>
        {used?"Come Back Tomorrow":"Daily Door Available"}
      </p>

      {used ? (
        <>
          <p className="font-mono text-sm text-white/25 tracking-wide mb-2">Resets in {h}h {m}m</p>
          <p className="text-white/18 text-xs font-light max-w-xs">One special door opens for you each day.</p>
        </>
      ) : (
        <>
          <p className="text-white/28 text-sm font-light mb-10 leading-relaxed max-w-xs">
            One special door opens for you each day.<br/>Today's door awaits.
          </p>
          <motion.button onClick={() => { haptic([20,40,20]); onOpen(); }}
            className="w-full max-w-xs rounded-full text-black font-bold uppercase tracking-widest"
            style={{ ...btnBase, height:54, fontSize:"0.78rem", fontFamily:"'Cinzel',serif",
              background:"linear-gradient(135deg,#fef3c7 0%,#fbbf24 42%,#f59e0b 100%)",
              boxShadow:"0 0 28px rgba(251,191,36,0.34)" }}
            initial={{ opacity:0, scale:0.94 }} animate={{ opacity:1, scale:1 }} transition={{ delay:0.3, type:"spring" }}
            whileTap={{ scale:0.97 }}>
            Open Daily Door
          </motion.button>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SHARE MODAL
═══════════════════════════════════════════════════════════════ */
function ShareModal({ reward, onClose }: { reward:Reward; onClose:()=>void }) {
  const [copied, setCopied] = useState(false);
  const text = `I opened Door #${reward.doorNumber.toLocaleString()} on ${SITE} and discovered ${reward.coin} [${RARITY_LABEL[reward.rarity]}].\n\n10,000,000 doors. Each one opens once.\n${SITE}`;
  const xText = encodeURIComponent(`I opened Door #${reward.doorNumber.toLocaleString()} and found ${reward.coin} (${RARITY_LABEL[reward.rarity]}) on ${SITE} — 10 million doors, each opens once.`);

  const copy = () => {
    navigator.clipboard.writeText(text).catch(()=>{});
    haptic(10);
    setCopied(true);
    setTimeout(()=>setCopied(false), 2200);
  };

  return (
    <motion.div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center px-4"
      style={{ paddingBottom:"calc(env(safe-area-inset-bottom) + 1rem)" }}
      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
      <div className="absolute inset-0 bg-black/80" style={{ backdropFilter:"blur(12px)" }} onClick={onClose}/>
      <motion.div className="relative w-full max-w-sm rounded-3xl border p-6"
        style={{ background:"#070500", borderColor:"rgba(251,191,36,0.15)" }}
        initial={{ y:40, scale:0.94 }} animate={{ y:0, scale:1 }} exit={{ y:40, scale:0.94 }}
        transition={{ type:"spring", stiffness:300, damping:28 }}>
        <p className="font-mono text-[9px] text-white/22 uppercase tracking-widest mb-3">Share Discovery</p>
        <div className="rounded-2xl p-4 mb-4"
          style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-white/45 text-sm leading-relaxed font-light">{text}</p>
        </div>
        <div className="flex gap-2.5">
          <a href={`https://twitter.com/intent/tweet?text=${xText}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 flex-shrink-0 px-4 rounded-full"
            style={{ height:48, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.10)",
              color:"rgba(255,255,255,0.65)", textDecoration:"none", WebkitTapHighlightColor:"transparent" }}>
            <XIcon size={14}/>
            <span className="font-mono text-[10px] tracking-widest">Post</span>
          </a>
          <button onClick={copy}
            className="flex-1 rounded-full text-black font-bold uppercase tracking-widest"
            style={{ ...btnBase, height:48, fontSize:"0.74rem", fontFamily:"'Cinzel',serif",
              background:"linear-gradient(135deg,#fef3c7 0%,#fbbf24 42%,#f59e0b 100%)" }}>
            {copied?"✓ Copied":"Copy Text"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ACHIEVEMENT TOAST
═══════════════════════════════════════════════════════════════ */
function AchievementToast({ achievement, onDone }: { achievement:Achievement; onDone:()=>void }) {
  useEffect(()=>{ const t=setTimeout(onDone,3600); return ()=>clearTimeout(t); },[onDone]);
  return (
    <motion.div className="fixed left-0 right-0 z-[200] flex justify-center px-4 pointer-events-none"
      style={{ top:"calc(env(safe-area-inset-top) + 52px)" }}
      initial={{ opacity:0, y:-14 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-14 }}
      transition={{ type:"spring", stiffness:300, damping:26 }}>
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
        style={{ background:"rgba(6,4,0,0.94)", border:"1px solid rgba(251,191,36,0.22)", backdropFilter:"blur(20px)" }}>
        <span className="text-base">{achievement.icon}</span>
        <div>
          <p className="font-mono text-[9px] text-amber-300/65 uppercase tracking-widest">Achievement unlocked</p>
          <p className="text-white/80 text-sm font-semibold" style={{ fontFamily:"'Cinzel',serif" }}>{achievement.title}</p>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════════════════════ */
const NAV: {id:View;label:string;icon:string}[] = [
  {id:"home",label:"Home",icon:"⌂"},
  {id:"collection",label:"Vault",icon:"◫"},
  {id:"stats",label:"Stats",icon:"◈"},
  {id:"daily",label:"Daily",icon:"◆"},
];

function BottomNav({ view, onView }: { view:View; onView:(v:View)=>void }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex"
      style={{ background:"rgba(4,3,0,0.96)", backdropFilter:"blur(28px)",
        borderTop:"1px solid rgba(255,255,255,0.06)",
        paddingBottom:"env(safe-area-inset-bottom)" }}>
      {NAV.map(item=>{
        const active = view===item.id;
        return (
          <button key={item.id}
            onClick={()=>{ haptic(6); onView(item.id); }}
            className="flex-1 flex flex-col items-center justify-center gap-1 relative"
            style={{ ...btnBase, height:56,
              color:active?"rgba(251,191,36,0.95)":"rgba(255,255,255,0.20)",
              transition:"color 0.2s ease" }}
            aria-label={item.label}>
            {/* Active pill bg */}
            {active && (
              <motion.div className="absolute inset-x-2 top-1 bottom-1 rounded-xl -z-10"
                layoutId="navActiveBg"
                style={{ background:"rgba(251,191,36,0.07)" }}
                transition={{ type:"spring", stiffness:400, damping:32 }}
              />
            )}
            <motion.span className="text-base leading-none"
              animate={{ scale:active?1.12:1, y:active?-1:0 }}
              transition={{ type:"spring", stiffness:380, damping:24 }}>
              {item.icon}
            </motion.span>
            <span className="text-[8px] font-mono tracking-widest uppercase"
              style={{ opacity:active?0.9:0.5 }}>
              {item.label}
            </span>
            {active && (
              <motion.div className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-6 rounded-full"
                layoutId="navIndicator"
                style={{ background:"linear-gradient(90deg,rgba(251,191,36,0.0),rgba(251,191,36,0.85),rgba(251,191,36,0.0))" }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

function TopBar({ onX }: { onX:()=>void }) {
  const [username, setUsername] = useState<string|null>(()=>{
    try { return localStorage.getItem(STORAGE_USER); } catch { return null; }
  });
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [handle, setHandle] = useState("");

  const submitLogin = () => {
    const t = handle.trim();
    if (t.length < 2) return;
    localStorage.setItem(STORAGE_USER, t);
    setUsername(t);
    setShowLoginPrompt(false);
    setHandle("");
  };

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4"
        style={{ height:48, paddingTop:"env(safe-area-inset-top)",
          background:"rgba(0,0,0,0.88)", backdropFilter:"blur(18px)",
          borderBottom:"1px solid rgba(255,255,255,0.045)" }}>
        <div className="flex items-center gap-2 text-amber-200/82">
          <span className="text-sm font-semibold uppercase tracking-widest" style={{ fontFamily:"'Cinzel',serif" }}>
            Million Doors
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* User pill */}
          {username ? (
            <motion.button
              onClick={()=>{ localStorage.removeItem(STORAGE_USER); setUsername(null); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{ ...btnBase, border:"1px solid rgba(251,191,36,0.22)", color:"rgba(251,191,36,0.72)",
                background:"rgba(251,191,36,0.07)", fontSize:"0.65rem", fontFamily:"'Cinzel',serif",
                letterSpacing:"0.08em" }}
              whileTap={{ scale:0.95 }}
              title="Tap to log out">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
              </svg>
              <span className="font-mono text-[9px] tracking-widest">{username}</span>
            </motion.button>
          ) : (
            <motion.button
              onClick={()=>setShowLoginPrompt(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{ ...btnBase, border:"1px solid rgba(255,255,255,0.10)", color:"rgba(255,255,255,0.40)",
                background:"rgba(255,255,255,0.04)", fontSize:"0.65rem", letterSpacing:"0.08em" }}
              whileTap={{ scale:0.95 }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>
              </svg>
              <span className="font-mono text-[9px] tracking-widest">Login</span>
            </motion.button>
          )}
          {/* X button */}
          <button onClick={onX}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{ ...btnBase, border:"1px solid rgba(255,255,255,0.08)", color:"rgba(255,255,255,0.32)",
              background:"rgba(255,255,255,0.03)" }}
            aria-label="Follow on X">
            <XIcon size={10}/>
            <span className="font-mono text-[9px] tracking-widest">@million_doors</span>
          </button>
        </div>
      </div>

      {/* Inline login sheet */}
      <AnimatePresence>
        {showLoginPrompt && (
          <motion.div className="fixed inset-0 z-[180] flex items-end sm:items-center justify-center px-4"
            style={{ paddingBottom:"calc(env(safe-area-inset-bottom) + 1rem)" }}
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            onClick={()=>setShowLoginPrompt(false)}>
            <div className="absolute inset-0 bg-black/75" style={{ backdropFilter:"blur(14px)" }}/>
            <motion.div className="relative w-full max-w-sm rounded-3xl border p-6"
              style={{ background:"#060400", borderColor:"rgba(251,191,36,0.16)",
                boxShadow:"0 0 60px rgba(251,191,36,0.08),0 24px 48px rgba(0,0,0,0.7)" }}
              initial={{ y:32, scale:0.96 }} animate={{ y:0, scale:1 }} exit={{ y:32, scale:0.96 }}
              transition={{ type:"spring", stiffness:320, damping:28 }}
              onClick={e=>e.stopPropagation()}>
              <p className="font-mono text-[9px] text-white/22 uppercase tracking-widest mb-4">Explorer Handle</p>
              <input
                type="text"
                value={handle}
                maxLength={24}
                placeholder="e.g. doorwalker"
                autoFocus
                onChange={e=>setHandle(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&submitLogin()}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white/82 text-sm placeholder:text-white/18 outline-none mb-4 font-mono tracking-wider"
                style={{ fontSize:"1rem" }}
              />
              <div className="flex gap-2.5">
                <button onClick={()=>setShowLoginPrompt(false)}
                  className="flex-shrink-0 px-5 rounded-full font-mono text-xs tracking-widest"
                  style={{ ...btnBase, border:"1px solid rgba(255,255,255,0.10)", color:"rgba(255,255,255,0.35)",
                    background:"rgba(255,255,255,0.04)", height:46 }}>
                  Cancel
                </button>
                <motion.button onClick={submitLogin}
                  className="flex-1 rounded-full text-black font-bold uppercase tracking-widest"
                  style={{ ...btnBase, height:46, fontSize:"0.74rem", fontFamily:"'Cinzel',serif",
                    background:"linear-gradient(135deg,#fef3c7 0%,#fbbf24 42%,#f59e0b 100%)" }}
                  whileTap={{ scale:0.97 }}>
                  Enter
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function SectionHeader({ title, sub }: { title:string; sub:string }) {
  return (
    <div className="pt-5 pb-3 px-4">
      <motion.h2
        className="text-xl font-semibold text-amber-100/85 mb-1"
        style={{ fontFamily:"'Cinzel',serif", letterSpacing:"0.08em" }}
        initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.5, ease:[0.16,1,0.3,1] }}>
        {title}
      </motion.h2>
      <p className="font-mono text-[9px] text-white/20 uppercase tracking-[0.3em]">{sub}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN APP PAGE
═══════════════════════════════════════════════════════════════ */
export default function AppPage() {
  const [view,    setView]   = useState<View>("home");
  const [phase,   setPhase]  = useState<Phase>("idle");
  const [doorNum, setDoorNum]= useState(0);
  const [reward,  setReward] = useState<Reward|null>(null);
  const [shareReward, setShareReward] = useState<Reward|null>(null);
  const [pendingAch,  setPendingAch]  = useState<Achievement|null>(null);

  const [collection, setCollection] = useState<StoredFind[]>(()=> loadJson(STORAGE.collection,[]));
  const [stats,      setStats]      = useState<Stats>(()=>         loadJson(STORAGE.stats,{opened:0,found:0,legendary:0,mythic:0}));
  const [earned,     setEarned]     = useState<string[]>(()=>      loadJson(STORAGE.achievements,[]));
  const [dailyUsed,  setDailyUsed]  = useState<boolean>(()=>{
    const d = loadJson<string|null>(STORAGE.daily,null);
    return d ? new Date(d).toDateString()===new Date().toDateString() : false;
  });

  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  /* iOS scroll lock */
  useEffect(()=>{
    document.body.style.overflow="hidden";
    document.body.style.position="fixed";
    document.body.style.width="100%";
    return()=>{
      document.body.style.overflow="";
      document.body.style.position="";
      document.body.style.width="";
    };
  },[]);

  const persist = useCallback((col:StoredFind[],st:Stats,ea:string[])=>{
    localStorage.setItem(STORAGE.collection, JSON.stringify(col));
    localStorage.setItem(STORAGE.stats,      JSON.stringify(st));
    localStorage.setItem(STORAGE.achievements,JSON.stringify(ea));
  },[]);

  const checkAch = useCallback((st:Stats,ea:string[]):string[]=>{
    const unlock:string[]=[];
    if(!ea.includes("first")           && st.opened>=1)   unlock.push("first");
    if(!ea.includes("ten")             && st.opened>=10)  unlock.push("ten");
    if(!ea.includes("fifty")           && st.opened>=50)  unlock.push("fifty");
    if(!ea.includes("hundred")         && st.opened>=100) unlock.push("hundred");
    if(!ea.includes("first_legendary") && st.legendary>=1)unlock.push("first_legendary");
    if(!ea.includes("first_mythic")    && st.mythic>=1)   unlock.push("first_mythic");
    if(unlock.length>0){
      const updated=[...ea,...unlock];
      setEarned(updated);
      const ach=ACHIEVEMENTS.find(a=>a.id===unlock[0]);
      if(ach)setPendingAch(ach);
      return updated;
    }
    return ea;
  },[]);

  const handleOpenDoor = useCallback((isDaily=false)=>{
    const door = randomDoor();
    setDoorNum(door);
    setReward(null);
    setPhase("selected");
    setView("home");
    if(isDaily){
      localStorage.setItem(STORAGE.daily, JSON.stringify(new Date().toISOString()));
      setDailyUsed(true);
    }
  },[]);

  const handleConfirmOpen = useCallback(()=>{
    setPhase("opening");
  },[]);

  /* Called by DoorOpening when animation done */
  const handleOpeningDone = useCallback(()=>{
    const r = fixReward(generateReward(doorNum), doorNum);
    const ns: Stats = {
      opened:    stats.opened+1,
      found:     stats.found+(r.rarity!=="nothing"?1:0),
      legendary: stats.legendary+(r.rarity==="legendary"?1:0),
      mythic:    stats.mythic+(r.rarity==="mythic"?1:0),
    };
    let nc = collection;
    if(r.coin){
      const item:StoredFind={id:`${doorNum}_${Date.now()}`,rarity:r.rarity,coin:r.coin,doorNumber:doorNum,ts:Date.now()};
      nc=[item,...collection];
      setCollection(nc);
    }
    setStats(ns);
    setReward(r);
    const ne = checkAch(ns, earned);
    persist(nc, ns, ne);
    if     (r.rarity==="mythic")    haptic([30,60,30,60,30]);
    else if(r.rarity==="legendary") haptic([20,50,20]);
    else if(r.rarity==="epic")      haptic([15,35,15]);
    else if(r.rarity==="rare")      haptic(22);
    setPhase("revealed");
  },[doorNum, stats, collection, earned, checkAch, persist]);

  const handleClose = useCallback(()=>{
    clearTimeout(timerRef.current);
    setPhase("idle");
    setReward(null);
    setDoorNum(0);
  },[]);

  const handleNav = useCallback((v:View)=>{
    if(phase!=="idle" && v!=="home") handleClose();
    setView(v);
  },[phase, handleClose]);

  const openX = ()=>{ window.open(X_URL,"_blank","noopener,noreferrer"); };
  const navH  = "calc(56px + env(safe-area-inset-bottom))";

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden select-none"
      style={{ WebkitTextSizeAdjust:"100%" }}>

      <AnimatePresence>
        {pendingAch && (
          <AchievementToast key={pendingAch.id} achievement={pendingAch} onDone={()=>setPendingAch(null)}/>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {shareReward && <ShareModal reward={shareReward} onClose={()=>setShareReward(null)}/>}
      </AnimatePresence>

      <TopBar onX={openX}/>

      {/* Scrollable content */}
      <div className="absolute inset-0 overflow-y-auto overscroll-contain"
        style={{ paddingTop:"calc(48px + env(safe-area-inset-top))", paddingBottom:navH,
          WebkitOverflowScrolling:"touch" }}>

        <AnimatePresence mode="wait">
          {view==="home" && phase==="idle" && (
            <motion.div key="home" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.18}}>
              <HomeView onOpenDoor={()=>handleOpenDoor(false)}/>
            </motion.div>
          )}

          {view==="home" && phase==="selected" && (
            <motion.div key="selected" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.18}}
              className="flex items-center justify-center"
              style={{minHeight:`calc(100dvh - 48px - env(safe-area-inset-top) - ${navH})`}}>
              <FloatingDoorCard doorNumber={doorNum} onOpen={handleConfirmOpen}/>
            </motion.div>
          )}

          {view==="home" && phase==="opening" && (
            <motion.div key="opening" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.18}}>
              <DoorOpening onDone={handleOpeningDone}/>
            </motion.div>
          )}

          {view==="home" && phase==="revealed" && reward && (
            <motion.div key="revealed" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.18}}
              className="flex items-center justify-center"
              style={{minHeight:`calc(100dvh - 48px - env(safe-area-inset-top) - ${navH})`}}>
              <RewardReveal reward={reward} onClose={handleClose} onShare={()=>setShareReward(reward)}/>
            </motion.div>
          )}

          {view==="collection" && (
            <motion.div key="col" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.18}}>
              <SectionHeader title="Vault" sub="Your discoveries"/>
              <CollectionView collection={collection}/>
            </motion.div>
          )}

          {view==="stats" && (
            <motion.div key="stats" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.18}}>
              <SectionHeader title="Statistics" sub="Your journey"/>
              <StatsView stats={stats} earned={earned}/>
            </motion.div>
          )}

          {view==="daily" && (
            <motion.div key="daily" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.18}}>
              <SectionHeader title="Daily Door" sub="One door per day"/>
              <DailyDoorView used={dailyUsed} onOpen={()=>{ setView("home"); handleOpenDoor(true); }}/>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomNav view={view} onView={handleNav}/>
    </div>
  );
}
