import { motion, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Github } from "lucide-react";

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
function CountUp({ target, duration = 2800 }: { target: number; duration?: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const steps = 100;
    let frame = 0;
    const id = setInterval(() => {
      frame++;
      const eased = 1 - Math.pow(1 - frame / steps, 4);
      setVal(Math.round(eased * target));
      if (frame >= steps) clearInterval(id);
    }, duration / steps);
    return () => clearInterval(id);
  }, [target, duration]);
  return <>{val.toLocaleString()}</>;
}

/* ─── Cinematic Corridor Canvas ─────────────────────────────── */
function CorridorBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    let animId: number;
    let t = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    /* Dust particles */
    const DUST = Array.from({ length: 120 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.2 + 0.3,
      speed: Math.random() * 0.00015 + 0.00005,
      opacity: Math.random() * 0.35 + 0.05,
      drift: (Math.random() - 0.5) * 0.0001,
    }));

    function drawFrame() {
      const W = canvas.width;
      const H = canvas.height;
      t += 0.004;

      /* ── Background ── */
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      /* ── Vanishing point with golden glow ── */
      const vpX = W / 2;
      const vpY = H * 0.46;

      const glowPulse = 0.82 + Math.sin(t * 0.8) * 0.18;
      const grd = ctx.createRadialGradient(vpX, vpY, 0, vpX, vpY, W * 0.5);
      grd.addColorStop(0, `rgba(255,200,80,${0.28 * glowPulse})`);
      grd.addColorStop(0.08, `rgba(255,160,30,${0.18 * glowPulse})`);
      grd.addColorStop(0.22, `rgba(180,100,10,${0.09 * glowPulse})`);
      grd.addColorStop(0.5, `rgba(60,20,0,${0.04})`);
      grd.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);

      /* ── Corridor doors ── */
      const LAYERS = 12;
      const baseW = W * 0.58;
      const baseH = H * 0.80;

      // Slow dolly-in: zoom offset based on t
      const zoom = ((t * 0.18) % 1);

      for (let i = LAYERS; i >= 0; i--) {
        // Interpolate between layer i and i+1 based on zoom
        const raw = i + zoom;
        const scale = Math.pow(0.72, raw);
        const dw = baseW * scale;
        const dh = baseH * scale;
        const x = vpX - dw / 2;
        const y = vpY - dh * 0.62;

        const depth = raw / LAYERS;
        const alpha = Math.min(1, (1 - depth) * 1.4);
        if (alpha < 0.01) continue;

        /* Door frame outer */
        const frameW = 3.5 * scale;
        ctx.strokeStyle = `rgba(${lerp(255, 60, depth)},${lerp(220, 40, depth)},${lerp(100, 10, depth)},${alpha * 0.85})`;
        ctx.lineWidth = frameW;
        ctx.strokeRect(x, y, dw, dh);

        /* Door inner panel lines */
        if (scale > 0.06) {
          const pw = dw * 0.1;
          const ph = dh * 0.08;
          ctx.strokeStyle = `rgba(${lerp(255, 60, depth)},${lerp(200, 30, depth)},${lerp(80, 5, depth)},${alpha * 0.35})`;
          ctx.lineWidth = frameW * 0.5;
          // top panel
          ctx.strokeRect(x + pw, y + ph, dw - pw * 2, dh * 0.38 - ph);
          // bottom panel
          ctx.strokeRect(x + pw, y + dh * 0.42, dw - pw * 2, dh * 0.5 - ph);
        }

        /* Door knob */
        if (scale > 0.12) {
          const kx = x + dw * 0.72;
          const ky = y + dh * 0.55;
          const kr = 2.5 * scale;
          ctx.beginPath();
          ctx.arc(kx, ky, kr, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,200,80,${alpha * 0.7})`;
          ctx.fill();
        }

        /* Ambient floor glow under each door */
        if (scale > 0.08) {
          const floorGrd = ctx.createRadialGradient(vpX, y + dh, 0, vpX, y + dh, dw * 0.7);
          floorGrd.addColorStop(0, `rgba(255,160,30,${alpha * 0.12})`);
          floorGrd.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = floorGrd;
          ctx.fillRect(x - dw * 0.2, y + dh - 2, dw * 1.4, dw * 0.3);
        }
      }

      /* ── Corridor walls (perspective lines) ── */
      const wallAlpha = 0.18;
      // left wall top
      drawWallLine(ctx, 0, 0, vpX, vpY, `rgba(255,180,60,${wallAlpha})`);
      // right wall top
      drawWallLine(ctx, W, 0, vpX, vpY, `rgba(255,180,60,${wallAlpha})`);
      // left wall bottom
      drawWallLine(ctx, 0, H, vpX, vpY, `rgba(255,180,60,${wallAlpha})`);
      // right wall bottom
      drawWallLine(ctx, W, H, vpX, vpY, `rgba(255,180,60,${wallAlpha})`);

      /* ── Dust particles ── */
      for (const p of DUST) {
        p.y -= p.speed;
        p.x += p.drift;
        if (p.y < -0.01) { p.y = 1.01; p.x = Math.random(); }

        const px = p.x * W;
        const py = p.y * H;
        const dist = Math.hypot(px - vpX, py - vpY) / (W * 0.5);
        const alpha = p.opacity * Math.max(0, 1 - dist * 1.8);

        ctx.beginPath();
        ctx.arc(px, py, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,220,120,${alpha})`;
        ctx.fill();
      }

      /* ── Vignette ── */
      const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.85);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.88)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);

      /* ── Film grain ── */
      if (t % 0.1 < 0.004) {
        ctx.fillStyle = "rgba(0,0,0,0.03)";
        for (let k = 0; k < 800; k++) {
          ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
        }
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
      className="absolute inset-0 w-full h-full"
      style={{ display: "block" }}
    />
  );
}

function drawWallLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * Math.min(1, t));
}

/* ─── Navbar ─────────────────────────────────────────────────── */
function Nav() {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 h-16"
      style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%)" }}
    >
      <div className="flex items-center gap-2.5 text-white">
        <DoorMark size={28} />
        <span className="font-display font-bold text-lg tracking-tight">Million Doors</span>
      </div>
      <div className="flex items-center gap-3">
        <motion.a
          href="https://github.com/synterlab/milliondoors"
          target="_blank"
          rel="noreferrer"
          className="hidden sm:flex items-center gap-1.5 text-white/45 hover:text-white/80 transition-colors text-sm font-mono"
          whileHover={{ scale: 1.03 }}
        >
          <Github className="w-4 h-4" />
          <span>GitHub</span>
        </motion.a>
        <motion.a
          href="https://github.com/synterlab/milliondoors"
          target="_blank"
          rel="noreferrer"
          className="flex items-center px-5 py-2 rounded-full bg-amber-400 text-black text-sm font-bold tracking-wide"
          whileHover={{ scale: 1.04, backgroundColor: "#fcd34d" }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
        >
          Open App
        </motion.a>
      </div>
    </motion.nav>
  );
}

/* ─── Stagger variants ───────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 24, filter: "blur(8px)" },
  show: (i: number) => ({
    opacity: 1, y: 0, filter: "blur(0px)",
    transition: { duration: 0.85, delay: 0.2 + i * 0.12, ease: [0.16, 1, 0.3, 1] },
  }),
};

/* ─── Page ───────────────────────────────────────────────────── */
export default function Home() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 30, damping: 25 });
  const springY = useSpring(mouseY, { stiffness: 30, damping: 25 });

  const handleMouse = (e: React.MouseEvent) => {
    mouseX.set((e.clientX - window.innerWidth / 2) * 0.012);
    mouseY.set((e.clientY - window.innerHeight / 2) * 0.012);
  };

  return (
    <>
      <Nav />
      <div
        className="relative min-h-[100dvh] flex flex-col items-center justify-center overflow-hidden select-none bg-black"
        onMouseMove={handleMouse}
      >
        {/* Cinematic corridor animation */}
        <CorridorBackground />

        {/* Dark scrim so text is readable over bright corridor center */}
        <div
          className="absolute inset-0 z-[1] pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 75% 80% at 50% 52%, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.0) 75%)",
          }}
        />

        {/* Content */}
        <motion.div
          className="relative z-10 flex flex-col items-center text-center px-6 max-w-2xl mx-auto w-full"
          style={{ x: springX, y: springY }}
        >
          {/* Live counter badge */}
          <motion.div
            custom={0} variants={fadeUp} initial="hidden" animate="show"
            className="flex items-center gap-2 mb-8"
          >
            <motion.span
              className="w-1.5 h-1.5 rounded-full bg-amber-400"
              animate={{ opacity: [1, 0.2, 1], scale: [1, 1.4, 1] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            />
            <span className="font-mono text-[11px] text-amber-200/55 tracking-[0.32em] uppercase">
              <CountUp target={4821943} /> doors opened worldwide
            </span>
          </motion.div>

          {/* Headline */}
          <motion.div custom={1} variants={fadeUp} initial="hidden" animate="show" className="mb-4">
            <p className="font-mono text-[10px] text-white/25 tracking-[0.5em] uppercase mb-5">
              10,000,000 doors exist
            </p>
            <h1
              className="font-display font-bold tracking-tighter leading-[0.88] text-white"
              style={{ fontSize: "clamp(3.2rem,10vw,8rem)", textShadow: "0 0 60px rgba(255,160,30,0.25)" }}
            >
              Each door
              <br />
              <span
                style={{
                  background: "linear-gradient(135deg, #fef3c7 0%, #fbbf24 35%, #f59e0b 70%, #d97706 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: "drop-shadow(0 0 30px rgba(251,191,36,0.4))",
                }}
              >
                opens once.
              </span>
            </h1>
          </motion.div>

          {/* Description */}
          <motion.p
            custom={2} variants={fadeUp} initial="hidden" animate="show"
            className="text-white/45 text-base md:text-lg leading-relaxed mt-5 mb-10 font-light"
          >
            Most contain nothing.
            <br />
            <span className="text-white/65">Some hide valuable discoveries.</span>
          </motion.p>

          {/* CTAs */}
          <motion.div
            custom={3} variants={fadeUp} initial="hidden" animate="show"
            className="flex flex-col sm:flex-row items-center gap-3"
          >
            <motion.a
              href="https://github.com/synterlab/milliondoors"
              target="_blank"
              rel="noreferrer"
              className="relative flex items-center justify-center px-10 py-4 rounded-full font-bold text-base tracking-widest overflow-hidden text-black"
              style={{
                background: "linear-gradient(135deg, #fef3c7 0%, #fbbf24 40%, #f59e0b 100%)",
                boxShadow: "0 0 40px rgba(251,191,36,0.35), 0 0 80px rgba(251,191,36,0.12)",
              }}
              whileHover={{
                scale: 1.05,
                boxShadow: "0 0 55px rgba(251,191,36,0.55), 0 0 100px rgba(251,191,36,0.2)",
              }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 380, damping: 18 }}
            >
              <motion.div
                className="absolute inset-0"
                style={{
                  background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)",
                  backgroundSize: "200% 100%",
                }}
                animate={{ backgroundPosition: ["-100% 0%", "200% 0%"] }}
                transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 2.5, ease: "easeInOut" }}
              />
              <span className="relative z-10">OPEN A DOOR</span>
            </motion.a>

            <motion.div
              className="flex items-center gap-2 px-6 py-4 rounded-full border border-amber-500/25 bg-black/30 backdrop-blur"
              whileHover={{ borderColor: "rgba(251,191,36,0.45)", backgroundColor: "rgba(0,0,0,0.5)" }}
              transition={{ duration: 0.2 }}
            >
              <motion.span
                className="w-1.5 h-1.5 rounded-full bg-amber-400"
                animate={{ opacity: [1, 0.25, 1] }}
                transition={{ duration: 1.4, repeat: Infinity }}
              />
              <span className="font-mono text-xs text-amber-300/65 tracking-[0.22em] uppercase font-medium">
                Daily Door Available
              </span>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Bottom bar */}
        <div className="absolute bottom-6 left-0 right-0 z-10 flex items-center justify-between px-8">
          <span className="font-mono text-[10px] text-white/18 tracking-widest">
            synterlab / milliondoors
          </span>
          <motion.a
            href="https://x.com/xyzmiiliondoors"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/8 bg-black/30 backdrop-blur"
            whileHover={{ borderColor: "rgba(255,255,255,0.2)", backgroundColor: "rgba(0,0,0,0.5)", scale: 1.04 }}
            transition={{ duration: 0.2 }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="text-white/35">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.629 5.905-5.629Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span className="font-mono text-[10px] text-white/28 tracking-wide">@xyzmiiliondoors</span>
            <motion.span
              className="w-1 h-1 rounded-full bg-amber-400"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </motion.a>
        </div>
      </div>
    </>
  );
}
