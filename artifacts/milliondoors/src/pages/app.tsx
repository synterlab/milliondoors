import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";

/* ─── Constants ─────────────────────────────────────────────── */
const COINS = ["ORYNTH","ARTMAP","KWOK","COINFLIP","BASEFUN","CULTURE","VISION","NOTE","CITY","ORBIT"] as const;
type CoinName = typeof COINS[number];
type Rarity = "nothing" | "common" | "rare" | "epic" | "legendary" | "mythic";
type View = "home" | "collection" | "stats" | "daily";
type Phase = "idle" | "selected" | "opening" | "revealed";

interface Reward { rarity: Rarity; coin?: CoinName; doorNumber: number; }
interface StoredFind { id: string; rarity: Rarity; coin: CoinName; doorNumber: number; ts: number; }
interface Stats { opened: number; found: number; legendary: number; mythic: number; }
interface Achievement { id: string; title: string; desc: string; }

const STORAGE = {
  collection: "md_collection",
  stats: "md_stats",
  achievements: "md_achievements",
  daily: "md_daily",
};

const ACHIEVEMENTS: Achievement[] = [
  { id: "first",           title: "First Door",       desc: "You opened your first door."         },
  { id: "ten",             title: "Ten Doors",         desc: "Ten doors opened."                   },
  { id: "fifty",           title: "Fifty Doors",       desc: "Fifty doors and counting."           },
  { id: "hundred",         title: "Century",           desc: "One hundred doors opened."           },
  { id: "first_legendary", title: "Legendary Find",    desc: "Your first legendary discovery."     },
  { id: "first_mythic",    title: "Mythic Find",       desc: "You found the rarest of all."        },
];

const RARITY_LABEL: Record<Rarity, string> = {
  nothing: "Empty", common: "Common", rare: "Rare",
  epic: "Epic", legendary: "Legendary", mythic: "Mythic",
};

const RARITY_COLOR: Record<Rarity, string> = {
  nothing:   "rgba(255,255,255,0.22)",
  common:    "rgba(255,255,255,0.72)",
  rare:      "rgba(147,197,253,0.92)",
  epic:      "rgba(196,181,253,0.92)",
  legendary: "rgba(251,191,36,0.96)",
  mythic:    "rgba(255,255,255,1)",
};

const RARITY_GLOW: Record<Rarity, string> = {
  nothing:   "none",
  common:    "none",
  rare:      "0 0 28px rgba(147,197,253,0.28)",
  epic:      "0 0 36px rgba(196,181,253,0.38)",
  legendary: "0 0 55px rgba(251,191,36,0.50)",
  mythic:    "0 0 80px rgba(255,255,255,0.60), 0 0 160px rgba(255,255,255,0.18)",
};

const RARITY_BG: Record<Rarity, string> = {
  nothing:   "rgba(255,255,255,0.03)",
  common:    "rgba(255,255,255,0.05)",
  rare:      "rgba(147,197,253,0.06)",
  epic:      "rgba(196,181,253,0.07)",
  legendary: "rgba(251,191,36,0.08)",
  mythic:    "rgba(255,255,255,0.08)",
};

/* ─── Helpers ────────────────────────────────────────────────── */
function randomDoor() { return Math.floor(Math.random() * 9_000_000) + 1_000_000; }

function generateReward(doorNumber: number): Reward {
  const roll = Math.random() * 100;
  const coin = COINS[Math.floor(Math.random() * COINS.length)];
  if (roll < 70)   return { rarity: "nothing",   doorNumber };
  if (roll < 90)   return { rarity: "common",    coin, doorNumber };
  if (roll < 97)   return { rarity: "rare",      coin, doorNumber };
  if (roll < 99)   return { rarity: "epic",      coin, doorNumber };
  if (roll < 99.9) return { rarity: "legendary", coin, doorNumber };
  return                   { rarity: "mythic",   coin, doorNumber };
}

function loadJson<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
}

/* ─── DoorMark ───────────────────────────────────────────────── */
function DoorMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <rect x="4"  y="4"  width="17" height="26" rx="2.5" stroke="currentColor" strokeWidth="2.2" />
      <rect x="27" y="4"  width="17" height="26" rx="2.5" stroke="currentColor" strokeWidth="2.2" />
      <rect x="4"  y="34" width="17" height="10" rx="2.5" stroke="currentColor" strokeWidth="2.2" />
      <rect x="27" y="34" width="17" height="10" rx="2.5" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="19.5" cy="17" r="1.8" fill="currentColor" opacity="0.6" />
      <circle cx="28.5" cy="17" r="1.8" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

/* ─── Rarity Badge ───────────────────────────────────────────── */
function RarityBadge({ rarity }: { rarity: Rarity }) {
  return (
    <span
      className="text-[9px] font-mono uppercase tracking-widest px-2.5 py-0.5 rounded-full"
      style={{
        color: RARITY_COLOR[rarity],
        border: `1px solid ${RARITY_COLOR[rarity].replace(")", ",0.22)").replace("rgba","rgba")}`,
        background: RARITY_BG[rarity],
      }}
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

/* ─── Feed Ticker ────────────────────────────────────────────── */
const FEED_PLAYERS = Array.from({ length: 30 }, () => `#${Math.floor(Math.random() * 9000) + 1000}`);
const FEED_RARITIES: Rarity[] = ["common","common","rare","rare","epic","legendary"];

interface FeedItem { id: number; player: string; coin: CoinName; rarity: Rarity; }

function FeedTicker() {
  const make = (): FeedItem => ({
    id: Math.random(),
    player: FEED_PLAYERS[Math.floor(Math.random() * FEED_PLAYERS.length)],
    coin: COINS[Math.floor(Math.random() * COINS.length)],
    rarity: FEED_RARITIES[Math.floor(Math.random() * FEED_RARITIES.length)],
  });

  const [items, setItems] = useState<FeedItem[]>(() => Array.from({ length: 5 }, make));

  useEffect(() => {
    const id = setInterval(() => {
      setItems(prev => [make(), ...prev.slice(0, 4)]);
    }, 3800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-1.5">
      <AnimatePresence initial={false}>
        {items.map(item => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-2"
          >
            <span className="font-mono text-[10px] text-white/22">Player {item.player}</span>
            <span className="text-white/12">·</span>
            <span className="font-mono text-[10px]" style={{ color: RARITY_COLOR[item.rarity] }}>
              {item.coin}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ─── Door Opening Animation ─────────────────────────────────── */
function DoorOpening() {
  return (
    <div className="flex items-center justify-center" style={{ perspective: "640px", height: 280 }}>
      <div className="relative" style={{ width: 160, height: 240 }}>
        {/* Ambient glow behind */}
        <motion.div
          className="absolute inset-0 rounded-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.5, 1] }}
          transition={{ duration: 2.8, times: [0, 0.45, 1] }}
          style={{ background: "radial-gradient(circle, rgba(251,191,36,0.22) 0%, transparent 72%)" }}
        />
        {/* Door panel swings open */}
        <motion.div
          className="absolute inset-0 rounded-xl"
          style={{
            background: "linear-gradient(155deg, #120d00 0%, #060400 100%)",
            border: "1px solid rgba(251,191,36,0.24)",
            transformOrigin: "left center",
            transformStyle: "preserve-3d",
          }}
          initial={{ rotateY: 0 }}
          animate={{ rotateY: -78 }}
          transition={{ duration: 2.2, delay: 0.45, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Inner panels */}
          <div className="absolute" style={{ inset: "14px 12px", border: "1px solid rgba(251,191,36,0.09)", borderRadius: 4 }} />
          {/* Knob */}
          <div
            className="absolute rounded-full"
            style={{ width: 10, height: 10, right: 20, top: "50%", transform: "translateY(-50%)", border: "1px solid rgba(251,191,36,0.4)", background: "rgba(251,191,36,0.1)" }}
          />
        </motion.div>
        {/* Shake on start */}
        <motion.div
          className="absolute inset-0"
          animate={{ x: [0, -5, 5, -4, 4, -2, 2, 0] }}
          transition={{ duration: 0.55, delay: 0.1 }}
        />
        {/* Light burst */}
        <motion.div
          className="absolute inset-0 rounded-xl pointer-events-none"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: [0, 0, 0.75, 1], scale: [0.85, 0.85, 1.08, 1] }}
          transition={{ duration: 2.8, times: [0, 0.42, 0.72, 1] }}
          style={{ background: "radial-gradient(circle, rgba(255,220,110,0.28) 0%, transparent 68%)" }}
        />
      </div>
    </div>
  );
}

/* ─── Reward Reveal ──────────────────────────────────────────── */
function RewardReveal({ reward, onClose, onShare }: { reward: Reward; onClose: () => void; onShare: () => void }) {
  const isEmpty = reward.rarity === "nothing";

  const item = (i: number) => ({
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay: i * 0.14, ease: [0.16, 1, 0.3, 1] },
  });

  return (
    <motion.div
      className="flex flex-col items-center text-center px-6 py-8 w-full max-w-sm mx-auto"
      initial={{ opacity: 0, scale: 0.94, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div className="mb-5" {...item(0)}>
        <RarityBadge rarity={reward.rarity} />
      </motion.div>

      {isEmpty ? (
        <motion.div className="mb-8" {...item(1)}>
          <div
            className="w-20 h-20 rounded-full mx-auto mb-5 flex items-center justify-center text-2xl"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <span className="text-white/15 font-display" style={{ fontFamily: "'Cinzel', serif" }}>□</span>
          </div>
          <p className="font-mono text-[10px] text-white/22 uppercase tracking-widest mb-2">Nothing found</p>
          <p className="text-white/18 text-xs font-light">Door #{reward.doorNumber.toLocaleString()} was empty.</p>
        </motion.div>
      ) : (
        <motion.div className="mb-7" {...item(1)}>
          {/* Coin orb */}
          <motion.div
            className="w-24 h-24 rounded-full mx-auto mb-5 flex items-center justify-center"
            style={{
              background: `radial-gradient(circle, ${RARITY_BG[reward.rarity].replace("rgba","rgba").replace(")",",")} 0%, transparent 70%)`,
              border: `1px solid ${RARITY_COLOR[reward.rarity].replace(")", ",0.28)").replace("rgba","rgba")}`,
              boxShadow: RARITY_GLOW[reward.rarity],
            }}
            animate={
              reward.rarity === "mythic"
                ? { boxShadow: ["0 0 40px rgba(255,255,255,0.3)","0 0 80px rgba(255,255,255,0.65)","0 0 40px rgba(255,255,255,0.3)"] }
                : reward.rarity === "legendary"
                ? { boxShadow: ["0 0 30px rgba(251,191,36,0.42)","0 0 65px rgba(251,191,36,0.72)","0 0 30px rgba(251,191,36,0.42)"] }
                : {}
            }
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <span
              className="font-bold text-sm tracking-widest"
              style={{ color: RARITY_COLOR[reward.rarity], fontFamily: "'Cinzel', serif" }}
            >
              {reward.coin?.slice(0, 2)}
            </span>
          </motion.div>

          <h2
            className="text-3xl font-bold mb-1.5"
            style={{
              color: RARITY_COLOR[reward.rarity],
              fontFamily: "'Cinzel', serif",
              letterSpacing: "0.1em",
              filter: RARITY_GLOW[reward.rarity] !== "none"
                ? `drop-shadow(0 0 14px ${RARITY_COLOR[reward.rarity].replace(")",",0.6)").replace("rgba","rgba")})`
                : "none",
            }}
          >
            {reward.coin}
          </h2>
          <p className="font-mono text-[10px] text-white/28 tracking-widest uppercase">
            Found in Door #{reward.doorNumber.toLocaleString()}
          </p>
        </motion.div>
      )}

      {/* Actions */}
      <motion.div className="flex items-center gap-3 w-full" {...item(isEmpty ? 2 : 3)}>
        {!isEmpty && (
          <motion.button
            onClick={onShare}
            className="px-5 py-2.5 rounded-full border text-xs font-mono tracking-widest"
            style={{ borderColor: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.38)", background: "rgba(255,255,255,0.03)" }}
            whileHover={{ borderColor: "rgba(255,255,255,0.20)", color: "rgba(255,255,255,0.65)" }}
            transition={{ duration: 0.2 }}
          >
            Share
          </motion.button>
        )}
        <motion.button
          onClick={onClose}
          className="flex-1 py-2.5 rounded-full text-black text-xs font-bold uppercase tracking-widest"
          style={{
            background: "linear-gradient(135deg, #fef3c7 0%, #fbbf24 42%, #f59e0b 100%)",
            fontFamily: "'Cinzel', serif",
            boxShadow: "0 0 24px rgba(251,191,36,0.32)",
          }}
          whileHover={{ scale: 1.03, boxShadow: "0 0 44px rgba(251,191,36,0.55)" }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", stiffness: 340, damping: 20 }}
        >
          {isEmpty ? "Try Another" : "Open Next"}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

/* ─── Door Card (floating) ───────────────────────────────────── */
function FloatingDoorCard({ doorNumber, onOpen }: { doorNumber: number; onOpen: () => void }) {
  return (
    <div className="flex flex-col items-center text-center w-full max-w-xs mx-auto">
      <p className="font-mono text-[9px] text-white/20 tracking-[0.5em] uppercase mb-8">
        Your door awaits
      </p>

      <motion.div
        className="relative mb-8"
        animate={{ y: [0, -7, 0] }}
        transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
      >
        <div
          className="w-40 h-56 rounded-xl flex flex-col items-center justify-between py-5 px-4"
          style={{
            background: "linear-gradient(150deg, #110900 0%, #050400 100%)",
            border: "1px solid rgba(251,191,36,0.22)",
            boxShadow: "0 0 48px rgba(251,191,36,0.07), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          <div className="w-full h-20 rounded" style={{ border: "1px solid rgba(251,191,36,0.09)" }} />
          <div
            className="w-3 h-3 rounded-full"
            style={{ border: "1px solid rgba(251,191,36,0.38)", background: "rgba(251,191,36,0.08)" }}
          />
          <div className="w-full h-14 rounded" style={{ border: "1px solid rgba(251,191,36,0.09)" }} />
        </div>
        {/* Ambient */}
        <div
          className="absolute -inset-6 -z-10 rounded-3xl"
          style={{ background: "radial-gradient(circle, rgba(251,191,36,0.04) 0%, transparent 70%)" }}
        />
      </motion.div>

      <p className="font-mono text-[9px] text-white/20 uppercase tracking-widest mb-1">Door Number</p>
      <p
        className="text-3xl font-bold mb-8 text-amber-200/90"
        style={{ fontFamily: "'Cinzel', serif", letterSpacing: "0.05em" }}
      >
        #{doorNumber.toLocaleString()}
      </p>

      <motion.button
        onClick={onOpen}
        className="px-14 py-3.5 rounded-full text-black text-xs font-bold uppercase tracking-widest"
        style={{
          background: "linear-gradient(135deg, #fef3c7 0%, #fbbf24 42%, #f59e0b 100%)",
          fontFamily: "'Cinzel', serif",
          boxShadow: "0 0 28px rgba(251,191,36,0.32)",
        }}
        whileHover={{ scale: 1.05, boxShadow: "0 0 50px rgba(251,191,36,0.58)" }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 340, damping: 20 }}
      >
        Open
      </motion.button>
    </div>
  );
}

/* ─── Home View ──────────────────────────────────────────────── */
function HomeView({ onOpenDoor }: { onOpenDoor: () => void }) {
  const item = (i: number) => ({
    initial: { opacity: 0, y: 18, filter: "blur(6px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    transition: { duration: 0.9, delay: 0.2 + i * 0.14, ease: [0.16, 1, 0.3, 1] },
  });

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-7rem)] px-6 py-8 text-center">
      {/* Global counter */}
      <motion.div className="flex items-center gap-2.5 mb-8" {...item(0)}>
        <motion.span
          className="w-1.5 h-1.5 rounded-full bg-amber-400"
          animate={{ opacity: [1, 0.2, 1], scale: [1, 1.5, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <span className="font-mono text-[10px] text-amber-200/35 tracking-[0.36em] uppercase">
          <GlobalCounter base={4_821_943} /> doors opened worldwide
        </span>
      </motion.div>

      {/* Eyebrow */}
      <motion.p className="font-mono text-[9px] text-white/18 tracking-[0.62em] uppercase mb-5" {...item(1)}>
        10,000,000 doors exist
      </motion.p>

      {/* Headline */}
      <motion.div {...item(2)} className="mb-1.5">
        <h1
          className="text-white leading-[0.92]"
          style={{ fontSize: "clamp(2.6rem,8vw,5.8rem)", fontWeight: 700, letterSpacing: "0.03em", fontFamily: "'Cinzel', serif" }}
        >
          Each door
        </h1>
      </motion.div>
      <motion.div {...item(3)} className="mb-6">
        <h1
          className="leading-[0.92]"
          style={{
            fontSize: "clamp(2.6rem,8vw,5.8rem)",
            fontWeight: 700,
            letterSpacing: "0.03em",
            fontFamily: "'Cinzel', serif",
            background: "linear-gradient(135deg, #fef9e7 0%, #fcd34d 28%, #f59e0b 62%, #d97706 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 22px rgba(251,191,36,0.42))",
            display: "inline-block",
          }}
        >
          opens once.
        </h1>
      </motion.div>

      {/* Rule */}
      <motion.div
        className="w-10 h-px mb-6"
        style={{ background: "linear-gradient(90deg, transparent, rgba(251,191,36,0.42), transparent)" }}
        {...item(4)}
      />

      {/* Body */}
      <motion.p className="text-white/35 text-sm leading-loose tracking-wide mb-9 font-light" {...item(5)}>
        Most contain nothing.<br />
        <span className="text-white/55 font-normal">Some hide rare discoveries.</span>
      </motion.p>

      {/* CTA */}
      <motion.button
        onClick={onOpenDoor}
        className="relative flex items-center justify-center px-12 py-4 rounded-full overflow-hidden text-black mb-10"
        style={{
          background: "linear-gradient(135deg, #fef3c7 0%, #fbbf24 42%, #f59e0b 100%)",
          boxShadow: "0 0 36px rgba(251,191,36,0.36), 0 0 72px rgba(251,191,36,0.10)",
          fontFamily: "'Cinzel', serif",
          fontWeight: 700,
          fontSize: "0.72rem",
          letterSpacing: "0.24em",
        }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1, type: "spring", stiffness: 260, damping: 22 }}
        whileHover={{ scale: 1.05, boxShadow: "0 0 55px rgba(251,191,36,0.62), 0 0 110px rgba(251,191,36,0.20)" }}
        whileTap={{ scale: 0.97 }}
      >
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(105deg, transparent 25%, rgba(255,255,255,0.44) 50%, transparent 75%)",
            backgroundSize: "220% 100%",
          }}
          animate={{ backgroundPosition: ["-110% 0%", "210% 0%"] }}
          transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 2.8, ease: "easeInOut" }}
        />
        <span className="relative z-10 uppercase">Open a Door</span>
      </motion.button>

      {/* Feed */}
      <motion.div className="w-full max-w-xs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}>
        <p className="font-mono text-[9px] text-white/16 uppercase tracking-widest mb-3">Recent discoveries</p>
        <FeedTicker />
      </motion.div>

      {/* Lore */}
      <motion.div className="mt-12 max-w-xs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.9 }}>
        <p className="text-white/14 text-[10px] font-light leading-relaxed italic">
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
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div
          className="w-16 h-16 rounded-2xl mb-5 flex items-center justify-center text-white/12"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <DoorMark size={30} />
        </div>
        <p className="font-mono text-[10px] text-white/18 uppercase tracking-widest mb-2">No discoveries yet</p>
        <p className="text-white/14 text-xs font-light">Open a door to begin your collection.</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-2">
      <p className="font-mono text-[10px] text-white/18 tracking-widest uppercase mb-4">
        {collection.length} {collection.length === 1 ? "discovery" : "discoveries"}
      </p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {collection.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.035 }}
            className="rounded-xl p-3.5"
            style={{
              background: "#101010",
              border: `1px solid ${RARITY_COLOR[item.rarity].replace(")", ",0.16)").replace("rgba","rgba")}`,
              boxShadow: (item.rarity === "legendary" || item.rarity === "mythic") ? RARITY_GLOW[item.rarity] : undefined,
            }}
          >
            <div className="mb-2.5"><RarityBadge rarity={item.rarity} /></div>
            <p
              className="font-bold text-sm mb-0.5 truncate"
              style={{ color: RARITY_COLOR[item.rarity], fontFamily: "'Cinzel', serif", letterSpacing: "0.05em" }}
            >
              {item.coin}
            </p>
            <p className="font-mono text-[9px] text-white/16">
              Door #{item.doorNumber.toLocaleString()}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ─── Stats View ─────────────────────────────────────────────── */
function StatsView({ stats, earned }: { stats: Stats; earned: string[] }) {
  const completion = Math.min(100, (stats.found / 10) * 100);

  return (
    <div className="px-4 py-2 space-y-3">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-2.5">
        {[
          { label: "Doors Opened", value: stats.opened },
          { label: "Coins Found",  value: stats.found  },
          { label: "Legendary",    value: stats.legendary },
          { label: "Mythic",       value: stats.mythic },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl p-4" style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="font-mono text-[9px] text-white/22 uppercase tracking-widest mb-1">{label}</p>
            <p className="text-2xl font-bold text-amber-200/88" style={{ fontFamily: "'Cinzel', serif" }}>
              {value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Collection progress */}
      <div className="rounded-xl p-4" style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center justify-between mb-2.5">
          <p className="font-mono text-[9px] text-white/22 uppercase tracking-widest">Collection</p>
          <p className="font-mono text-[9px] text-amber-300/55">{completion.toFixed(1)}%</p>
        </div>
        <div className="h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, #f59e0b, #fbbf24)" }}
            initial={{ width: 0 }}
            animate={{ width: `${completion}%` }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Achievements */}
      <div>
        <p className="font-mono text-[9px] text-white/22 uppercase tracking-widest mb-2.5">Achievements</p>
        <div className="space-y-2">
          {ACHIEVEMENTS.map(a => {
            const unlocked = earned.includes(a.id);
            return (
              <div
                key={a.id}
                className="rounded-xl p-3.5 flex items-center gap-3"
                style={{
                  background: "#101010",
                  border: `1px solid ${unlocked ? "rgba(251,191,36,0.18)" : "rgba(255,255,255,0.06)"}`,
                  opacity: unlocked ? 1 : 0.42,
                }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                  style={{ background: unlocked ? "rgba(251,191,36,0.10)" : "rgba(255,255,255,0.04)", color: unlocked ? "rgba(251,191,36,0.9)" : "rgba(255,255,255,0.3)" }}
                >
                  {unlocked ? "◆" : "○"}
                </div>
                <div>
                  <p className="text-white/72 text-[11px] font-semibold" style={{ fontFamily: "'Cinzel', serif" }}>{a.title}</p>
                  <p className="text-white/24 text-[10px] font-light">{a.desc}</p>
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
function DailyDoorView({ used, onOpen }: { used: boolean; onOpen: () => void }) {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const ms = tomorrow.getTime() - now.getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <motion.div
        className="w-28 h-28 rounded-2xl mb-6 flex items-center justify-center"
        style={{
          background: used ? "rgba(255,255,255,0.03)" : "rgba(251,191,36,0.07)",
          border: used ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(251,191,36,0.24)",
          color: used ? "rgba(255,255,255,0.18)" : "rgba(251,191,36,0.82)",
        }}
        animate={used ? {} : { boxShadow: ["0 0 18px rgba(251,191,36,0.10)","0 0 48px rgba(251,191,36,0.24)","0 0 18px rgba(251,191,36,0.10)"] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
      >
        <DoorMark size={44} />
      </motion.div>

      <p
        className="font-bold text-lg mb-2"
        style={{
          fontFamily: "'Cinzel', serif",
          letterSpacing: "0.1em",
          color: used ? "rgba(255,255,255,0.20)" : "rgba(251,191,36,0.90)",
        }}
      >
        {used ? "Come Back Tomorrow" : "Daily Door Available"}
      </p>

      {used ? (
        <p className="font-mono text-xs text-white/22 tracking-wide mb-6">
          Resets in {h}h {m}m
        </p>
      ) : (
        <p className="text-white/28 text-sm font-light mb-8 leading-relaxed max-w-xs">
          One special door opens for you each day.<br />Today's door awaits.
        </p>
      )}

      {!used && (
        <motion.button
          onClick={onOpen}
          className="px-10 py-3.5 rounded-full text-black text-xs font-bold uppercase tracking-widest"
          style={{
            background: "linear-gradient(135deg, #fef3c7 0%, #fbbf24 42%, #f59e0b 100%)",
            fontFamily: "'Cinzel', serif",
            boxShadow: "0 0 28px rgba(251,191,36,0.34)",
          }}
          whileHover={{ scale: 1.05, boxShadow: "0 0 50px rgba(251,191,36,0.56)" }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", stiffness: 340, damping: 20 }}
        >
          Open Daily Door
        </motion.button>
      )}
    </div>
  );
}

/* ─── Achievement Toast ──────────────────────────────────────── */
function AchievementToast({ achievement, onDone }: { achievement: Achievement; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3600);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      className="fixed top-4 left-0 right-0 z-[200] flex justify-center px-4 pointer-events-none"
      initial={{ opacity: 0, y: -18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-2xl"
        style={{ background: "rgba(8,6,0,0.90)", border: "1px solid rgba(251,191,36,0.20)", backdropFilter: "blur(16px)" }}
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
          style={{ background: "rgba(251,191,36,0.12)", color: "rgba(251,191,36,0.9)" }}
        >
          ◆
        </div>
        <div>
          <p className="font-mono text-[9px] text-amber-300/65 uppercase tracking-widest">Achievement unlocked</p>
          <p className="text-white/78 text-xs" style={{ fontFamily: "'Cinzel', serif" }}>{achievement.title}</p>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Share Modal ────────────────────────────────────────────── */
function ShareModal({ reward, onClose }: { reward: Reward; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = `I opened Door #${reward.doorNumber.toLocaleString()} on MillionDoors.xyz and discovered ${reward.coin}.\n\n10,000,000 doors. Open one.`;

  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <motion.div
      className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/75" style={{ backdropFilter: "blur(8px)" }} onClick={onClose} />
      <motion.div
        className="relative w-full max-w-xs rounded-2xl border p-6"
        style={{ background: "#080600", borderColor: "rgba(251,191,36,0.14)" }}
        initial={{ scale: 0.92, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 24 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
      >
        <p className="font-mono text-[9px] text-white/22 uppercase tracking-widest mb-3">Share Discovery</p>
        <div className="rounded-xl p-3.5 mb-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-white/48 text-xs leading-relaxed font-light">{text}</p>
        </div>
        <motion.button
          onClick={copy}
          className="w-full py-2.5 rounded-full text-black text-xs font-bold uppercase tracking-widest"
          style={{
            background: "linear-gradient(135deg, #fef3c7 0%, #fbbf24 42%, #f59e0b 100%)",
            fontFamily: "'Cinzel', serif",
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          {copied ? "✓ Copied" : "Copy Text"}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

/* ─── Bottom Nav ─────────────────────────────────────────────── */
const NAV_ITEMS = [
  { id: "home" as const,       label: "Home",       glyph: "⌂" },
  { id: "collection" as const, label: "Collection", glyph: "◫" },
  { id: "stats" as const,      label: "Stats",      glyph: "◈" },
  { id: "daily" as const,      label: "Daily",      glyph: "◆" },
];

function BottomNav({ view, onView }: { view: View; onView: (v: View) => void }) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch"
      style={{
        background: "rgba(0,0,0,0.90)",
        backdropFilter: "blur(18px)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {NAV_ITEMS.map(item => {
        const active = view === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onView(item.id)}
            className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-colors duration-200"
            style={{ color: active ? "rgba(251,191,36,0.92)" : "rgba(255,255,255,0.22)" }}
          >
            <span className="text-base leading-none">{item.glyph}</span>
            <span className="text-[9px] font-mono tracking-wider uppercase">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ─── Main App Page ──────────────────────────────────────────── */
export default function AppPage() {
  const [view, setView] = useState<View>("home");
  const [phase, setPhase] = useState<Phase>("idle");
  const [currentDoor, setCurrentDoor] = useState(0);
  const [reward, setReward] = useState<Reward | null>(null);
  const [shareReward, setShareReward] = useState<Reward | null>(null);
  const [pendingAchievement, setPendingAchievement] = useState<Achievement | null>(null);

  const [collection, setCollection] = useState<StoredFind[]>(() => loadJson(STORAGE.collection, []));
  const [stats, setStats] = useState<Stats>(() => loadJson(STORAGE.stats, { opened: 0, found: 0, legendary: 0, mythic: 0 }));
  const [earned, setEarned] = useState<string[]>(() => loadJson(STORAGE.achievements, []));
  const [dailyUsed, setDailyUsed] = useState<boolean>(() => {
    const stored = loadJson<string | null>(STORAGE.daily, null);
    return stored ? new Date(stored).toDateString() === new Date().toDateString() : false;
  });

  const persist = useCallback((col: StoredFind[], st: Stats, ea: string[]) => {
    localStorage.setItem(STORAGE.collection, JSON.stringify(col));
    localStorage.setItem(STORAGE.stats, JSON.stringify(st));
    localStorage.setItem(STORAGE.achievements, JSON.stringify(ea));
  }, []);

  const checkAchievements = useCallback((st: Stats, ea: string[]): string[] => {
    const toUnlock: string[] = [];
    if (!ea.includes("first")           && st.opened    >= 1  ) toUnlock.push("first");
    if (!ea.includes("ten")             && st.opened    >= 10 ) toUnlock.push("ten");
    if (!ea.includes("fifty")           && st.opened    >= 50 ) toUnlock.push("fifty");
    if (!ea.includes("hundred")         && st.opened    >= 100) toUnlock.push("hundred");
    if (!ea.includes("first_legendary") && st.legendary >= 1  ) toUnlock.push("first_legendary");
    if (!ea.includes("first_mythic")    && st.mythic    >= 1  ) toUnlock.push("first_mythic");
    if (toUnlock.length > 0) {
      const updated = [...ea, ...toUnlock];
      setEarned(updated);
      const ach = ACHIEVEMENTS.find(a => a.id === toUnlock[0]);
      if (ach) setPendingAchievement(ach);
      return updated;
    }
    return ea;
  }, []);

  const handleOpenDoor = useCallback((isDaily = false) => {
    const door = randomDoor();
    setCurrentDoor(door);
    setPhase("selected");
    setView("home");
    if (isDaily) {
      localStorage.setItem(STORAGE.daily, JSON.stringify(new Date().toISOString()));
      setDailyUsed(true);
    }
  }, []);

  const handleConfirmOpen = useCallback(() => {
    setPhase("opening");
    setTimeout(() => {
      const r = generateReward(currentDoor);
      const newStats: Stats = {
        opened:    stats.opened + 1,
        found:     stats.found + (r.rarity !== "nothing" ? 1 : 0),
        legendary: stats.legendary + (r.rarity === "legendary" ? 1 : 0),
        mythic:    stats.mythic    + (r.rarity === "mythic"    ? 1 : 0),
      };
      let newCollection = collection;
      if (r.coin) {
        const item: StoredFind = {
          id: `${currentDoor}_${Date.now()}`,
          rarity: r.rarity,
          coin: r.coin,
          doorNumber: currentDoor,
          ts: Date.now(),
        };
        newCollection = [item, ...collection];
        setCollection(newCollection);
      }
      setStats(newStats);
      setReward(r);
      const newEarned = checkAchievements(newStats, earned);
      persist(newCollection, newStats, newEarned);
      setPhase("revealed");
    }, 2950);
  }, [currentDoor, stats, collection, earned, checkAchievements, persist]);

  const handleClose = useCallback(() => {
    setPhase("idle");
    setReward(null);
    setCurrentDoor(0);
  }, []);

  const handleNavChange = useCallback((v: View) => {
    if (phase !== "idle" && v !== "home") handleClose();
    setView(v);
  }, [phase, handleClose]);

  return (
    <div className="min-h-[100dvh] bg-black text-white overflow-x-hidden pb-16">
      {/* Achievement toast */}
      <AnimatePresence>
        {pendingAchievement && (
          <AchievementToast
            key={pendingAchievement.id}
            achievement={pendingAchievement}
            onDone={() => setPendingAchievement(null)}
          />
        )}
      </AnimatePresence>

      {/* Share modal */}
      <AnimatePresence>
        {shareReward && (
          <ShareModal reward={shareReward} onClose={() => setShareReward(null)} />
        )}
      </AnimatePresence>

      {/* Top bar */}
      <div
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-5 h-12"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.92) 0%, transparent 100%)" }}
      >
        <div className="flex items-center gap-2 text-amber-200/80">
          <DoorMark size={22} />
          <span
            className="text-sm font-semibold uppercase"
            style={{ fontFamily: "'Cinzel', serif", letterSpacing: "0.12em" }}
          >
            Million Doors
          </span>
        </div>
        <span className="font-mono text-[9px] text-white/18 uppercase tracking-widest">App</span>
      </div>

      {/* Main content */}
      <div className="pt-12">
        <AnimatePresence mode="wait">
          {/* Home — idle */}
          {view === "home" && phase === "idle" && (
            <motion.div key="home-idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
              <HomeView onOpenDoor={() => handleOpenDoor(false)} />
            </motion.div>
          )}

          {/* Home — door selected */}
          {view === "home" && phase === "selected" && (
            <motion.div key="home-selected" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}
              className="flex items-center justify-center min-h-[calc(100dvh-7rem)]"
            >
              <FloatingDoorCard doorNumber={currentDoor} onOpen={handleConfirmOpen} />
            </motion.div>
          )}

          {/* Home — opening animation */}
          {view === "home" && phase === "opening" && (
            <motion.div key="home-opening" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}
              className="flex flex-col items-center justify-center min-h-[calc(100dvh-7rem)]"
            >
              <p className="font-mono text-[9px] text-white/20 tracking-[0.5em] uppercase mb-8">
                Opening door #{currentDoor.toLocaleString()}
              </p>
              <DoorOpening />
            </motion.div>
          )}

          {/* Home — revealed */}
          {view === "home" && phase === "revealed" && reward && (
            <motion.div key="home-revealed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}
              className="flex items-center justify-center min-h-[calc(100dvh-7rem)]"
            >
              <RewardReveal
                reward={reward}
                onClose={handleClose}
                onShare={() => setShareReward(reward)}
              />
            </motion.div>
          )}

          {/* Collection */}
          {view === "collection" && (
            <motion.div key="collection" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
              <div className="pt-4 pb-3 px-4">
                <h2 className="text-lg font-semibold text-amber-100/78 mb-0.5" style={{ fontFamily: "'Cinzel', serif", letterSpacing: "0.08em" }}>Collection</h2>
                <p className="font-mono text-[10px] text-white/20 uppercase tracking-widest">Your discoveries</p>
              </div>
              <CollectionView collection={collection} />
            </motion.div>
          )}

          {/* Stats */}
          {view === "stats" && (
            <motion.div key="stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
              <div className="pt-4 pb-3 px-4">
                <h2 className="text-lg font-semibold text-amber-100/78 mb-0.5" style={{ fontFamily: "'Cinzel', serif", letterSpacing: "0.08em" }}>Statistics</h2>
                <p className="font-mono text-[10px] text-white/20 uppercase tracking-widest">Your journey</p>
              </div>
              <StatsView stats={stats} earned={earned} />
            </motion.div>
          )}

          {/* Daily */}
          {view === "daily" && (
            <motion.div key="daily" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
              <div className="pt-4 pb-3 px-4">
                <h2 className="text-lg font-semibold text-amber-100/78 mb-0.5" style={{ fontFamily: "'Cinzel', serif", letterSpacing: "0.08em" }}>Daily Door</h2>
                <p className="font-mono text-[10px] text-white/20 uppercase tracking-widest">One door per day</p>
              </div>
              <DailyDoorView used={dailyUsed} onOpen={() => { setView("home"); handleOpenDoor(true); }} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomNav view={view} onView={handleNavChange} />
    </div>
  );
}
