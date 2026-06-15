import { motion, useMotionValue, useSpring, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Github } from "lucide-react";

const APP_URL = import.meta.env.BASE_URL + "app";

/* ─── Door Logo ─────────────────────────────────────────────── */
function DoorMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="17" height="26" rx="2.5" stroke="currentColor" strokeWidth="2.2" />
      <rect x="27" y="4" width="17" height="26" rx="2.5" stroke="currentColor" strokeWidth="2.2" />
      <rect x="4" y="34" width="17" height="10" rx="2.5" stroke="currentColor" strokeWidth="2.2" />
      <rect x="27" y="34" width="17" height="10" rx="2.5" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="19.5" cy="17" r="1.8" fill="currentColor" opacity="0.6" />
      <circle cx="28.5" cy="17" r="1.8" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

/* ─── CountUp ────────────────────────────────────────────────── */
function CountUp({ target, duration = 3200 }: { target: number; duration?: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let startTs: number | null = null;
    let rafId: number;
    function tick(ts: number) {
      if (!startTs) startTs = ts;
      const progress = Math.min((ts - startTs) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setVal(Math.round(eased * target));
      if (progress < 1) rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);
  return <>{val.toLocaleString()}</>;
}

/* ─── Lerp helper ───────────────────────────────────────────── */
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

/* ─── Cinematic Corridor Canvas ─────────────────────────────── */
function CorridorBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false })!;

    let animId: number;
    let t = 0;
    let lastTs = 0;

    // ── DPR-aware resize ──────────────────────────────────────
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let cachedW = window.innerWidth;
    let cachedH = window.innerHeight;
    let vigGrd: CanvasGradient | null = null;

    const buildVignette = (W: number, H: number) => {
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, W * 0.88);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.90)");
      return g;
    };

    const resize = () => {
      cachedW = window.innerWidth;
      cachedH = window.innerHeight;
      canvas.width = cachedW * dpr;
      canvas.height = cachedH * dpr;
      canvas.style.width = cachedW + "px";
      canvas.style.height = cachedH + "px";
      ctx.scale(dpr, dpr);
      vigGrd = buildVignette(cachedW, cachedH);
    };
    resize();
    window.addEventListener("resize", resize);

    // ── Dust particles (fewer for performance) ────────────────
    const DUST = Array.from({ length: 80 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.0 + 0.3,
      speed: Math.random() * 0.00012 + 0.00004,
      opacity: Math.random() * 0.28 + 0.04,
      drift: (Math.random() - 0.5) * 0.00008,
    }));

    function drawFrame(ts: number) {
      const delta = lastTs ? Math.min((ts - lastTs) / 16.667, 2) : 1;
      lastTs = ts;
      const W = cachedW;
      const H = cachedH;
      t += 0.003 * delta; // frame-rate independent dolly

      // ── Background ──────────────────────────────────────────
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      // ── Vanishing point ─────────────────────────────────────
      const vpX = W / 2;
      const vpY = H * 0.46;

      const glowPulse = 0.82 + Math.sin(t * 0.7) * 0.18;
      const grd = ctx.createRadialGradient(vpX, vpY, 0, vpX, vpY, W * 0.52);
      grd.addColorStop(0,    `rgba(255,200,80,${0.26 * glowPulse})`);
      grd.addColorStop(0.08, `rgba(255,160,30,${0.16 * glowPulse})`);
      grd.addColorStop(0.25, `rgba(160,80,10,${0.07 * glowPulse})`);
      grd.addColorStop(0.55, `rgba(40,10,0,0.03)`);
      grd.addColorStop(1,    "rgba(0,0,0,0)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);

      // ── Corridor doors (seamless infinite loop) ──────────────
      const LAYERS = 10;
      const baseW  = W * 0.58;
      const baseH  = H * 0.80;

      // Continuous phase — no visible jump
      const phase  = t * 0.16;   // grows forever
      const zoom   = phase % 1;  // fractional offset [0,1)

      for (let i = LAYERS; i >= 0; i--) {
        const raw   = i + zoom;
        const scale = Math.pow(0.74, raw);
        const dw    = baseW * scale;
        const dh    = baseH * scale;
        const x     = vpX - dw / 2;
        const y     = vpY - dh * 0.62;
        const depth = raw / LAYERS;

        // smooth fade-in for the foreground door (prevents jump at loop wrap)
        const foregroundFade = i === 0 ? Math.min(1, zoom / 0.18) : 1;
        const alpha = Math.min(1, (1 - depth) * 1.45) * foregroundFade;
        if (alpha < 0.015 || dw < 2) continue;

        const r  = Math.round(lerp(255, 55, depth));
        const g  = Math.round(lerp(210, 38, depth));
        const b  = Math.round(lerp(90,  8,  depth));

        // Door frame
        ctx.strokeStyle = `rgba(${r},${g},${b},${alpha * 0.88})`;
        ctx.lineWidth   = Math.max(0.5, 3.5 * scale);
        ctx.strokeRect(x, y, dw, dh);

        // Inner panels (only for larger doors)
        if (scale > 0.055) {
          const pw = dw * 0.1;
          const ph = dh * 0.08;
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha * 0.28})`;
          ctx.lineWidth   = Math.max(0.4, 1.8 * scale);
          ctx.strokeRect(x + pw, y + ph,          dw - pw * 2, dh * 0.38 - ph);
          ctx.strokeRect(x + pw, y + dh * 0.42,   dw - pw * 2, dh * 0.50 - ph);
        }

        // Knob
        if (scale > 0.11) {
          ctx.beginPath();
          ctx.arc(x + dw * 0.72, y + dh * 0.55, Math.max(1, 2.4 * scale), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,195,75,${alpha * 0.75})`;
          ctx.fill();
        }

        // Floor ambient glow
        if (scale > 0.075) {
          const fg = ctx.createRadialGradient(vpX, y + dh, 0, vpX, y + dh, dw * 0.65);
          fg.addColorStop(0, `rgba(255,155,25,${alpha * 0.10})`);
          fg.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = fg;
          ctx.fillRect(x - dw * 0.25, y + dh - 2, dw * 1.5, dw * 0.28);
        }
      }

      // ── Perspective wall lines ───────────────────────────────
      for (const [x1, y1] of [[0,0],[W,0],[0,H],[W,H]] as const) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(vpX, vpY);
        ctx.strokeStyle = "rgba(255,175,55,0.14)";
        ctx.lineWidth   = 1;
        ctx.stroke();
      }

      // ── Dust (every frame) ───────────────────────────────────
      for (const p of DUST) {
        p.y -= p.speed;
        p.x += p.drift;
        if (p.y < -0.01) { p.y = 1.02; p.x = Math.random(); }

        const px   = p.x * W;
        const py   = p.y * H;
        const dist = Math.hypot(px - vpX, py - vpY) / (W * 0.5);
        const a    = p.opacity * Math.max(0, 1 - dist * 1.9);
        if (a < 0.01) continue;

        ctx.beginPath();
        ctx.arc(px, py, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,218,115,${a})`;
        ctx.fill();
      }

      // ── Vignette (cached — rebuilt only on resize) ───────────
      if (vigGrd) {
        ctx.fillStyle = vigGrd;
        ctx.fillRect(0, 0, W, H);
      }

      animId = requestAnimationFrame(drawFrame);
    }

    animId = requestAnimationFrame(drawFrame);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0"
      style={{ display: "block", willChange: "transform", transform: "translateZ(0)" }}
    />
  );
}

/* ─── Navbar ─────────────────────────────────────────────────── */
function Nav() {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1.2, delay: 2.2, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 h-16"
      style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, transparent 100%)" }}
    >
      <div className="flex items-center gap-2.5 text-amber-200/85">
        <DoorMark size={28} />
        <span
          className="font-display font-semibold text-base uppercase"
          style={{ letterSpacing: "0.14em" }}
        >
          Million Doors
        </span>
      </div>
      <div className="flex items-center gap-3">
        <motion.a
          href="https://github.com/synterlab/milliondoors"
          target="_blank"
          rel="noreferrer"
          className="hidden sm:flex items-center gap-1.5 text-white/30 hover:text-white/65 transition-colors duration-300 text-xs font-mono tracking-widest"
          whileHover={{ scale: 1.04 }}
        >
          <Github className="w-3.5 h-3.5" />
          <span>GitHub</span>
        </motion.a>
        <motion.a
          href={APP_URL}
          className="flex items-center px-5 py-2 rounded-full bg-amber-400 text-black text-xs font-bold uppercase"
          style={{ fontFamily: "'Cinzel', serif", letterSpacing: "0.14em" }}
          whileHover={{ scale: 1.05, backgroundColor: "#fcd34d" }}
          whileTap={{ scale: 0.96 }}
          transition={{ type: "spring", stiffness: 380, damping: 22 }}
        >
          Open App
        </motion.a>
      </div>
    </motion.nav>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function Home() {
  const [introGone, setIntroGone] = useState(false);

  // Subtle parallax
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 22, damping: 28 });
  const springY = useSpring(mouseY, { stiffness: 22, damping: 28 });

  const handleMouse = (e: React.MouseEvent) => {
    mouseX.set((e.clientX - window.innerWidth  / 2) * 0.008);
    mouseY.set((e.clientY - window.innerHeight / 2) * 0.008);
  };

  // Stagger timing — all content waits for intro to clear
  const INTRO_DUR   = 1.8;  // black overlay fade duration
  const CONTENT_START = 1.0; // content starts fading in at t=1.0s

  const item = (i: number) => ({
    initial:  { opacity: 0, y: 20, filter: "blur(8px)" },
    animate:  { opacity: 1, y: 0,  filter: "blur(0px)" },
    transition: {
      duration: 1.1,
      delay: CONTENT_START + i * 0.16,
      ease: [0.16, 1, 0.3, 1],
    },
  });

  return (
    <>
      {/* ── Cinematic black intro overlay ── */}
      <AnimatePresence>
        {!introGone && (
          <motion.div
            className="fixed inset-0 z-[100] bg-black pointer-events-none"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: INTRO_DUR, ease: [0.4, 0, 0.2, 1] }}
            onAnimationComplete={() => setIntroGone(true)}
          />
        )}
      </AnimatePresence>

      <Nav />

      <div
        className="relative min-h-[100dvh] flex flex-col items-center justify-center overflow-hidden select-none bg-black"
        onMouseMove={handleMouse}
      >
        {/* GPU-accelerated corridor */}
        <CorridorBackground />

        {/* Dark scrim for text legibility */}
        <div
          className="absolute inset-0 z-[1] pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 72% 78% at 50% 52%, rgba(0,0,0,0.68) 0%, rgba(0,0,0,0.0) 72%)",
          }}
        />

        {/* Content */}
        <motion.div
          className="relative z-10 flex flex-col items-center text-center px-6 max-w-xl mx-auto w-full"
          style={{ x: springX, y: springY }}
        >
          {/* Live counter */}
          <motion.div className="flex items-center gap-2.5 mb-9" {...item(0)}>
            <motion.span
              className="w-1.5 h-1.5 rounded-full bg-amber-400"
              animate={{ opacity: [1, 0.2, 1], scale: [1, 1.5, 1] }}
              transition={{ duration: 2.0, repeat: Infinity, ease: "easeInOut" }}
            />
            <span className="font-mono text-[10px] text-amber-200/42 tracking-[0.42em] uppercase">
              <CountUp target={4821943} /> doors opened worldwide
            </span>
          </motion.div>

          {/* Eyebrow */}
          <motion.p
            className="font-mono text-[9px] text-white/18 tracking-[0.65em] uppercase mb-7"
            {...item(1)}
          >
            10,000,000 doors exist
          </motion.p>

          {/* Main headline — line 1 */}
          <motion.div {...item(2)}>
            <h1
              className="font-display text-white leading-[0.90]"
              style={{
                fontSize: "clamp(3rem, 9.5vw, 7.5rem)",
                fontWeight: 700,
                letterSpacing: "0.03em",
                textShadow: "0 0 90px rgba(255,150,20,0.15), 0 0 30px rgba(255,120,0,0.06)",
              }}
            >
              Each door
            </h1>
          </motion.div>

          {/* Main headline — line 2 (slight delay for cinematic reveal) */}
          <motion.div className="mb-7" {...item(3)}>
            <h1
              className="font-display leading-[0.90]"
              style={{
                fontSize: "clamp(3rem, 9.5vw, 7.5rem)",
                fontWeight: 700,
                letterSpacing: "0.03em",
                background: "linear-gradient(135deg, #fef9e7 0%, #fcd34d 28%, #f59e0b 62%, #d97706 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                filter: "drop-shadow(0 0 28px rgba(251,191,36,0.48))",
                display: "inline-block",
              }}
            >
              opens once.
            </h1>
          </motion.div>

          {/* Thin gold rule */}
          <motion.div
            className="w-12 h-px mb-7"
            style={{ background: "linear-gradient(90deg, transparent, rgba(251,191,36,0.45), transparent)" }}
            {...item(4)}
          />

          {/* Body copy */}
          <motion.p
            className="text-white/38 text-sm leading-loose tracking-wide mb-11"
            style={{ fontFamily: "'Inter', sans-serif", fontWeight: 300 }}
            {...item(5)}
          >
            Most contain nothing.
            <br />
            <span className="text-white/58 font-normal">Some hide rare discoveries.</span>
          </motion.p>

          {/* CTAs */}
          <motion.div className="flex flex-col sm:flex-row items-center gap-4" {...item(6)}>
            {/* Primary */}
            <motion.a
              href={APP_URL}
              className="relative flex items-center justify-center px-12 py-4 rounded-full overflow-hidden text-black"
              style={{
                background: "linear-gradient(135deg, #fef3c7 0%, #fbbf24 42%, #f59e0b 100%)",
                boxShadow: "0 0 38px rgba(251,191,36,0.38), 0 0 75px rgba(251,191,36,0.10)",
                fontFamily: "'Cinzel', serif",
                fontWeight: 700,
                fontSize: "0.72rem",
                letterSpacing: "0.24em",
              }}
              whileHover={{
                scale: 1.06,
                boxShadow: "0 0 55px rgba(251,191,36,0.62), 0 0 110px rgba(251,191,36,0.22)",
              }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 340, damping: 20 }}
            >
              {/* Shimmer sweep */}
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
            </motion.a>

            {/* Daily door */}
            <motion.div
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-full border border-amber-500/18 bg-black/30 backdrop-blur-sm"
              whileHover={{ borderColor: "rgba(251,191,36,0.38)", backgroundColor: "rgba(0,0,0,0.52)" }}
              transition={{ duration: 0.25 }}
            >
              <motion.span
                className="w-1.5 h-1.5 rounded-full bg-amber-400"
                animate={{ opacity: [1, 0.25, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
              <span
                className="text-amber-300/52 uppercase"
                style={{ fontFamily: "'Cinzel', serif", fontSize: "0.62rem", fontWeight: 600, letterSpacing: "0.28em" }}
              >
                Daily Door Available
              </span>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Bottom bar */}
        <motion.div
          className="absolute bottom-6 left-0 right-0 z-10 flex items-center justify-between px-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: CONTENT_START + 1.2 }}
        >
          <span
            className="text-white/14 uppercase"
            style={{ fontFamily: "'Cinzel', serif", fontSize: "0.52rem", letterSpacing: "0.26em" }}
          >
            synterlab / milliondoors
          </span>
          <motion.a
            href="https://x.com/xyzmiiliondoors"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/8 bg-black/28 backdrop-blur-sm"
            whileHover={{ borderColor: "rgba(255,255,255,0.18)", backgroundColor: "rgba(0,0,0,0.52)", scale: 1.05 }}
            transition={{ duration: 0.2 }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-white/28">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.629 5.905-5.629Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span className="font-mono text-[9px] text-white/25 tracking-wide">@xyzmiiliondoors</span>
            <motion.span
              className="w-1 h-1 rounded-full bg-amber-400"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 2.2, repeat: Infinity }}
            />
          </motion.a>
        </motion.div>
      </div>
    </>
  );
}
