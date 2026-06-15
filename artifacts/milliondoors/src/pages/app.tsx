import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, useRef } from "react";

/* ─── Disable overscroll/bounce globally ─────────────────────── */
if (typeof document !== "undefined") {
  document.documentElement.style.overscrollBehavior = "none";
}

/* ─── Constants ─────────────────────────────────────────────── */
const COINS = ["ORYNTH","ARTMAP","KWOK","COINFLIP","BASEFUN","CULTURE","VISION","NOTE","CITY","ORBIT"] as const;
type CoinName = typeof COINS[number];
type Rarity   = "nothing" | "common" | "rare" | "epic" | "legendary" | "mythic";
type View     = "home" | "collection" | "stats" | "daily";
type Phase    = "idle" | "selected" | "opening" | "revealed";

interface Reward     { rarity: Rarity; coin?: CoinName; doorNumber: number; }
interface StoredFind { id: string; rarity: Rarity; coin: CoinName; doorNumber: number; ts: number; }
interface Stats      { opened: number; found: number; legendary: number; mythic: number; }
interface Achievement{ id: string; title: string; desc: string; }

const STORAGE = { collection:"md_collection", stats:"md_stats", achievements:"md_achievements", daily:"md_daily" };

const ACHIEVEMENTS: Achievement[] = [
  { id:"first",           title:"First Door",     desc:"You opened your first door."      },
  { id:"ten",             title:"Ten Doors",       desc:"Ten doors opened."                },
  { id:"fifty",           title:"Fifty Doors",     desc:"Fifty doors and counting."        },
  { id:"hundred",         title:"Century",         desc:"One hundred doors opened."        },
  { id:"first_legendary", title:"Legendary Find",  desc:"Your first legendary discovery."  },
  { id:"first_mythic",    title:"Mythic Find",     desc:"You found the rarest of all."     },
];

/* Color per rarity — no string manipulation, explicit values */
const RC: Record<Rarity, { text: string; border: string; bg: string; glow: string }> = {
  nothing:   { text:"rgba(255,255,255,0.30)", border:"rgba(255,255,255,0.10)", bg:"rgba(255,255,255,0.03)", glow:"none" },
  common:    { text:"rgba(255,255,255,0.75)", border:"rgba(255,255,255,0.18)", bg:"rgba(255,255,255,0.05)", glow:"none" },
  rare:      { text:"rgba(147,197,253,0.92)", border:"rgba(147,197,253,0.24)", bg:"rgba(147,197,253,0.06)", glow:"0 0 28px rgba(147,197,253,0.28)" },
  epic:      { text:"rgba(196,181,253,0.92)", border:"rgba(196,181,253,0.24)", bg:"rgba(196,181,253,0.07)", glow:"0 0 36px rgba(196,181,253,0.38)" },
  legendary: { text:"rgba(251,191,36,0.96)",  border:"rgba(251,191,36,0.28)",  bg:"rgba(251,191,36,0.08)",  glow:"0 0 55px rgba(251,191,36,0.50)"  },
  mythic:    { text:"rgba(255,255,255,1.00)",  border:"rgba(255,255,255,0.35)", bg:"rgba(255,255,255,0.08)", glow:"0 0 80px rgba(255,255,255,0.60), 0 0 160px rgba(255,255,255,0.18)" },
};

const RARITY_LABEL: Record<Rarity, string> = {
  nothing:"Empty", common:"Common", rare:"Rare", epic:"Epic", legendary:"Legendary", mythic:"Mythic",
};

/* ─── Helpers ────────────────────────────────────────────────── */
function randomDoor() { return Math.floor(Math.random() * 9_000_000) + 1_000_000; }

function generateReward(doorNumber: number): Reward {
  const roll = Math.random() * 100;
  const coin = COINS[Math.floor(Math.random() * COINS.length)];
  if (roll < 70)   return { rarity:"nothing",   doorNumber };
  if (roll < 90)   return { rarity:"common",    coin, doorNumber };
  if (roll < 97)   return { rarity:"rare",      coin, doorNumber };
  if (roll < 99)   return { rarity:"epic",      coin, doorNumber };
  if (roll < 99.9) return { rarity:"legendary", coin, doorNumber };
  return                   { rarity:"mythic",   coin, doorNumber };
}

function loadJson<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
}

function haptic(ms = 12) { try { navigator.vibrate?.(ms); } catch {} }

/* Touch-friendly button base styles */
const btnBase: React.CSSProperties = {
  WebkitTapHighlightColor: "transparent",
  touchAction: "manipulation",
  userSelect: "none",
  cursor: "pointer",
};

/* ─── DoorMark SVG ───────────────────────────────────────────── */
function DoorMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect x="4"  y="4"  width="17" height="26" rx="2.5" stroke="currentColor" strokeWidth="2.2"/>
      <rect x="27" y="4"  width="17" height="26" rx="2.5" stroke="currentColor" strokeWidth="2.2"/>
      <rect x="4"  y="34" width="17" height="10" rx="2.5" stroke="currentColor" strokeWidth="2.2"/>
      <rect x="27" y="34" width="17" height="10" rx="2.5" stroke="currentColor" strokeWidth="2.2"/>
      <circle cx="19.5" cy="17" r="1.8" fill="currentColor" opacity="0.6"/>
      <circle cx="28.5" cy="17" r="1.8" fill="currentColor" opacity="0.6"/>
    </svg>
  );
}

/* ─── Rarity Badge ───────────────────────────────────────────── */
function RarityBadge({ rarity }: { rarity: Rarity }) {
  const c = RC[rarity];
  return (
    <span
      className="inline-block text-[10px] font-mono uppercase tracking-widest px-3 py-1 rounded-full"
      style={{ color: c.text, border:`1px solid ${c.border}`, background: c.bg }}
    >
      {RARITY_LABEL[rarity]}
    </span>
  );
}

/* ─── Global Counter ─────────────────────────────────────────── */
function GlobalCounter({ base }: { base: number }) {
  const [count, setCount] = useState(base);
  useEffect(() => {
    const id = setInterval(() => setCount(c => c + Math.floor(Math.random() * 3)), 3200);
    return () => clearInterval(id);
  }, []);
  return <>{count.toLocaleString()}</>;
}

/* ─── Live Feed Ticker ───────────────────────────────────────── */
const FEED_PLAYERS = Array.from({ length: 30 }, () => `#${Math.floor(Math.random() * 9000) + 1000}`);
const FEED_RARITIES: Rarity[] = ["common","common","rare","rare","epic","legendary"];
interface FeedItem { id: number; player: string; coin: CoinName; rarity: Rarity; }

function FeedTicker() {
  const makeFeedItem = useCallback((): FeedItem => ({
    id: Date.now() + Math.random(),
    player: FEED_PLAYERS[Math.floor(Math.random() * FEED_PLAYERS.length)],
    coin:   COINS[Math.floor(Math.random() * COINS.length)],
    rarity: FEED_RARITIES[Math.floor(Math.random() * FEED_RARITIES.length)],
  }), []);

  const [items, setItems] = useState<FeedItem[]>(() => Array.from({ length: 5 }, makeFeedItem));

  useEffect(() => {
    const id = setInterval(() => setItems(p => [makeFeedItem(), ...p.slice(0, 4)]), 3800);
    return () => clearInterval(id);
  }, [makeFeedItem]);

  return (
    <div className="space-y-2">
      <AnimatePresence initial={false}>
        {items.map(item => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="flex items-center gap-2"
          >
            <span className="font-mono text-[11px] text-white/25">Player {item.player}</span>
            <span className="text-white/12">·</span>
            <span className="font-mono text-[11px]" style={{ color: RC[item.rarity].text }}>{item.coin}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ─── Door Opening Animation ─────────────────────────────────── */
function DoorOpening() {
  return (
    <div className="flex items-center justify-center" style={{ perspective:"640px", height:260 }}>
      <div className="relative" style={{ width:140, height:210 }}>
        {/* Ambient glow behind door */}
        <motion.div className="absolute inset-0 rounded-xl"
          initial={{ opacity:0 }}
          animate={{ opacity:[0, 0.5, 1] }}
          transition={{ duration:2.8, times:[0, 0.45, 1] }}
          style={{ background:"radial-gradient(circle, rgba(251,191,36,0.22) 0%, transparent 72%)" }}
        />
        {/* Door panel swings open in 3D */}
        <motion.div className="absolute inset-0 rounded-xl"
          style={{
            background:"linear-gradient(155deg, #120d00 0%, #060400 100%)",
            border:"1px solid rgba(251,191,36,0.24)",
            transformOrigin:"left center",
            transformStyle:"preserve-3d",
          }}
          initial={{ rotateY:0 }}
          animate={{ rotateY:-78 }}
          transition={{ duration:2.1, delay:0.4, ease:[0.4, 0, 0.2, 1] }}
        >
          <div className="absolute rounded" style={{ inset:"12px 10px", border:"1px solid rgba(251,191,36,0.09)" }} />
          <div className="absolute rounded-full"
            style={{ width:9, height:9, right:18, top:"50%", transform:"translateY(-50%)", border:"1px solid rgba(251,191,36,0.4)", background:"rgba(251,191,36,0.10)" }}
          />
        </motion.div>
        {/* Shake at start */}
        <motion.div className="absolute inset-0"
          animate={{ x:[0,-6,6,-5,5,-3,3,-1,1,0] }}
          transition={{ duration:0.6, delay:0.05 }}
        />
        {/* Light burst */}
        <motion.div className="absolute inset-0 rounded-xl pointer-events-none"
          initial={{ opacity:0, scale:0.85 }}
          animate={{ opacity:[0,0,0.8,1], scale:[0.85,0.85,1.1,1] }}
          transition={{ duration:2.8, times:[0,0.42,0.72,1] }}
          style={{ background:"radial-gradient(circle, rgba(255,220,110,0.28) 0%, transparent 68%)" }}
        />
      </div>
    </div>
  );
}

/* ─── Reward Reveal ──────────────────────────────────────────── */
function RewardReveal({ reward, onClose, onShare }: { reward: Reward; onClose:()=>void; onShare:()=>void }) {
  const isEmpty = reward.rarity === "nothing";
  const c = RC[reward.rarity];

  const stagger = (i: number) => ({
    initial: { opacity:0, y:16 },
    animate: { opacity:1, y:0 },
    transition: { duration:0.55, delay: i * 0.13, ease:[0.16,1,0.3,1] as never },
  });

  return (
    <motion.div
      className="flex flex-col items-center text-center w-full px-6 py-6"
      initial={{ opacity:0, scale:0.94, y:20 }}
      animate={{ opacity:1, scale:1, y:0 }}
      transition={{ duration:0.6, ease:[0.16,1,0.3,1] }}
    >
      <motion.div className="mb-5" {...stagger(0)}>
        <RarityBadge rarity={reward.rarity} />
      </motion.div>

      {isEmpty ? (
        <motion.div className="mb-8" {...stagger(1)}>
          <div className="w-20 h-20 rounded-full mx-auto mb-5 flex items-center justify-center"
            style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)" }}>
            <span className="text-white/15 text-2xl" style={{ fontFamily:"'Cinzel',serif" }}>□</span>
          </div>
          <p className="font-mono text-[10px] text-white/22 uppercase tracking-widest mb-2">Nothing found</p>
          <p className="text-white/22 text-sm font-light">Door #{reward.doorNumber.toLocaleString()} was empty.</p>
        </motion.div>
      ) : (
        <motion.div className="mb-8" {...stagger(1)}>
          {/* Coin orb */}
          <motion.div
            className="w-28 h-28 rounded-full mx-auto mb-5 flex items-center justify-center"
            style={{ background: c.bg, border:`1px solid ${c.border}`, boxShadow: c.glow }}
            animate={
              reward.rarity === "mythic"
                ? { boxShadow:["0 0 40px rgba(255,255,255,0.3)","0 0 80px rgba(255,255,255,0.65)","0 0 40px rgba(255,255,255,0.3)"] }
                : reward.rarity === "legendary"
                ? { boxShadow:["0 0 30px rgba(251,191,36,0.42)","0 0 65px rgba(251,191,36,0.72)","0 0 30px rgba(251,191,36,0.42)"] }
                : {}
            }
            transition={{ duration:2.2, repeat:Infinity, ease:"easeInOut" }}
          >
            <span className="font-bold text-base tracking-widest" style={{ color:c.text, fontFamily:"'Cinzel',serif" }}>
              {reward.coin?.slice(0, 2)}
            </span>
          </motion.div>

          <h2 className="text-4xl font-bold mb-2"
            style={{ color:c.text, fontFamily:"'Cinzel',serif", letterSpacing:"0.09em",
              filter: c.glow !== "none" ? `drop-shadow(0 0 16px ${c.border})` : "none" }}>
            {reward.coin}
          </h2>
          <p className="font-mono text-[10px] text-white/30 tracking-widest uppercase">
            Found in Door #{reward.doorNumber.toLocaleString()}
          </p>
          <p className="text-white/18 text-[10px] font-mono mt-1">
            {reward.rarity === "mythic" ? "Discovered by 0.1% of players"
            : reward.rarity === "legendary" ? "Discovered by 0.9% of players"
            : reward.rarity === "epic" ? "Discovered by 2% of players"
            : reward.rarity === "rare" ? "Discovered by 7% of players"
            : "Discovered by 20% of players"}
          </p>
        </motion.div>
      )}

      {/* Action buttons */}
      <motion.div className="flex items-center gap-3 w-full max-w-xs" {...stagger(isEmpty ? 2 : 3)}>
        {!isEmpty && (
          <button
            onClick={onShare}
            className="flex-shrink-0 px-5 rounded-full font-mono text-xs tracking-widest"
            style={{ ...btnBase, border:"1px solid rgba(255,255,255,0.12)", color:"rgba(255,255,255,0.42)",
              background:"rgba(255,255,255,0.04)", height:48 }}
          >
            Share
          </button>
        )}
        <motion.button
          onClick={() => { haptic(8); onClose(); }}
          className="flex-1 rounded-full text-black text-xs font-bold uppercase tracking-widest"
          style={{ ...btnBase, background:"linear-gradient(135deg,#fef3c7 0%,#fbbf24 42%,#f59e0b 100%)",
            fontFamily:"'Cinzel',serif", height:52, boxShadow:"0 0 24px rgba(251,191,36,0.32)" }}
          whileTap={{ scale:0.96 }}
          transition={{ type:"spring", stiffness:400, damping:22 }}
        >
          {isEmpty ? "Try Another" : "Open Next"}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

/* ─── Floating Door Card ─────────────────────────────────────── */
function FloatingDoorCard({ doorNumber, onOpen }: { doorNumber:number; onOpen:()=>void }) {
  return (
    <div className="flex flex-col items-center text-center w-full max-w-xs mx-auto px-6">
      <p className="font-mono text-[10px] text-white/22 tracking-[0.45em] uppercase mb-8">Your door awaits</p>

      <motion.div className="relative mb-8"
        animate={{ y:[0,-8,0] }}
        transition={{ duration:3.8, repeat:Infinity, ease:"easeInOut" }}
      >
        <div className="w-40 h-56 rounded-xl flex flex-col items-center justify-between py-5 px-4"
          style={{ background:"linear-gradient(150deg,#110900 0%,#050400 100%)",
            border:"1px solid rgba(251,191,36,0.22)",
            boxShadow:"0 0 48px rgba(251,191,36,0.07), inset 0 1px 0 rgba(255,255,255,0.04)" }}>
          <div className="w-full h-20 rounded" style={{ border:"1px solid rgba(251,191,36,0.09)" }} />
          <div className="w-3 h-3 rounded-full"
            style={{ border:"1px solid rgba(251,191,36,0.38)", background:"rgba(251,191,36,0.08)" }} />
          <div className="w-full h-14 rounded" style={{ border:"1px solid rgba(251,191,36,0.09)" }} />
        </div>
        <div className="absolute -inset-8 -z-10 rounded-3xl"
          style={{ background:"radial-gradient(circle,rgba(251,191,36,0.04) 0%,transparent 70%)" }} />
      </motion.div>

      <p className="font-mono text-[10px] text-white/22 uppercase tracking-widest mb-1">Door Number</p>
      <p className="text-4xl font-bold mb-10 text-amber-200/90"
        style={{ fontFamily:"'Cinzel',serif", letterSpacing:"0.04em" }}>
        #{doorNumber.toLocaleString()}
      </p>

      <motion.button
        onClick={() => { haptic(15); onOpen(); }}
        className="w-full max-w-[200px] rounded-full text-black text-sm font-bold uppercase tracking-widest"
        style={{ ...btnBase, background:"linear-gradient(135deg,#fef3c7 0%,#fbbf24 42%,#f59e0b 100%)",
          fontFamily:"'Cinzel',serif", height:52, boxShadow:"0 0 28px rgba(251,191,36,0.32)" }}
        whileTap={{ scale:0.96 }}
        transition={{ type:"spring", stiffness:400, damping:22 }}
      >
        Open
      </motion.button>
    </div>
  );
}

/* ─── Home View ──────────────────────────────────────────────── */
function HomeView({ onOpenDoor }: { onOpenDoor:()=>void }) {
  const s = (i: number) => ({
    initial:{ opacity:0, y:16, filter:"blur(5px)" },
    animate:{ opacity:1, y:0, filter:"blur(0px)" },
    transition:{ duration:0.85, delay:0.18 + i*0.13, ease:[0.16,1,0.3,1] as never },
  });

  return (
    <div className="flex flex-col items-center justify-center text-center px-5 py-10"
      style={{ minHeight:"calc(100dvh - 3rem - 56px - env(safe-area-inset-bottom))" }}>

      {/* Live counter */}
      <motion.div className="flex items-center gap-2.5 mb-7" {...s(0)}>
        <motion.span className="w-1.5 h-1.5 rounded-full bg-amber-400"
          animate={{ opacity:[1,0.2,1], scale:[1,1.5,1] }}
          transition={{ duration:2, repeat:Infinity, ease:"easeInOut" }} />
        <span className="font-mono text-[11px] text-amber-200/35 tracking-[0.32em] uppercase">
          <GlobalCounter base={4_821_943} /> doors opened
        </span>
      </motion.div>

      {/* Eyebrow */}
      <motion.p className="font-mono text-[10px] text-white/18 tracking-[0.55em] uppercase mb-5" {...s(1)}>
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
        <h1 className="leading-[0.92]"
          style={{ fontSize:"clamp(2.8rem,9vw,5.5rem)", fontWeight:700, letterSpacing:"0.03em",
            fontFamily:"'Cinzel',serif",
            background:"linear-gradient(135deg,#fef9e7 0%,#fcd34d 28%,#f59e0b 62%,#d97706 100%)",
            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
            filter:"drop-shadow(0 0 22px rgba(251,191,36,0.42))", display:"inline-block" }}>
          opens once.
        </h1>
      </motion.div>

      {/* Divider */}
      <motion.div className="w-10 h-px mb-6"
        style={{ background:"linear-gradient(90deg,transparent,rgba(251,191,36,0.42),transparent)" }}
        {...s(4)} />

      {/* Body */}
      <motion.p className="text-white/35 text-sm leading-loose tracking-wide mb-8 font-light" {...s(5)}>
        Most contain nothing.<br />
        <span className="text-white/55 font-normal">Some hide rare discoveries.</span>
      </motion.p>

      {/* CTA */}
      <motion.button
        onClick={() => { haptic(18); onOpenDoor(); }}
        className="relative flex items-center justify-center px-12 rounded-full overflow-hidden text-black mb-10 w-full max-w-xs"
        style={{ ...btnBase, height:56,
          background:"linear-gradient(135deg,#fef3c7 0%,#fbbf24 42%,#f59e0b 100%)",
          boxShadow:"0 0 36px rgba(251,191,36,0.36),0 0 72px rgba(251,191,36,0.10)",
          fontFamily:"'Cinzel',serif", fontWeight:700, fontSize:"0.76rem", letterSpacing:"0.22em" }}
        initial={{ opacity:0, y:12 }}
        animate={{ opacity:1, y:0 }}
        transition={{ delay:1.0, type:"spring", stiffness:260, damping:22 }}
        whileTap={{ scale:0.97 }}
      >
        <motion.div className="absolute inset-0 pointer-events-none"
          style={{ background:"linear-gradient(105deg,transparent 25%,rgba(255,255,255,0.44) 50%,transparent 75%)", backgroundSize:"220% 100%" }}
          animate={{ backgroundPosition:["-110% 0%","210% 0%"] }}
          transition={{ duration:2.6, repeat:Infinity, repeatDelay:2.8, ease:"easeInOut" }} />
        <span className="relative z-10 uppercase">Open a Door</span>
      </motion.button>

      {/* Live feed */}
      <motion.div className="w-full max-w-xs" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:1.3 }}>
        <p className="font-mono text-[9px] text-white/15 uppercase tracking-widest mb-3 text-left">Recent discoveries</p>
        <FeedTicker />
      </motion.div>

      {/* Lore */}
      <motion.div className="mt-10 max-w-xs" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:1.8 }}>
        <p className="text-white/13 text-[10px] font-light leading-relaxed italic">
          "No one knows who built the doors.<br />
          Some believe they were created to preserve forgotten discoveries.<br />
          Others believe every door remembers who opened it."
        </p>
      </motion.div>
    </div>
  );
}

/* ─── Collection View ────────────────────────────────────────── */
function CollectionView({ collection }: { collection: StoredFind[] }) {
  if (collection.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl mb-5 flex items-center justify-center text-white/15"
          style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)" }}>
          <DoorMark size={30} />
        </div>
        <p className="font-mono text-[11px] text-white/20 uppercase tracking-widest mb-2">No discoveries yet</p>
        <p className="text-white/15 text-sm font-light">Open a door to begin your collection.</p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-4">
      <p className="font-mono text-[10px] text-white/18 tracking-widest uppercase mb-4 pt-2">
        {collection.length} {collection.length === 1 ? "discovery" : "discoveries"}
      </p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {collection.map((item, i) => {
          const c = RC[item.rarity];
          return (
            <motion.div key={item.id}
              initial={{ opacity:0, scale:0.92 }}
              animate={{ opacity:1, scale:1 }}
              transition={{ delay: Math.min(i * 0.04, 0.4) }}
              className="rounded-2xl p-4"
              style={{ background:"#101010", border:`1px solid ${c.border}`,
                boxShadow: (item.rarity==="legendary"||item.rarity==="mythic") ? c.glow : undefined }}>
              <div className="mb-2.5"><RarityBadge rarity={item.rarity} /></div>
              <p className="font-bold text-sm mb-0.5 truncate"
                style={{ color:c.text, fontFamily:"'Cinzel',serif", letterSpacing:"0.05em" }}>
                {item.coin}
              </p>
              <p className="font-mono text-[9px] text-white/20">Door #{item.doorNumber.toLocaleString()}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Stats View ─────────────────────────────────────────────── */
function StatsView({ stats, earned }: { stats: Stats; earned: string[] }) {
  const completion = Math.min(100, (stats.found / 10) * 100);
  return (
    <div className="px-4 pb-4 space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        {[
          { label:"Doors Opened", value:stats.opened   },
          { label:"Coins Found",  value:stats.found    },
          { label:"Legendary",    value:stats.legendary },
          { label:"Mythic",       value:stats.mythic   },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-2xl p-4"
            style={{ background:"#101010", border:"1px solid rgba(255,255,255,0.07)" }}>
            <p className="font-mono text-[9px] text-white/22 uppercase tracking-widest mb-1.5">{label}</p>
            <p className="text-3xl font-bold text-amber-200/88" style={{ fontFamily:"'Cinzel',serif" }}>
              {value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className="rounded-2xl p-4" style={{ background:"#101010", border:"1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center justify-between mb-3">
          <p className="font-mono text-[9px] text-white/22 uppercase tracking-widest">Collection</p>
          <p className="font-mono text-[9px] text-amber-300/55">{completion.toFixed(1)}%</p>
        </div>
        <div className="h-1 rounded-full overflow-hidden" style={{ background:"rgba(255,255,255,0.06)" }}>
          <motion.div className="h-full rounded-full"
            style={{ background:"linear-gradient(90deg,#f59e0b,#fbbf24)" }}
            initial={{ width:0 }}
            animate={{ width:`${completion}%` }}
            transition={{ duration:1.2, ease:"easeOut" }} />
        </div>
      </div>

      {/* Achievements */}
      <div>
        <p className="font-mono text-[9px] text-white/22 uppercase tracking-widest mb-3">Achievements</p>
        <div className="space-y-2">
          {ACHIEVEMENTS.map(a => {
            const unlocked = earned.includes(a.id);
            return (
              <div key={a.id} className="rounded-2xl p-4 flex items-center gap-3"
                style={{ background:"#101010",
                  border:`1px solid ${unlocked?"rgba(251,191,36,0.18)":"rgba(255,255,255,0.06)"}`,
                  opacity: unlocked ? 1 : 0.4 }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                  style={{ background: unlocked?"rgba(251,191,36,0.10)":"rgba(255,255,255,0.04)",
                    color: unlocked?"rgba(251,191,36,0.9)":"rgba(255,255,255,0.3)" }}>
                  {unlocked ? "◆" : "○"}
                </div>
                <div>
                  <p className="text-white/78 text-xs font-semibold" style={{ fontFamily:"'Cinzel',serif" }}>{a.title}</p>
                  <p className="text-white/25 text-[10px] font-light mt-0.5">{a.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Daily Door View ────────────────────────────────────────── */
function DailyDoorView({ used, onOpen }: { used:boolean; onOpen:()=>void }) {
  const now      = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate()+1); tomorrow.setHours(0,0,0,0);
  const ms = tomorrow.getTime() - now.getTime();
  const h  = Math.floor(ms / 3_600_000);
  const m  = Math.floor((ms % 3_600_000) / 60_000);

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <motion.div className="w-32 h-32 rounded-3xl mb-7 flex items-center justify-center"
        style={{ background: used?"rgba(255,255,255,0.03)":"rgba(251,191,36,0.07)",
          border: used?"1px solid rgba(255,255,255,0.07)":"1px solid rgba(251,191,36,0.24)",
          color: used?"rgba(255,255,255,0.18)":"rgba(251,191,36,0.82)" }}
        animate={used ? {} : { boxShadow:["0 0 18px rgba(251,191,36,0.10)","0 0 50px rgba(251,191,36,0.26)","0 0 18px rgba(251,191,36,0.10)"] }}
        transition={{ duration:2.6, repeat:Infinity, ease:"easeInOut" }}>
        <DoorMark size={48} />
      </motion.div>

      <p className="text-xl font-bold mb-2"
        style={{ fontFamily:"'Cinzel',serif", letterSpacing:"0.1em",
          color: used?"rgba(255,255,255,0.22)":"rgba(251,191,36,0.90)" }}>
        {used ? "Come Back Tomorrow" : "Daily Door Available"}
      </p>

      {used ? (
        <>
          <p className="font-mono text-sm text-white/25 tracking-wide mb-2">Resets in {h}h {m}m</p>
          <p className="text-white/18 text-xs font-light max-w-xs">One special door opens for you each day. Check back tomorrow.</p>
        </>
      ) : (
        <>
          <p className="text-white/30 text-sm font-light mb-10 leading-relaxed max-w-xs">
            One special door opens for you each day.<br />Today's door awaits.
          </p>
          <motion.button
            onClick={() => { haptic(20); onOpen(); }}
            className="w-full max-w-xs rounded-full text-black text-sm font-bold uppercase tracking-widest"
            style={{ ...btnBase, height:56, fontFamily:"'Cinzel',serif",
              background:"linear-gradient(135deg,#fef3c7 0%,#fbbf24 42%,#f59e0b 100%)",
              boxShadow:"0 0 28px rgba(251,191,36,0.34)" }}
            whileTap={{ scale:0.97 }}
            transition={{ type:"spring", stiffness:400, damping:22 }}>
            Open Daily Door
          </motion.button>
        </>
      )}
    </div>
  );
}

/* ─── Achievement Toast ──────────────────────────────────────── */
function AchievementToast({ achievement, onDone }: { achievement:Achievement; onDone:()=>void }) {
  useEffect(() => { const t = setTimeout(onDone, 3600); return () => clearTimeout(t); }, [onDone]);
  return (
    <motion.div className="fixed left-0 right-0 z-[200] flex justify-center px-4 pointer-events-none"
      style={{ top:"calc(env(safe-area-inset-top) + 56px)" }}
      initial={{ opacity:0, y:-16 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-16 }}
      transition={{ type:"spring", stiffness:300, damping:26 }}>
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
        style={{ background:"rgba(8,6,0,0.92)", border:"1px solid rgba(251,191,36,0.20)", backdropFilter:"blur(20px)" }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs flex-shrink-0"
          style={{ background:"rgba(251,191,36,0.12)", color:"rgba(251,191,36,0.9)" }}>◆</div>
        <div>
          <p className="font-mono text-[9px] text-amber-300/65 uppercase tracking-widest">Achievement unlocked</p>
          <p className="text-white/80 text-sm font-semibold" style={{ fontFamily:"'Cinzel',serif" }}>{achievement.title}</p>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Share Modal ────────────────────────────────────────────── */
function ShareModal({ reward, onClose }: { reward:Reward; onClose:()=>void }) {
  const [copied, setCopied] = useState(false);
  const text = `I opened Door #${reward.doorNumber.toLocaleString()} on MillionDoors.xyz and discovered ${reward.coin}.\n\n10,000,000 doors. Open one.`;

  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    haptic(10);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <motion.div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center px-4"
      style={{ paddingBottom:"calc(env(safe-area-inset-bottom) + 1rem)" }}
      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
      <div className="absolute inset-0 bg-black/78" style={{ backdropFilter:"blur(10px)" }} onClick={onClose} />
      <motion.div className="relative w-full max-w-sm rounded-3xl border p-6"
        style={{ background:"#080600", borderColor:"rgba(251,191,36,0.15)" }}
        initial={{ y:40, scale:0.94 }} animate={{ y:0, scale:1 }} exit={{ y:40, scale:0.94 }}
        transition={{ type:"spring", stiffness:300, damping:28 }}>
        <p className="font-mono text-[9px] text-white/22 uppercase tracking-widest mb-3">Share Discovery</p>
        <div className="rounded-2xl p-4 mb-5"
          style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-white/50 text-sm leading-relaxed font-light">{text}</p>
        </div>
        <button onClick={copy}
          className="w-full rounded-full text-black text-sm font-bold uppercase tracking-widest"
          style={{ ...btnBase, height:52, fontFamily:"'Cinzel',serif",
            background:"linear-gradient(135deg,#fef3c7 0%,#fbbf24 42%,#f59e0b 100%)" }}>
          {copied ? "✓ Copied" : "Copy Text"}
        </button>
      </motion.div>
    </motion.div>
  );
}

/* ─── Bottom Navigation ──────────────────────────────────────── */
const NAV: { id: View; label: string; icon: string }[] = [
  { id:"home",       label:"Home",       icon:"⌂" },
  { id:"collection", label:"Collection", icon:"◫" },
  { id:"stats",      label:"Stats",      icon:"◈" },
  { id:"daily",      label:"Daily",      icon:"◆" },
];

function BottomNav({ view, onView }: { view:View; onView:(v:View)=>void }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex"
      style={{ background:"rgba(0,0,0,0.92)", backdropFilter:"blur(20px)",
        borderTop:"1px solid rgba(255,255,255,0.06)",
        paddingBottom:"env(safe-area-inset-bottom)" }}>
      {NAV.map(item => {
        const active = view === item.id;
        return (
          <button key={item.id}
            onClick={() => { haptic(6); onView(item.id); }}
            className="flex-1 flex flex-col items-center justify-center gap-0.5"
            style={{ ...btnBase, height:56, color: active?"rgba(251,191,36,0.92)":"rgba(255,255,255,0.25)" }}
            aria-label={item.label}>
            <span className="text-lg leading-none">{item.icon}</span>
            <span className="text-[9px] font-mono tracking-wide uppercase">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ─── Page Header ────────────────────────────────────────────── */
function TopBar() {
  return (
    <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-5"
      style={{ height:48, paddingTop:"env(safe-area-inset-top)",
        background:"linear-gradient(to bottom,rgba(0,0,0,0.92) 0%,transparent 100%)" }}>
      <div className="flex items-center gap-2 text-amber-200/80">
        <DoorMark size={20} />
        <span className="text-sm font-semibold uppercase"
          style={{ fontFamily:"'Cinzel',serif", letterSpacing:"0.12em" }}>
          Million Doors
        </span>
      </div>
      <span className="font-mono text-[9px] text-white/18 uppercase tracking-widest">App</span>
    </div>
  );
}

/* ─── Section Header ─────────────────────────────────────────── */
function SectionHeader({ title, sub }: { title:string; sub:string }) {
  return (
    <div className="pt-4 pb-3 px-4">
      <h2 className="text-xl font-semibold text-amber-100/80 mb-0.5"
        style={{ fontFamily:"'Cinzel',serif", letterSpacing:"0.07em" }}>{title}</h2>
      <p className="font-mono text-[10px] text-white/22 uppercase tracking-widest">{sub}</p>
    </div>
  );
}

/* ─── Main App Page ──────────────────────────────────────────── */
export default function AppPage() {
  const [view,   setView]   = useState<View>("home");
  const [phase,  setPhase]  = useState<Phase>("idle");
  const [doorNum, setDoorNum] = useState(0);
  const [reward,  setReward] = useState<Reward | null>(null);
  const [shareReward, setShareReward] = useState<Reward | null>(null);
  const [pendingAch,  setPendingAch]  = useState<Achievement | null>(null);

  const [collection, setCollection] = useState<StoredFind[]>(() => loadJson(STORAGE.collection, []));
  const [stats,      setStats]      = useState<Stats>(()      => loadJson(STORAGE.stats, { opened:0, found:0, legendary:0, mythic:0 }));
  const [earned,     setEarned]     = useState<string[]>(()   => loadJson(STORAGE.achievements, []));
  const [dailyUsed,  setDailyUsed]  = useState<boolean>(() => {
    const d = loadJson<string | null>(STORAGE.daily, null);
    return d ? new Date(d).toDateString() === new Date().toDateString() : false;
  });

  /* Prevent body scroll on iOS while app is open */
  useEffect(() => {
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width    = "100%";
    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width    = "";
    };
  }, []);

  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const persist = useCallback((col: StoredFind[], st: Stats, ea: string[]) => {
    localStorage.setItem(STORAGE.collection, JSON.stringify(col));
    localStorage.setItem(STORAGE.stats,      JSON.stringify(st));
    localStorage.setItem(STORAGE.achievements, JSON.stringify(ea));
  }, []);

  const checkAchievements = useCallback((st: Stats, ea: string[]): string[] => {
    const unlock: string[] = [];
    if (!ea.includes("first")           && st.opened    >= 1)   unlock.push("first");
    if (!ea.includes("ten")             && st.opened    >= 10)  unlock.push("ten");
    if (!ea.includes("fifty")           && st.opened    >= 50)  unlock.push("fifty");
    if (!ea.includes("hundred")         && st.opened    >= 100) unlock.push("hundred");
    if (!ea.includes("first_legendary") && st.legendary >= 1)   unlock.push("first_legendary");
    if (!ea.includes("first_mythic")    && st.mythic    >= 1)   unlock.push("first_mythic");
    if (unlock.length > 0) {
      const updated = [...ea, ...unlock];
      setEarned(updated);
      const ach = ACHIEVEMENTS.find(a => a.id === unlock[0]);
      if (ach) setPendingAch(ach);
      return updated;
    }
    return ea;
  }, []);

  const handleOpenDoor = useCallback((isDaily = false) => {
    const door = randomDoor();
    setDoorNum(door);
    setReward(null);
    setPhase("selected");
    setView("home");
    if (isDaily) {
      localStorage.setItem(STORAGE.daily, JSON.stringify(new Date().toISOString()));
      setDailyUsed(true);
    }
  }, []);

  const handleConfirmOpen = useCallback(() => {
    setPhase("opening");
    haptic([15, 80, 15]);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const r = generateReward(doorNum);
      const newStats: Stats = {
        opened:    stats.opened    + 1,
        found:     stats.found     + (r.rarity !== "nothing" ? 1 : 0),
        legendary: stats.legendary + (r.rarity === "legendary" ? 1 : 0),
        mythic:    stats.mythic    + (r.rarity === "mythic"    ? 1 : 0),
      };
      let newCol = collection;
      if (r.coin) {
        const item: StoredFind = { id:`${doorNum}_${Date.now()}`, rarity:r.rarity, coin:r.coin, doorNumber:doorNum, ts:Date.now() };
        newCol = [item, ...collection];
        setCollection(newCol);
      }
      setStats(newStats);
      setReward(r);
      const newEarned = checkAchievements(newStats, earned);
      persist(newCol, newStats, newEarned);
      /* Haptic based on rarity */
      if      (r.rarity === "mythic")    haptic([30,50,30,50,30]);
      else if (r.rarity === "legendary") haptic([20,40,20]);
      else if (r.rarity === "epic")      haptic([15,30,15]);
      else if (r.rarity === "rare")      haptic(20);
      setPhase("revealed");
    }, 3000);
  }, [doorNum, stats, collection, earned, checkAchievements, persist]);

  const handleClose = useCallback(() => {
    clearTimeout(timerRef.current);
    setPhase("idle");
    setReward(null);
    setDoorNum(0);
  }, []);

  const handleNav = useCallback((v: View) => {
    if (phase !== "idle" && v !== "home") handleClose();
    setView(v);
  }, [phase, handleClose]);

  /* Nav bar height for bottom padding */
  const navH = "calc(56px + env(safe-area-inset-bottom))";

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden select-none"
      style={{ WebkitTextSizeAdjust:"100%" }}>

      {/* Achievement toast */}
      <AnimatePresence>
        {pendingAch && (
          <AchievementToast key={pendingAch.id} achievement={pendingAch} onDone={() => setPendingAch(null)} />
        )}
      </AnimatePresence>

      {/* Share modal */}
      <AnimatePresence>
        {shareReward && <ShareModal reward={shareReward} onClose={() => setShareReward(null)} />}
      </AnimatePresence>

      <TopBar />

      {/* Scrollable content area */}
      <div className="absolute inset-0 overflow-y-auto overscroll-contain"
        style={{ paddingTop:"calc(48px + env(safe-area-inset-top))", paddingBottom:navH,
          WebkitOverflowScrolling:"touch" }}>

        <AnimatePresence mode="wait">
          {/* Home — idle */}
          {view === "home" && phase === "idle" && (
            <motion.div key="home" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.2 }}>
              <HomeView onOpenDoor={() => handleOpenDoor(false)} />
            </motion.div>
          )}

          {/* Door selected */}
          {view === "home" && phase === "selected" && (
            <motion.div key="selected" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.2 }}
              className="flex items-center justify-center"
              style={{ minHeight:`calc(100dvh - 48px - ${navH})` }}>
              <FloatingDoorCard doorNumber={doorNum} onOpen={handleConfirmOpen} />
            </motion.div>
          )}

          {/* Opening animation */}
          {view === "home" && phase === "opening" && (
            <motion.div key="opening" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.2 }}
              className="flex flex-col items-center justify-center"
              style={{ minHeight:`calc(100dvh - 48px - ${navH})` }}>
              <p className="font-mono text-[10px] text-white/22 tracking-[0.45em] uppercase mb-8">
                Opening door #{doorNum.toLocaleString()}
              </p>
              <DoorOpening />
            </motion.div>
          )}

          {/* Reward revealed */}
          {view === "home" && phase === "revealed" && reward && (
            <motion.div key="revealed" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.2 }}
              className="flex items-center justify-center"
              style={{ minHeight:`calc(100dvh - 48px - ${navH})` }}>
              <RewardReveal reward={reward} onClose={handleClose} onShare={() => setShareReward(reward)} />
            </motion.div>
          )}

          {/* Collection */}
          {view === "collection" && (
            <motion.div key="collection" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.2 }}>
              <SectionHeader title="Collection" sub="Your discoveries" />
              <CollectionView collection={collection} />
            </motion.div>
          )}

          {/* Stats */}
          {view === "stats" && (
            <motion.div key="stats" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.2 }}>
              <SectionHeader title="Statistics" sub="Your journey" />
              <StatsView stats={stats} earned={earned} />
            </motion.div>
          )}

          {/* Daily */}
          {view === "daily" && (
            <motion.div key="daily" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.2 }}>
              <SectionHeader title="Daily Door" sub="One door per day" />
              <DailyDoorView used={dailyUsed} onOpen={() => { setView("home"); handleOpenDoor(true); }} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomNav view={view} onView={handleNav} />
    </div>
  );
}
