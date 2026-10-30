
import { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { gsap, prefersReducedMotion, useMagnetic, useSpotlight } from '../lib/fx'; // <-- GSAP + plugins
import { apiClient } from '../api/client';
import type { Transfer } from '../api/client';
import { TransferList } from '../components/TransferList';
import { LedgerView } from '../components/LedgerView';
import { RefundModal } from '../components/RefundModal'; // <-- IMPORT
import { useNavigate } from 'react-router-dom';

/* ---------- GSAP helpers ---------- */
const hoverTo = (el: HTMLElement, vars: gsap.TweenVars) => {
  if (prefersReducedMotion()) return;
  gsap.to(el, { duration: 0.25, ease: 'power2.out', overwrite: 'auto', ...vars });
};

const formatCount = (n: number) => String(Math.round(n));
const formatINR = (n: number) => n.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });

type StatProps = {
  label: string;
  value: number | string;
  tone?: 'default' | 'ok' | 'warn' | 'bad';
  icon: string;
  countTo?: number; // <-- agar diya to value count-up animate hogi
  format?: (n: number) => string;
};

function StatCard({ label, value, tone = 'default', icon, countTo, format }: StatProps) {
  const valueRef = useRef<HTMLParagraphElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const prev = useRef(0);
  const spotRef = useSpotlight<HTMLDivElement>(); // cursor ke peeche glow

  // Count-up animation (pichli value se nayi value tak)
  useEffect(() => {
    if (countTo === undefined || !valueRef.current) return;
    const el = valueRef.current;
    const fmt = format ?? formatCount;

    if (prefersReducedMotion()) {
      el.textContent = fmt(countTo);
      prev.current = countTo;
      return;
    }

    const obj = { val: prev.current };
    el.textContent = fmt(obj.val);
    const tween = gsap.to(obj, {
      val: countTo,
      duration: 1.4,
      delay: 0.2,
      ease: 'power3.out',
      onUpdate: () => {
        el.textContent = fmt(obj.val);
        prev.current = obj.val;
      },
    });
    return () => {
      tween.kill();
    };
  }, [countTo]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Needs Review" ka icon halka pulse karega jab review pending ho
  useEffect(() => {
    if (tone !== 'warn' || !countTo || !iconRef.current || prefersReducedMotion()) return;
    const icon = iconRef.current;
    const tween = gsap.to(icon, {
      scale: 1.18,
      duration: 0.7,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });
    return () => {
      tween.kill();
      gsap.set(icon, { scale: 1 });
    };
  }, [tone, countTo]);

  return (
    <div
      ref={spotRef}
      className={`stat-card ${tone}`}
      onMouseEnter={(e) => hoverTo(e.currentTarget, { y: -4 })}
      onMouseLeave={(e) => hoverTo(e.currentTarget, { y: 0 })}
    >
      <div className="stat-icon" ref={iconRef}>{icon}</div>
      <div>
        <p className="stat-label">{label}</p>
        <p className="stat-value" ref={valueRef}>{countTo === undefined ? value : null}</p>
      </div>
    </div>
  );
}

export function Dashboard() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [selected, setSelected] = useState<Transfer | null>(null);
  const [refunding, setRefunding] = useState<Transfer | null>(null); // <-- STATE
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // GSAP refs
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<HTMLDivElement>(null);
  const ledgerRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const magBtn = useMagnetic<HTMLButtonElement>(0.3);

  const loadTransfers = () => {
    setLoading(true);
    apiClient.listTransfers()
      .then(data => {
        setTransfers(data);
        if (data.length > 0 && !selected) setSelected(data[0]);
        setError(null);
      })
      .catch((err) => {
        console.error(err);
        setError('Failed to load dashboard data.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTransfers();
  }, []);

  const stats = useMemo(() => {
    const count = (...s: string[]) => transfers.filter((t) => s.includes(String(t.status))).length;
    const volume = transfers.reduce((acc, curr) => acc + Number(curr.amount_minor), 0) / 100;
    
    return {
      total: transfers.length,
      volume: volume.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }),
      volumeRaw: volume, // <-- count-up ke liye
      needsReview: count('REVIEW'),
      failed: count('FAILED', 'REVERSED'),
    };
  }, [transfers]);

  const pendingReviews = transfers.filter(t => t.status === 'REVIEW');
  const hasPending = pendingReviews.length > 0;

  /* ---------- 1. Page-load timeline (hero -> stats -> cards) ---------- */
  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      // Title "decode" hota hai: random characters se final text tak (ScrambleText)
      const titleEl = titleRef.current;
      if (titleEl) titleEl.textContent = '';
      tl.to(titleEl, {
        duration: 1.5,
        ease: 'none',
        scrambleText: { text: heroTitle, chars: 'upperCase', revealDelay: 0.4, speed: 0.6 },
      })
        .from('.hero .wave', { scale: 0, opacity: 0, duration: 0.45, ease: 'back.out(3)' }, '-=0.2')
        .to(
          '.hero .wave',
          {
            keyframes: { rotation: [0, 18, -8, 14, -4, 10, 0], easeEach: 'sine.inOut' },
            transformOrigin: '70% 70%',
            duration: 1.2,
          },
          '<'
        )
        .from('.hero-sub', { y: 16, opacity: 0, duration: 0.6 }, '-=1.1')
        .from('.hero > button', { scale: 0.8, opacity: 0, duration: 0.6, ease: 'back.out(2)' }, '<0.1')
        .from(
          '.stat-card',
          { y: 40, opacity: 0, scale: 0.95, duration: 0.6, stagger: 0.1, ease: 'back.out(1.6)' },
          '-=0.5'
        )
        .from('.grid-2 > .card', { y: 50, opacity: 0, duration: 0.7 }, '-=0.35')
        .from('.grid-2 > .stack', { y: 50, opacity: 0, duration: 0.7 }, '<0.12');
    }, rootRef);

    return () => ctx.revert();
  }, []);

  /* ---------- 2. Transfer list rows: load hone par stagger entry ---------- */
  useEffect(() => {
    if (loading || !listRef.current || prefersReducedMotion()) return;
    const container = listRef.current.firstElementChild;
    const items = container ? Array.from(container.children) : [];
    if (items.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        items,
        { opacity: 0, x: -24 },
        {
          opacity: 1,
          x: 0,
          duration: 0.5,
          stagger: 0.07,
          ease: 'power2.out',
          delay: 0.15,
          clearProps: 'opacity,transform',
        }
      );
    }, listRef);

    return () => ctx.revert();
  }, [loading, transfers]);

  /* ---------- 3. Pending Reviews card: slide-in + attention pulse ---------- */
  useEffect(() => {
    if (!hasPending || !pendingRef.current || prefersReducedMotion()) return;
    const el = pendingRef.current;

    const ctx = gsap.context(() => {
      gsap
        .timeline()
        .fromTo(el, { x: 60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: 'power3.out' })
        .fromTo(
          el,
          { boxShadow: '0 0 0 0 rgba(234, 179, 8, 0.45)' },
          {
            boxShadow: '0 0 0 14px rgba(234, 179, 8, 0)',
            duration: 1.1,
            repeat: 2,
            ease: 'power2.out',
            clearProps: 'boxShadow',
          }
        );
    }, pendingRef);

    return () => ctx.revert();
  }, [hasPending]);

  /* ---------- 4. Ledger panel: transfer select karne par transition ---------- */
  useEffect(() => {
    if (!ledgerRef.current || prefersReducedMotion()) return;
    const items = Array.from(ledgerRef.current.children);
    if (items.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        items,
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          stagger: 0.1,
          ease: 'power3.out',
          clearProps: 'opacity,transform',
        }
      );
    }, ledgerRef);

    return () => ctx.revert();
  }, [selected]);

  /* ---------- 5. Refund modal: overlay fade + dialog pop ---------- */
  useEffect(() => {
    if (!refunding || !modalRef.current || prefersReducedMotion()) return;
    const overlay = modalRef.current.firstElementChild;
    if (!overlay) return;
    const dialog = overlay.firstElementChild;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      tl.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power1.out', clearProps: 'opacity' });
      if (dialog) {
        tl.fromTo(
          dialog,
          { y: 40, scale: 0.94, opacity: 0 },
          { y: 0, scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(1.7)', clearProps: 'opacity,transform' },
          '<0.05'
        );
      }
    }, modalRef);

    return () => ctx.revert();
  }, [refunding]);

  const heroTitle = 'Welcome back, Admin';

  return (
    <div className="dashboard fade-in" ref={rootRef}>
      <section className="hero">
        <div>
          <h2 className="hero-title" aria-label={`${heroTitle} 👋`}>
            <span ref={titleRef} aria-hidden="true">{heroTitle}</span>{' '}
            <span className="wave" aria-hidden="true" style={{ display: 'inline-block' }}>👋</span>
          </h2>
          <p className="hero-sub">Here is what's happening with your ledger today.</p>
        </div>
        <button
          ref={magBtn}
          onClick={() => navigate('/transfers')}
          style={{ padding: '12px 24px', fontSize: '15px', cursor: 'pointer' }}
          onMouseEnter={(e) => hoverTo(e.currentTarget, { scale: 1.05 })}
          onMouseLeave={(e) => hoverTo(e.currentTarget, { scale: 1 })}
          onMouseDown={(e) => hoverTo(e.currentTarget, { scale: 0.96, duration: 0.1 })}
          onMouseUp={(e) => hoverTo(e.currentTarget, { scale: 1.05, duration: 0.15 })}
        >
          + New Transfer
        </button>
      </section>

      {error && <div className="alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

      <section className="stats-row">
        <StatCard label="Total Volume" value={stats.volume} countTo={stats.volumeRaw} format={formatINR} icon="💰" />
        <StatCard label="Total Transfers" value={stats.total} countTo={stats.total} icon="⇄" />
        <StatCard label="Needs Review" value={stats.needsReview} countTo={stats.needsReview} tone="warn" icon="⚠" />
        <StatCard label="Failed" value={stats.failed} countTo={stats.failed} tone="bad" icon="✕" />
      </section>

      <div className="grid-2" style={{ gridColumn: '1 / -1' }}>
        
        <div className="card">
          <div className="row between" style={{ marginBottom: '16px' }}>
            <h2>Recent Activity</h2>
            <button className="secondary" style={{ padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }} onClick={() => navigate('/transactions')}>
              View All
            </button>
          </div>
          
          {loading ? (
            <div className="stack" style={{ gap: 10 }}>
              {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{height: '60px'}} />)}
            </div>
          ) : transfers.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">💸</div>
              <p className="empty-title">No transfers yet</p>
              <p className="muted">Click "New Transfer" to get started.</p>
            </div>
          ) : (
            <div ref={listRef} style={{ display: 'contents' }}>
              <TransferList transfers={transfers.slice(0, 6)} onSelect={setSelected} />
            </div>
          )}
        </div>

        <div className="stack">
          {hasPending && (
            <div ref={pendingRef} className="card" style={{ borderLeft: '4px solid var(--yellow)' }}>
              <div className="row between">
                <h2 style={{ color: 'var(--yellow)', fontSize: '16px' }}>⚠ Pending Reviews</h2>
                <button className="secondary" style={{ padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }} onClick={() => navigate('/risk')}>
                  Go to Risk Center
                </button>
              </div>
              <p className="muted" style={{ marginTop: '8px', fontSize: '13px' }}>
                {pendingReviews.length} transaction(s) are flagged by the AI engine and need manual approval.
              </p>
            </div>
          )}

          {selected ? (
            <div ref={ledgerRef} className="stack">
              <LedgerView transfer={selected} />
              {/* REFUND BUTTON: Sirf tab dikhega jab status SETTLED ho */}
              {selected.status === 'SETTLED' && (
                <button className="full" onClick={() => setRefunding(selected)}>
                  Issue Refund
                </button>
              )}
            </div>
          ) : (
            <div className="card empty" style={{ minHeight: '220px' }}>
              <div className="empty-icon">📒</div>
              <p className="empty-title">Select a transfer</p>
              <p className="muted">Click on a recent transfer to view its double-entry ledger.</p>
            </div>
          )}
        </div>

      </div>

      {/* REFUND MODAL RENDER */}
      {refunding && (
        <div ref={modalRef} style={{ display: 'contents' }}>
          <RefundModal
            transfer={refunding}
            onClose={() => setRefunding(null)}
            onDone={() => {
              setRefunding(null);
              loadTransfers(); // Refresh data after refund
            }}
          />
        </div>
      )}
    </div>
  );
}