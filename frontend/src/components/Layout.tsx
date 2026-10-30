
// import { useEffect, useState } from 'react';
// import { Outlet, NavLink, useLocation } from 'react-router-dom';
// import { BalanceBadge } from './BalanceBadge';

// type Theme = 'light' | 'dark';

// const NAV = [
//   { to: '/dashboard', label: 'Dashboard', icon: '▦' },
//   { to: '/transfers', label: 'Send Money', icon: '⇄' },
//   { to: '/bulk', label: 'Bulk Payouts', icon: '📦' },
//   { to: '/transactions', label: 'Transactions', icon: '⇄' },
//   { to: '/wallets', label: 'Wallets', icon: '💼' },
//   { to: '/risk', label: 'Risk Center', icon: '🛡' },
//   { to: '/reconciliation', label: 'Reconciliation', icon: '⚖' },
//   { to: '/analytics', label: 'Analytics', icon: '📊' },
//   { to: '/settings', label: 'Settings', icon: '⚙' },
// ];

// function BrandLogo() {
//   return (
//     <svg width="32" height="32" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
//       <rect width="40" height="40" rx="10" fill="var(--primary)" />
//       <path d="M12 12H28M12 20H22M12 28H26" stroke="var(--primary-text)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
//       <circle cx="27" cy="27" r="5" fill="var(--bg-card)" />
//       <path d="M25 27L26.5 28.5L29 25.5" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
//     </svg>
//   );
// }

// function getInitialTheme(): Theme {
//   try {
//     const saved = localStorage.getItem('theme');
//     if (saved === 'light' || saved === 'dark') return saved;
//   } catch {}
//   return 'dark';
// }

// export function Layout() {
//   const [theme, setTheme] = useState<Theme>(getInitialTheme);
//   const [menuOpen, setMenuOpen] = useState(false);
//   const [refreshKey, setRefreshKey] = useState(0);
//   const { pathname } = useLocation();

//   useEffect(() => {
//     document.documentElement.setAttribute('data-theme', theme);
//     try { localStorage.setItem('theme', theme); } catch {}
//   }, [theme]);

//   useEffect(() => { setMenuOpen(false); }, [pathname]);

//   // Listen for global refresh events (for BalanceBadge)
//   useEffect(() => {
//     const handleRefresh = () => setRefreshKey(k => k + 1);
//     window.addEventListener('refresh-data', handleRefresh);
//     return () => window.removeEventListener('refresh-data', handleRefresh);
//   }, []);

//   const title = NAV.find((n) => pathname.startsWith(n.to))?.label ?? 'AxiomLedger';

//   return (
//     <div className="app-container">
//       {menuOpen && <div className="sidebar-overlay" onClick={() => setMenuOpen(false)} />}

//       <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        
//         {/* --- NAYA BRANDING SECTION --- */}
//         <div style={{ padding: '0 10px', marginBottom: '24px' }}>
//           <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
//             <BrandLogo />
//             <span style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)' }}>
//               Axiom<span style={{ color: 'var(--primary)' }}>Ledger</span>
//             </span>
//           </div>
//           <p style={{ 
//             margin: 0, 
//             fontSize: '10px', 
//             color: 'var(--text-muted)', 
//             textTransform: 'uppercase', 
//             letterSpacing: '0.08em', 
//             fontWeight: 700,
//             lineHeight: 1.4
//           }}>
//             Double-Entry Ledger<br/>& AI Risk Engine
//           </p>
//         </div>

//         <nav className="nav-group">
//           <p className="nav-section">Menu</p>
//           {NAV.map((item) => (
//             <NavLink
//               key={item.to}
//               to={item.to}
//               className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
//             >
//               <span className="nav-icon">{item.icon}</span>
//               {item.label}
//             </NavLink>
//           ))}
//         </nav>

//         <div className="sidebar-footer">
//           <div className="avatar">A</div>
//           <div>
//             <p className="profile-name" style={{margin:0}}>Admin</p>
//             <p className="muted" style={{margin:0, fontSize: 12}}>Finance Ops</p>
//           </div>
//         </div>
//       </aside>

//       <div className="main-content">
//         <header className="topbar">
//           <div className="row">
//             <button
//               className="menu-btn secondary"
//               aria-label="Toggle menu"
//               onClick={() => setMenuOpen((o) => !o)}
//             >
//               ☰
//             </button>
//             <h1>{title}</h1>
//           </div>

//           <div className="topbar-right">
//             <BalanceBadge refreshKey={refreshKey} />
//             <button
//               className="theme-toggle"
//               onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
//               aria-label="Toggle theme"
//             >
//               {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
//             </button>
//           </div>
//         </header>

//         <main className="dashboard-container">
//           <Outlet />
//         </main>
//       </div>
//     </div>
//   );
// }

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { flushSync } from 'react-dom';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Send,
  Package,
  ArrowLeftRight,
  Wallet,
  ShieldAlert,
  Scale,
  BarChart3,
  Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { gsap, Flip, prefersReducedMotion, useMagnetic } from '../lib/fx'; // <-- GSAP + plugins
import { BalanceBadge } from './BalanceBadge';

type Theme = 'light' | 'dark';

const NAV: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transfers', label: 'Send Money', icon: Send },
  { to: '/bulk', label: 'Bulk Payouts', icon: Package },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/wallets', label: 'Wallets', icon: Wallet },
  { to: '/risk', label: 'Risk Center', icon: ShieldAlert },
  { to: '/reconciliation', label: 'Reconciliation', icon: Scale },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

/* ---------- GSAP helpers ---------- */

// Nav item hover: item thoda right shift hota hai, icon pop hota hai
const navHover = (el: HTMLElement, enter: boolean) => {
  if (prefersReducedMotion()) return;
  const icon = el.querySelector('.nav-icon');
  gsap.to(el, { x: enter ? 4 : 0, duration: 0.25, ease: 'power2.out', overwrite: 'auto' });
  if (icon) {
    gsap.to(icon, {
      scale: enter ? 1.25 : 1,
      rotation: enter ? -8 : 0,
      duration: 0.3,
      ease: enter ? 'back.out(3)' : 'power2.out',
      overwrite: 'auto',
    });
  }
};

// Chhota press/bounce feedback buttons ke liye
const bounce = (el: HTMLElement) => {
  if (prefersReducedMotion()) return;
  gsap.fromTo(
    el,
    { scale: 0.9, rotation: -6 },
    { scale: 1, rotation: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)', overwrite: 'auto' }
  );
};

function BrandLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="var(--primary)" />
      <path d="M12 12H28M12 20H22M12 28H26" stroke="var(--primary-text)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="27" cy="27" r="5" fill="var(--bg-card)" />
      <path d="M25 27L26.5 28.5L29 25.5" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {}
  return 'dark';
}

// View Transitions: default cross-fade band, circular reveal hum khud chalayenge
const VT_CSS = `
::view-transition-old(root), ::view-transition-new(root) { animation: none; mix-blend-mode: normal; }
::view-transition-old(root) { z-index: 1; }
::view-transition-new(root) { z-index: 2; }
`;

export function Layout() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { pathname } = useLocation();

  // GSAP refs
  const rootRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const curtainRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<ReturnType<typeof Flip.getState> | null>(null);
  const prevPath = useRef(pathname);
  const magToggle = useMagnetic<HTMLButtonElement>(0.35);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('theme', theme); } catch {}
  }, [theme]);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // Listen for global refresh events (for BalanceBadge)
  useEffect(() => {
    const handleRefresh = () => setRefreshKey(k => k + 1);
    window.addEventListener('refresh-data', handleRefresh);
    return () => window.removeEventListener('refresh-data', handleRefresh);
  }, []);

  /* ---------- 1. First load: topbar, logo, nav items, footer ---------- */
  // Note: sidebar container ko animate nahi kiya (mobile pe CSS transform se slide hota hai),
  // sirf uske andar ke elements animate hote hain.
  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.from('.topbar', { y: -40, opacity: 0, duration: 0.6 })
        .from('.sidebar > div:first-child', { x: -24, opacity: 0, duration: 0.6 }, 0.05)
        .from(
          '.sidebar > div:first-child svg',
          { scale: 0, rotation: -120, transformOrigin: '50% 50%', duration: 0.8, ease: 'back.out(2)' },
          0.15
        )
        .from('.nav-section', { opacity: 0, x: -16, duration: 0.4 }, 0.3)
        .from('.nav-item', { x: -30, opacity: 0, duration: 0.5, stagger: 0.05 }, 0.35)
        .from('.sidebar-footer', { y: 24, opacity: 0, duration: 0.6 }, '-=0.3')
        .from('.topbar-right > *', { y: -16, opacity: 0, duration: 0.5, stagger: 0.1 }, 0.3);
    }, rootRef);

    return () => ctx.revert();
  }, []);

  /* ---------- 2. Route change: curtain reveal + title slide + Flip nav indicator ---------- */
  // useLayoutEffect => paint se pehle curtain lag jaata hai, naya page "reveal" hota hai
  useLayoutEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;
    if (prefersReducedMotion()) {
      flipRef.current = null;
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.topbar h1',
        { y: 14, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.45, delay: 0.25, ease: 'power3.out', clearProps: 'opacity,transform' }
      );

      // 5 vertical strips: center se bahar ki taraf khulti hain
      const strips = curtainRef.current ? Array.from(curtainRef.current.children) : [];
      if (strips.length) {
        gsap.fromTo(
          strips,
          { scaleY: 1, transformOrigin: 'bottom' },
          {
            scaleY: 0,
            transformOrigin: 'bottom',
            duration: 0.7,
            ease: 'power4.inOut',
            stagger: { each: 0.06, from: 'edges' },
          }
        );
      }

      // Active nav indicator purani jagah se nayi jagah elastic slide karta hai (Flip)
      if (flipRef.current) {
        Flip.from(flipRef.current, { duration: 0.9, ease: 'elastic.out(1, 0.6)' });
        flipRef.current = null;
      }
    }, rootRef);

    return () => ctx.revert();
  }, [pathname]);

  /* ---------- 3. Mobile menu overlay fade-in ---------- */
  useEffect(() => {
    if (!menuOpen || !overlayRef.current || prefersReducedMotion()) return;
    const tween = gsap.fromTo(
      overlayRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.3, ease: 'power1.out', clearProps: 'opacity' }
    );
    return () => {
      tween.kill();
    };
  }, [menuOpen]);

  // Theme toggle: click point se circular reveal (View Transitions API), unsupported browsers me normal switch
  const toggleTheme = (e: ReactMouseEvent<HTMLElement>) => {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    bounce(e.currentTarget);

    const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
    if (!doc.startViewTransition || prefersReducedMotion()) {
      setTheme(next);
      return;
    }

    const x = e.clientX;
    const y = e.clientY;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

    const transition = doc.startViewTransition(() => {
      flushSync(() => setTheme(next));
      document.documentElement.setAttribute('data-theme', next);
    });

    transition.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 800, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', pseudoElement: '::view-transition-new(root)' }
      );
    });
  };

  const title = NAV.find((n) => pathname.startsWith(n.to))?.label ?? 'AxiomLedger';

  return (
    <div className="app-container" ref={rootRef}>
      <style>{VT_CSS}</style>

      {/* Page transition curtain (pointer events band) */}
      <div
        ref={curtainRef}
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, zIndex: 60, pointerEvents: 'none', display: 'flex' }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={{ flex: 1, background: 'var(--primary)', transform: 'scaleY(0)' }} />
        ))}
      </div>

      {menuOpen && <div ref={overlayRef} className="sidebar-overlay" onClick={() => setMenuOpen(false)} />}

      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        
        {/* --- NAYA BRANDING SECTION --- */}
        <div style={{ padding: '0 10px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <BrandLogo />
            <span style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)' }}>
              Axiom<span style={{ color: 'var(--primary)' }}>Ledger</span>
            </span>
          </div>
          <p style={{ 
            margin: 0, 
            fontSize: '10px', 
            color: 'var(--text-muted)', 
            textTransform: 'uppercase', 
            letterSpacing: '0.08em', 
            fontWeight: 700,
            lineHeight: 1.4
          }}>
            Double-Entry Ledger<br/>& AI Risk Engine
          </p>
        </div>

        <nav className="nav-group">
          <p className="nav-section">Menu</p>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              style={{ position: 'relative' }}
              onClick={() => {
                // Route badalne se pehle indicator ki position capture (Flip)
                if (prefersReducedMotion()) return;
                flipRef.current = Flip.getState('.nav-indicator');
                window.setTimeout(() => { flipRef.current = null; }, 500);
              }}
              onMouseEnter={(e) => navHover(e.currentTarget, true)}
              onMouseLeave={(e) => navHover(e.currentTarget, false)}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      className="nav-indicator"
                      data-flip-id="nav-indicator"
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: '18%',
                        bottom: '18%',
                        width: 3,
                        borderRadius: 3,
                        background: 'var(--primary)',
                        boxShadow: '0 0 12px var(--primary)',
                      }}
                    />
                  )}
                  <span className="nav-icon" style={{ display: 'inline-flex' }}>
                    <item.icon size={18} strokeWidth={2} />
                  </span>
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="avatar">A</div>
          <div>
            <p className="profile-name" style={{margin:0}}>Admin</p>
            <p className="muted" style={{margin:0, fontSize: 12}}>Finance Ops</p>
          </div>
        </div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <div className="row">
            <button
              className="menu-btn secondary"
              aria-label="Toggle menu"
              onClick={(e) => {
                bounce(e.currentTarget);
                setMenuOpen((o) => !o);
              }}
            >
              ☰
            </button>
            <h1>{title}</h1>
          </div>

          <div className="topbar-right">
            <BalanceBadge refreshKey={refreshKey} />
            <button
              ref={magToggle}
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
            </button>
          </div>
        </header>

        <main className="dashboard-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
}