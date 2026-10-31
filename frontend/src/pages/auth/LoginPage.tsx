import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, Eye, EyeOff, Layers, Lock, Mail, ShieldCheck, Zap } from "lucide-react";
import { gsap, SplitText, prefersReducedMotion, useMagnetic, useSpotlight } from "../../lib/fx"; 
import "../../styles/auth/LoginPage.scss";

type Status = "idle" | "loading" | "success";

const SAMPLE_ACTIVITY = [
  { from: "WLT-4F2A", to: "WLT-91BC", amount: "₹2,50,000", status: "settled" },
  { from: "WLT-7D10", to: "WLT-33E8", amount: "₹48,200", status: "review" },
  { from: "WLT-0B9C", to: "WLT-C514", amount: "₹1,25,000", status: "settled" },
  { from: "WLT-92AA", to: "WLT-5E07", amount: "₹9,99,000", status: "blocked" },
  { from: "WLT-18F3", to: "WLT-D7B2", amount: "₹12,400", status: "settled" },
  { from: "WLT-6C41", to: "WLT-2A9F", amount: "₹3,10,500", status: "settled" },
];

const LoginPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const curtainRef = useRef<HTMLDivElement>(null);
  const eyeRef = useRef<HTMLSpanElement>(null);
  const spinTween = useRef<gsap.core.Tween | null>(null);

  // States (Sirf ek baar)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const isLoading = status !== "idle";

  const magBtn = useMagnetic<HTMLButtonElement>(0.3);
  const spotCard = useSpotlight<HTMLDivElement>();
  
  const setCard = useCallback(
    (el: HTMLDivElement | null) => {
      cardRef.current = el;
      spotCard(el);
    },
    [spotCard]
  );

  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");

    const container = containerRef.current;
    const card = cardRef.current;
    if (!container || !card || prefersReducedMotion()) return;

    const splits: SplitText[] = [];
    const subtitleEl = container.querySelector(".login-subtitle") as HTMLElement | null;
    const subtitleText = subtitleEl?.textContent ?? "";
    const cleanups: Array<() => void> = [];

    const ctx = gsap.context(() => {
      // Idle Animations
      gsap.to(".floating-coin", {
        y: "random(-40, 40)", x: "random(-30, 30)", rotation: "random(-25, 25)",
        duration: "random(4, 8)", repeat: -1, yoyo: true, ease: "sine.inOut",
        stagger: { each: 0.2, from: "random" },
      });

      gsap.utils.toArray<SVGPathElement>(".bg-line").forEach((path, i) => {
        gsap.timeline({ repeat: -1, repeatDelay: 0.6, delay: i * 0.7 })
          .fromTo(path, { drawSVG: "0% 0%" }, { drawSVG: "0% 100%", duration: 3.2, ease: "power2.inOut" })
          .to(path, { drawSVG: "100% 100%", duration: 2.2, ease: "power2.inOut" }, "+=0.8");
      });

      gsap.fromTo(card, { "--angle": 0 }, { "--angle": 360, duration: 6, repeat: -1, ease: "none" });
      gsap.to(".ticker-track", { yPercent: -50, duration: 22, ease: "none", repeat: -1 });
      gsap.to(".orb", { scale: 1.2, duration: "random(4, 6)", repeat: -1, yoyo: true, ease: "sine.inOut" });
      gsap.to(".logo-icon", { boxShadow: "0 0 50px rgba(34, 197, 94, 0.8)", duration: 1.5, repeat: -1, yoyo: true, ease: "sine.inOut" });

      // Entrance Timeline
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".bg-grid", { opacity: 0, duration: 1.4 }, 0)
        .from(".orb", { opacity: 0, duration: 1.8, stagger: 0.2 }, 0)
        .add(() => {
          const title = container.querySelector(".brand-title") as HTMLElement | null;
          if (!title) return;
          const split = SplitText.create(title, { type: "words", mask: "words" });
          splits.push(split);
          gsap.from(split.words, { yPercent: 115, duration: 1, stagger: 0.07, ease: "power4.out" });
        }, 0.2)
        .from(".brand-badge", { y: -20, opacity: 0, scale: 0.8, duration: 0.7, ease: "back.out(2.5)" }, 0.15)
        .from(".brand-sub", { y: 20, opacity: 0, duration: 0.8 }, 0.7)
        .from(".feature-list li", { x: -40, opacity: 0, duration: 0.8, stagger: 0.14 }, 0.9)
        .from(".ticker", { y: 40, opacity: 0, duration: 0.9 }, 1.3)
        .fromTo(card, { rotationX: -30, y: 90, opacity: 0, scale: 0.9, transformPerspective: 1200, transformOrigin: "50% 100%" }, { rotationX: 0, y: 0, opacity: 1, scale: 1, duration: 1.5, ease: "expo.out" }, 0.3)
        .from(".logo-icon", { scale: 0, rotation: -90, duration: 1, ease: "elastic.out(1, 0.6)" }, 0.7)
        .fromTo(".logo-icon path", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.9, stagger: 0.14, ease: "power2.inOut" }, 1.0)
        .add(() => {
          const logo = container.querySelector(".logo-text") as HTMLElement | null;
          if (!logo) return;
          const split = SplitText.create(logo, { type: "chars", mask: "chars" });
          splits.push(split);
          gsap.from(split.chars, { yPercent: 120, duration: 0.8, stagger: 0.05, ease: "back.out(1.8)" });
        }, 1.05)
        .to(subtitleEl, { duration: 1.4, ease: "none", scrambleText: { text: subtitleText, chars: "upperAndLowerCase", revealDelay: 0.3, speed: 0.7 } }, 1.3)
        .from(".form-item", { y: 30, opacity: 0, duration: 0.8, stagger: 0.1 }, 1.2);

      // Mouse Parallax
      const layers: [string, number][] = [[".orb-1", 60], [".orb-2", -80], [".coins-container", 24], [".bg-grid", -14], [".brand-panel", -10]];
      const movers = layers.map(([sel, amt]) => ({
        amt, x: gsap.quickTo(sel, "x", { duration: 1.2, ease: "power3.out" }), y: gsap.quickTo(sel, "y", { duration: 1.2, ease: "power3.out" }),
      }));
      const onWindowMove = (e: MouseEvent) => {
        const nx = e.clientX / window.innerWidth - 0.5;
        const ny = e.clientY / window.innerHeight - 0.5;
        movers.forEach((m) => { m.x(nx * m.amt); m.y(ny * m.amt); });
      };
      window.addEventListener("mousemove", onWindowMove);
      cleanups.push(() => window.removeEventListener("mousemove", onWindowMove));

      const rotX = gsap.quickTo(card, "rotationX", { duration: 0.6, ease: "power2.out" });
      const rotY = gsap.quickTo(card, "rotationY", { duration: 0.6, ease: "power2.out" });
      const headX = gsap.quickTo(".login-header", "x", { duration: 0.8, ease: "power2.out" });
      const headY = gsap.quickTo(".login-header", "y", { duration: 0.8, ease: "power2.out" });
      const onCardMove = (e: MouseEvent) => {
        const rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        gsap.set(card, { transformPerspective: 1000 });
        rotX(py * -12); rotY(px * 12); headX(px * 14); headY(py * 10);
      };
      const onCardLeave = () => {
        gsap.to(card, { rotationX: 0, rotationY: 0, duration: 1, ease: "elastic.out(1, 0.5)", overwrite: "auto" });
        headX(0); headY(0);
      };
      card.addEventListener("mousemove", onCardMove);
      card.addEventListener("mouseleave", onCardLeave);
      cleanups.push(() => { card.removeEventListener("mousemove", onCardMove); card.removeEventListener("mouseleave", onCardLeave); });
    }, container);

    return () => {
      cleanups.forEach((fn) => fn());
      ctx.revert();
      splits.forEach((s) => s.revert());
      if (subtitleEl) subtitleEl.textContent = subtitleText;
    };
  }, []);

  useEffect(() => () => { spinTween.current?.kill(); }, []);

  const onFieldFocus = (e: React.FocusEvent<HTMLFormElement>) => {
    if (prefersReducedMotion()) return;
    const wrap = (e.target as HTMLElement).closest(".input-wrap");
    if (!wrap) return;
    gsap.to(wrap.querySelector(".focus-line"), { scaleX: 1, duration: 0.6, ease: "power3.out", overwrite: "auto" });
    gsap.fromTo(wrap.querySelector(".field-icon"), { y: 0, scale: 1 }, { keyframes: { y: [0, -4, 0], scale: [1, 1.25, 1] }, duration: 0.5, ease: "power2.out" });
  };
  const onFieldBlur = (e: React.FocusEvent<HTMLFormElement>) => {
    if (prefersReducedMotion()) return;
    const wrap = (e.target as HTMLElement).closest(".input-wrap");
    if (!wrap) return;
    gsap.to(wrap.querySelector(".focus-line"), { scaleX: 0, duration: 0.4, ease: "power2.inOut", overwrite: "auto" });
  };

  const togglePassword = () => {
    setShowPass((s) => !s);
    if (!prefersReducedMotion() && eyeRef.current) {
      gsap.fromTo(eyeRef.current, { rotationY: 90, scale: 0.5, opacity: 0 }, { rotationY: 0, scale: 1, opacity: 1, duration: 0.45, ease: "back.out(2.5)" });
    }
  };

  const getBtnParts = () => {
    const btn = containerRef.current?.querySelector(".login-btn") as HTMLElement | null;
    return {
      btn,
      label: btn?.querySelector(".btn-label") as HTMLElement | null,
      spinner: btn?.querySelector(".btn-spinner") as SVGElement | null,
      check: btn?.querySelector(".btn-check") as SVGElement | null,
    };
  };

  const morphToLoader = () => {
    const { btn, label, spinner } = getBtnParts();
    if (!btn || !label || !spinner) return;

    gsap.set(btn, { alignSelf: "center" });
    const w = btn.offsetWidth;

    gsap.timeline()
      .to(label, { opacity: 0, y: -12, duration: 0.2, ease: "power2.in" })
      .fromTo(btn, { width: w }, { width: 52, borderRadius: 26, duration: 0.55, ease: "power3.inOut" }, "<0.05")
      .fromTo(spinner, { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(2)" }, "-=0.15");

    spinTween.current = gsap.to(spinner, { rotation: 360, duration: 0.9, repeat: -1, ease: "none" });
  };

  const playSuccess = (onDone: () => void) => {
    const { btn, spinner, check } = getBtnParts();
    const card = cardRef.current;
    const curtain = curtainRef.current;
    if (!btn || !spinner || !check || !card || !curtain) return onDone();

    spinTween.current?.kill();

    const r = btn.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const radius = Math.hypot(Math.max(cx, window.innerWidth - cx), Math.max(cy, window.innerHeight - cy));

    gsap.set(curtain, { display: "block", clipPath: `circle(0px at ${cx}px ${cy}px)` });

    gsap.timeline({ onComplete: onDone })
      .to(spinner, { opacity: 0, scale: 0.4, duration: 0.2 })
      .set(check, { opacity: 1 })
      .fromTo(check.querySelector("path"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.45, ease: "power2.out" })
      .to(btn, { scale: 1.18, duration: 0.18, yoyo: true, repeat: 1, ease: "power2.out" }, "<")
      .to(card, { opacity: 0, scale: 0.94, y: -30, duration: 0.55, ease: "power2.in" }, "+=0.15")
      .to(curtain, { clipPath: `circle(${radius}px at ${cx}px ${cy}px)`, duration: 0.9, ease: "power3.inOut" }, "<0.1");
  };

  // REAL API CALL + ANIMATIONS
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setError(null);
    setStatus("loading");
    morphToLoader(); // GSAP Animation start

    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Invalid credentials');
      }

      // Save token
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Success Animation play karo, phir redirect
      setStatus("success");
      playSuccess(() => {
        window.location.href = '/dashboard'; 
      });
      
    } catch (err: any) {
      setError(err.message);
      setStatus("idle");
      
      // Button ko reset karna padega error ke baad
      const { btn, label, spinner } = getBtnParts();
      if (btn && label && spinner) {
        spinTween.current?.kill();
        gsap.to(btn, { width: '100%', borderRadius: 10, duration: 0.3 });
        gsap.to(spinner, { opacity: 0, duration: 0.2 });
        gsap.to(label, { opacity: 1, y: 0, duration: 0.3, delay: 0.1 });
      }
    }
  };

  return (
    <div ref={containerRef} className="login-wrapper" data-theme="dark">
      
      {/* Background layers */}
      <div className="bg-grid" />
      <div className="orb orb-1" />
      <div className="orb orb-2" />

      <svg className="bg-chart" viewBox="0 0 1440 400" preserveAspectRatio="none" aria-hidden="true">
        <path className="bg-line" d="M0 320 C120 300 200 340 320 290 S520 200 640 250 S860 330 980 240 S1240 120 1440 170" />
        <path className="bg-line" d="M0 360 C160 350 260 300 400 330 S640 380 780 310 S1040 220 1180 260 S1340 200 1440 230" />
        <path className="bg-line" d="M0 385 C200 370 320 350 480 365 S760 390 920 350 S1200 290 1440 320" />
      </svg>

      {/* Floating Coins Background */}
      <div className="coins-container">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="floating-coin" style={{ left: `${5 + i * 8}%`, top: `${10 + (i % 5) * 18}%`, fontSize: `${24 + (i % 4) * 12}px` }}>
            {i % 3 === 0 ? "₹" : i % 3 === 1 ? "$" : "€"}
          </div>
        ))}
      </div>

      <div className="login-shell">
        {/* LEFT: Brand panel (desktop) */}
        <aside className="brand-panel">
          <div className="brand-badge">
            <ShieldCheck size={14} /> Bank-grade ledger infrastructure
          </div>
          <h2 className="brand-title">Every rupee tracked. Every entry balanced.</h2>
          <p className="brand-sub">
            Double-entry accounting, an AI risk engine and idempotent transfers, together in one control room.
          </p>

          <ul className="feature-list">
            <li>
              <span className="f-icon"><Layers size={18} /></span>
              <div>
                <strong>Double-entry ledger</strong>
                <span>Every transfer posts balanced debits and credits.</span>
              </div>
            </li>
            <li>
              <span className="f-icon"><ShieldCheck size={18} /></span>
              <div>
                <strong>AI risk engine</strong>
                <span>Suspicious transfers are flagged for review before they settle.</span>
              </div>
            </li>
            <li>
              <span className="f-icon"><Zap size={18} /></span>
              <div>
                <strong>Idempotent transfers</strong>
                <span>Retries never create duplicate payments.</span>
              </div>
            </li>
          </ul>

          <div className="ticker" aria-hidden="true">
            <p className="ticker-caption"><i /> Sample ledger activity</p>
            <div className="ticker-viewport">
              <div className="ticker-track">
                {[...SAMPLE_ACTIVITY, ...SAMPLE_ACTIVITY].map((row, i) => (
                  <div className="ticker-row" key={i}>
                    <span className="ticker-ids">{row.from} <ArrowRight size={12} /> {row.to}</span>
                    <span className="ticker-amt">{row.amount}</span>
                    <span className={`ticker-pill ${row.status}`}>{row.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT: Main Glassmorphism Card */}
        <div ref={setCard} className="login-card">
          <div className="login-header">
            <div className="logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                <path d="M8 7h8" />
                <path d="M8 11h6" />
              </svg>
            </div>
            <h1 className="logo-text">Axiom<span>Ledger</span></h1>
            <p className="login-subtitle">Secure financial infrastructure</p>
          </div>

          <form
            ref={formRef}
            onSubmit={handleSubmit}
            onFocusCapture={onFieldFocus}
            onBlurCapture={onFieldBlur}
            className="login-form"
          >
            <div className="form-group form-item">
              <label htmlFor="login-email">Email Address</label>
              <div className="input-wrap">
                <Mail className="field-icon" size={18} />
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@axiomledger.com"
                  autoComplete="email"
                />
                <span className="focus-line" />
              </div>
            </div>

            <div className="form-group form-item">
              <div className="label-row">
                <label htmlFor="login-password">Password</label>
                <a href="#" className="forgot-link">Forgot password?</a>
              </div>
              <div className="input-wrap">
                <Lock className="field-icon" size={18} />
                <input
                  id="login-password"
                  type={showPass ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="toggle-pass"
                  onClick={togglePassword}
                  aria-label={showPass ? "Hide password" : "Show password"}
                >
                  <span ref={eyeRef} style={{ display: "inline-flex" }}>
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </span>
                </button>
                <span className="focus-line" />
              </div>
            </div>

            {error && (
              <div className="alert-error" style={{ fontSize: '13px', padding: '10px 14px', borderRadius: '8px', marginBottom: '10px' }}>
                {error}
              </div>
            )}

            <button ref={magBtn} type="submit" disabled={isLoading} className="login-btn form-item">
              <span className="btn-label">
                Access Dashboard <ArrowRight size={18} />
              </span>
              <svg className="btn-spinner" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              <svg className="btn-check" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="sr-only" role="status">
                {status === "loading" ? "Authenticating..." : status === "success" ? "Signed in" : ""}
              </span>
            </button>
          </form>

          <div className="login-footer form-item">
            Don't have an account? <a href="#">Request Access</a>
          </div>
        </div>
      </div>

      <p className="security-text">
        AES-256 Encryption • SOC2 Compliant • Zero-Knowledge Architecture
      </p>

      {/* Success par circular wipe (button ke center se phailta hai) */}
      <div ref={curtainRef} className="login-curtain" aria-hidden="true" />
    </div>
  );
};

export default LoginPage;