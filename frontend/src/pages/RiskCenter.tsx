import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { gsap, Draggable, prefersReducedMotion } from '../lib/fx'; // <-- GSAP + plugins
import { apiClient } from '../api/client';
import type { Transfer } from '../api/client';

type RiskTransfer = Transfer & {
  risk_score?: number;
  risk_reasons?: string[];
  failure_reason?: string;
};

/* ---------- GSAP helpers ---------- */
// Number count-up (pichli value se nayi value tak, jab bhi value badle)
function CountUp({ value, duration = 1.2, delay = 0.3 }: { value: number; duration?: number; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (prefersReducedMotion()) {
      el.textContent = String(value);
      prev.current = value;
      return;
    }

    const obj = { val: prev.current };
    el.textContent = String(Math.round(obj.val));
    const tween = gsap.to(obj, {
      val: value,
      duration,
      delay,
      ease: 'power3.out',
      onUpdate: () => {
        el.textContent = String(Math.round(obj.val));
        prev.current = obj.val;
      },
      onComplete: () => {
        el.textContent = String(value);
        prev.current = value;
      },
    });
    return () => {
      tween.kill();
    };
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return <span ref={ref}></span>;
}

// Review card hover: halka lift + shadow
const cardEnter = (e: ReactMouseEvent<HTMLElement>) => {
  if (prefersReducedMotion()) return;
  gsap.to(e.currentTarget, {
    y: -3,
    boxShadow: '0 10px 28px rgba(0, 0, 0, 0.22)',
    duration: 0.3,
    ease: 'power2.out',
    overwrite: 'auto',
  });
};
const cardLeave = (e: ReactMouseEvent<HTMLElement>) => {
  if (prefersReducedMotion()) return;
  gsap.to(e.currentTarget, {
    y: 0,
    boxShadow: '0 0 0 rgba(0, 0, 0, 0)',
    duration: 0.3,
    ease: 'power2.out',
    overwrite: 'auto',
  });
};

// Approve / Reject buttons: hover + press feedback
const btnEnter = (e: ReactMouseEvent<HTMLElement>) => {
  if (prefersReducedMotion()) return;
  const el = e.currentTarget;
  el.style.transition = 'none'; // CSS transition GSAP ke saath lag karta hai
  gsap.to(el, { scale: 1.03, duration: 0.2, ease: 'power2.out', overwrite: 'auto' });
};
const btnLeave = (e: ReactMouseEvent<HTMLElement>) => {
  if (prefersReducedMotion()) return;
  const el = e.currentTarget;
  gsap.to(el, {
    scale: 1,
    duration: 0.25,
    ease: 'power2.out',
    overwrite: 'auto',
    onComplete: () => {
      el.style.transition = '';
    },
  });
};
const btnDown = (e: ReactMouseEvent<HTMLElement>) => {
  if (prefersReducedMotion()) return;
  gsap.to(e.currentTarget, { scale: 0.96, duration: 0.1, overwrite: 'auto' });
};
const btnUp = (e: ReactMouseEvent<HTMLElement>) => {
  if (prefersReducedMotion()) return;
  gsap.to(e.currentTarget, { scale: 1.03, duration: 0.15, overwrite: 'auto' });
};

// Action ke baad card ka exit: approve -> green ring + right nikal jaata hai, reject -> red ring + shake + left
const exitCard = (card: HTMLElement, action: 'approve' | 'reject') =>
  new Promise<void>((resolve) => {
    if (prefersReducedMotion()) return resolve();
    const approve = action === 'approve';
    const x0 = Number(gsap.getProperty(card, 'x')) || 0; // swipe se aaye to wahin se continue
    const ring = approve ? 'rgba(16, 185, 129, 0.9)' : 'rgba(248, 113, 113, 0.9)';

    const tl = gsap.timeline({ onComplete: resolve });
    tl.to(card, { boxShadow: `0 0 0 3px ${ring}`, scale: 1.02, duration: 0.2, ease: 'power2.out' });
    if (!approve) {
      tl.to(card, { keyframes: { x: [x0, x0 - 10, x0 + 10, x0 - 8, x0 + 8, x0] }, duration: 0.35 });
    }
    tl.to(card, {
      x: x0 + (approve ? 140 : -140),
      rotation: approve ? 2 : -3,
      opacity: 0,
      duration: 0.5,
      ease: 'power2.in',
    })
      .set(card, { overflow: 'hidden' })
      .to(
        card,
        {
          height: 0,
          paddingTop: 0,
          paddingBottom: 0,
          marginTop: 0,
          marginBottom: 0,
          borderWidth: 0,
          duration: 0.3,
          ease: 'power2.inOut',
        },
        '>-0.1'
      );
  });

const shakeCard = (card: HTMLElement) => {
  if (prefersReducedMotion()) return;
  gsap.fromTo(
    card,
    { x: 0 },
    { keyframes: { x: [0, -10, 10, -8, 8, 0] }, duration: 0.4, clearProps: 'transform' }
  );
};

// "All clear!" par confetti
const CONFETTI_COLORS = ['#34d399', '#fbbf24', '#60a5fa', '#f472b6', '#a78bfa'];
const burst = (origin: HTMLElement, pieces: HTMLElement[]) => {
  const rect = origin.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  for (let i = 0; i < 24; i++) {
    const p = document.createElement('div');
    const size = gsap.utils.random(6, 10);
    Object.assign(p.style, {
      position: 'fixed',
      left: `${cx}px`,
      top: `${cy}px`,
      width: `${size}px`,
      height: `${size * 0.6}px`,
      background: gsap.utils.random(CONFETTI_COLORS),
      borderRadius: '2px',
      pointerEvents: 'none',
      zIndex: '9999',
    });
    document.body.appendChild(p);
    pieces.push(p);

    gsap
      .timeline({ onComplete: () => p.remove() })
      .to(p, {
        x: gsap.utils.random(-150, 150),
        y: gsap.utils.random(-180, -50),
        rotation: gsap.utils.random(-540, 540),
        duration: 0.7,
        ease: 'power2.out',
      })
      .to(p, { y: '+=170', opacity: 0, duration: 0.9, ease: 'power1.in' });
  }
};

export function RiskCenter() {
  const [transfers, setTransfers] = useState<RiskTransfer[]>([]);
  const [loading, setLoading] = useState(true);

  // GSAP refs
  const rootRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLParagraphElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const emptyRef = useRef<HTMLDivElement>(null);
  const blockedRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const acting = useRef<Set<string>>(new Set()); // double-click se bachne ke liye
  const hadItems = useRef(false);

  const loadData = () => {
    setLoading(true);
    apiClient.listTransfers().then(data => {
      setTransfers(data as RiskTransfer[]);
      setLoading(false);
    });
  };

  useEffect(() => { loadData(); }, []);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    if (acting.current.has(id)) return;
    acting.current.add(id);
    const card = cardRefs.current[id];

    try {
      const res = await fetch(`/api/transfers/${id}/${action}`, { method: 'POST' });
      if (!res.ok) throw new Error('Action failed');
      
      window.dispatchEvent(new Event('refresh-data')); // Refresh global balance
      if (card) await exitCard(card, action); // <-- exit animation, phir list refresh
      loadData(); // Refresh list
    } catch (e) {
      if (card) shakeCard(card);
      alert('Error processing action');
    } finally {
      acting.current.delete(id);
    }
  };

  const reviewQueue = transfers.filter(t => t.status === 'REVIEW');
  const blockedHistory = transfers.filter(t => t.status === 'FAILED' && t.failure_reason === 'Rejected by Risk Team');

  const heroTitle = ' AI Risk Operations Center';
  const queueKey = reviewQueue.map((t) => t.id).join(',');
  const blockedKey = blockedHistory.slice(0, 5).map((t) => t.id).join(',');
  const isEmpty = !loading && reviewQueue.length === 0;
  const hasPending = reviewQueue.length > 0;

  /* ---------- 1. Page load timeline ---------- */
  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.from('.hero', { y: -30, opacity: 0, duration: 0.6 })
        .from('.hero .shield', { scale: 0, rotation: -180, duration: 0.7, ease: 'back.out(2.5)' }, '-=0.3')
        .from(
          '.hero .char',
          { y: 30, opacity: 0, rotateX: -60, transformOrigin: '50% 100%', stagger: 0.025, duration: 0.5 },
          '-=0.4'
        )
        .from('.hero p', { y: 12, opacity: 0, duration: 0.5 }, '-=0.3')
        .from('.hero .pill', { scale: 0, opacity: 0, duration: 0.5, ease: 'back.out(3)' }, '<')
        .from('.grid-2 > .card', { x: -50, opacity: 0, duration: 0.7, clearProps: 'opacity,transform' }, '-=0.2')
        .from(
          '.grid-2 > .stack > .card',
          { x: 50, opacity: 0, duration: 0.7, stagger: 0.12, clearProps: 'opacity,transform' },
          '<'
        )
        .from(
          '.grid-2 > .stack > .card:first-child .row',
          { x: 30, opacity: 0, duration: 0.5, stagger: 0.1, clearProps: 'opacity,transform' },
          '-=0.3'
        );

      // Shield halka breathing loop
      gsap.to('.hero .shield', {
        scale: 1.12,
        duration: 1,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
        delay: 1.5,
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  /* ---------- 2. Pending pill: yellow ring pulse jab review pending ho ---------- */
  useEffect(() => {
    const pill = pillRef.current;
    if (!hasPending || !pill || prefersReducedMotion()) return;

    const tween = gsap.fromTo(
      pill,
      { boxShadow: '0 0 0 0 rgba(234, 179, 8, 0.55)' },
      {
        boxShadow: '0 0 0 12px rgba(234, 179, 8, 0)',
        duration: 1.5,
        repeat: -1,
        delay: 1.5,
        ease: 'power2.out',
      }
    );
    return () => {
      tween.kill();
      gsap.set(pill, { clearProps: 'boxShadow' });
    };
  }, [hasPending]);

  /* ---------- 3. Loading text pulse ---------- */
  useEffect(() => {
    if (!loading || !loaderRef.current || prefersReducedMotion()) return;
    const tween = gsap.to(loaderRef.current, {
      opacity: 0.35,
      duration: 0.8,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });
    return () => {
      tween.kill();
    };
  }, [loading]);

  /* ---------- 4. Review queue cards: stagger + risk pill pop + reasoning lines ---------- */
  useLayoutEffect(() => {
    const list = listRef.current;
    if (loading || !list || prefersReducedMotion()) return;
    const items = Array.from(list.children) as HTMLElement[];
    if (items.length === 0) return;

    // Risk score + AI reasoning "decode" hote hain (ScrambleText): jaise engine abhi analyze kar raha ho
    const decoded: { el: Element; text: string }[] = [];
    const ctx = gsap.context(() => {
      const tl = gsap
        .timeline({ defaults: { ease: 'power3.out' }, delay: 0.35 })
        .from(items, { y: 40, opacity: 0, scale: 0.96, duration: 0.6, stagger: 0.12, clearProps: 'opacity,transform' });

      list.querySelectorAll('.pill').forEach((pill, i) => {
        const text = pill.textContent || '';
        decoded.push({ el: pill, text });
        tl.to(
          pill,
          { duration: 1.1, ease: 'none', scrambleText: { text, chars: '0123456789', revealDelay: 0.25, speed: 0.7 } },
          0.15 + i * 0.12
        );
      });

      list.querySelectorAll('li').forEach((li, i) => {
        const text = li.textContent || '';
        decoded.push({ el: li, text });
        tl.to(
          li,
          {
            duration: Math.min(1.4, 0.4 + text.length * 0.015),
            ease: 'none',
            scrambleText: { text, chars: '01', revealDelay: 0.1, speed: 0.9 },
          },
          0.3 + i * 0.07
        );
      });
    }, list);

    return () => {
      ctx.revert();
      decoded.forEach(({ el, text }) => {
        el.textContent = text; // scramble beech mein kata to original text wapas
      });
    };
  }, [loading, queueKey]);

  /* ---------- 4b. Swipe gesture (Draggable): right = approve, left = reject ---------- */
  useEffect(() => {
    const list = listRef.current;
    if (loading || !list || prefersReducedMotion()) return;
    const cards = Array.from(list.children) as HTMLElement[];

    const instances = cards.map((card, idx) => {
      const id = reviewQueue[idx]?.id;
      const threshold = () => card.offsetWidth * 0.4; // card ki 40% chaudai se zyada kheencho

      const [d] = Draggable.create(card, {
        type: 'x',
        dragClickables: false, // buttons normal click hi rahenge
        minimumMovement: 10,
        cursor: 'grab',
        activeCursor: 'grabbing',
        onDrag: () => {
          const p = Math.min(Math.abs(d.x) / threshold(), 1);
          const rgb = d.x > 0 ? '16, 185, 129' : '248, 113, 113';
          gsap.set(card, { rotation: d.x / 18, boxShadow: `0 0 0 ${3 * p}px rgba(${rgb}, ${0.9 * p})` });
        },
        onDragEnd: () => {
          if (id && Math.abs(d.x) >= threshold()) {
            const action = d.x > 0 ? 'approve' : 'reject';
            d.disable();
            handleAction(id, action);
          } else {
            gsap.to(card, {
              x: 0,
              rotation: 0,
              boxShadow: '0 0 0 0 rgba(0, 0, 0, 0)',
              duration: 0.9,
              ease: 'elastic.out(1, 0.55)',
            });
          }
        },
      });
      return d;
    });

    return () => {
      instances.forEach((d) => d.kill());
    };
  }, [loading, queueKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- 5. "All clear!" state: icon pop + confetti (agar queue abhi clear hui ho) ---------- */
  useEffect(() => {
    if (!loading && reviewQueue.length > 0) hadItems.current = true;
  }, [loading, reviewQueue.length]);

  useLayoutEffect(() => {
    const el = emptyRef.current;
    if (!isEmpty || !el) return;

    const celebrate = hadItems.current;
    hadItems.current = false;
    if (prefersReducedMotion()) return;

    const icon = el.children[0] as HTMLElement;
    const rest = [el.children[1], el.children[2]];
    const pieces: HTMLElement[] = [];

    const ctx = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: 'power3.out' }, delay: 0.2 })
        .from(icon, { scale: 0, rotation: -120, duration: 0.8, ease: 'back.out(2.5)' })
        .from(rest, { y: 14, opacity: 0, duration: 0.5, stagger: 0.1, clearProps: 'opacity,transform' }, '-=0.3');
    }, el);

    const call = celebrate ? gsap.delayedCall(0.4, () => burst(icon, pieces)) : null;

    return () => {
      call?.kill();
      ctx.revert();
      pieces.forEach((p) => {
        gsap.killTweensOf(p);
        p.remove();
      });
    };
  }, [isEmpty]);

  /* ---------- 6. Recently Blocked rows ---------- */
  useLayoutEffect(() => {
    const card = blockedRef.current;
    if (loading || !card || prefersReducedMotion()) return;
    const rows = Array.from(card.querySelectorAll('.row')) as HTMLElement[];
    if (rows.length === 0) return;

    const ctx = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: 'power3.out' }, delay: 0.5 })
        .from(rows, { x: 40, opacity: 0, duration: 0.5, stagger: 0.08, clearProps: 'opacity,transform' })
        .from(
          card.querySelectorAll('.pill'),
          { scale: 0, duration: 0.4, ease: 'back.out(3)', stagger: 0.08, clearProps: 'transform' },
          '<0.2'
        );
    }, card);

    return () => ctx.revert();
  }, [loading, blockedKey]);

  return (
    <div className="dashboard-container" ref={rootRef}>
      
      {/* HEADER */}
      <div className="hero" style={{ marginBottom: '24px', borderLeft: '4px solid var(--yellow)' }}>
        <div>
          <h2 aria-label={`🛡${heroTitle}`} style={{ margin: '0 0 8px' }}>
            <span className="shield" aria-hidden="true" style={{ display: 'inline-block' }}>🛡</span>
            {Array.from(heroTitle).map((c, i) => (
              <span
                key={i}
                className="char"
                aria-hidden="true"
                style={{ display: 'inline-block', whiteSpace: 'pre' }}
              >
                {c}
              </span>
            ))}
          </h2>
          <p className="muted" style={{ margin: 0 }}>
            Review transactions flagged by the AI engine for potential fraud or velocity spikes.
          </p>
        </div>
        <div ref={pillRef} className="pill warn" style={{ fontSize: '14px', padding: '8px 16px' }}>
          <CountUp value={reviewQueue.length} />{' '}Pending Reviews
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        
        {/* LEFT: PENDING QUEUE */}
        <div className="card">
          <h2 style={{ marginBottom: '16px' }}>Pending Review Queue</h2>
          
          {loading ? (
            <p className="muted" ref={loaderRef}>Loading queue...</p>
          ) : reviewQueue.length === 0 ? (
            <div className="empty" ref={emptyRef}>
              <div className="empty-icon" style={{ display: 'inline-block' }}>✅</div>
              <p className="empty-title">All clear!</p>
              <p className="muted">No suspicious transactions pending review.</p>
            </div>
          ) : (
            <div className="stack" ref={listRef}>
              {reviewQueue.map(t => (
                <div
                  key={t.id}
                  ref={(el) => { cardRefs.current[t.id] = el; }}
                  onMouseEnter={cardEnter}
                  onMouseLeave={cardLeave}
                  title="Drag right to approve, left to reject"
                  style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', background: 'var(--bg-input)' }}
                >
                  <div className="row between" style={{ marginBottom: '12px' }}>
                    <strong style={{ fontSize: '18px' }}>₹{(t.amount_minor / 100).toLocaleString()}</strong>
                    <span className="pill failed" style={{ fontSize: '12px' }}>Risk Score: {t.risk_score}/100</span>
                  </div>
                  
                  <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
                    <p style={{ margin: '0 0 8px', fontWeight: 700, color: 'var(--text-muted)' }}>AI Reasoning:</p>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text)' }}>
                      {t.risk_reasons?.map((r: string, i: number) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>

                  <div className="row" style={{ gap: '8px' }}>
                    <button
                      className="full"
                      style={{ background: 'var(--primary)', color: '#000' }}
                      onClick={() => handleAction(t.id, 'approve')}
                      onMouseEnter={btnEnter}
                      onMouseLeave={btnLeave}
                      onMouseDown={btnDown}
                      onMouseUp={btnUp}
                    >
                      ✓ Approve Transfer
                    </button>
                    <button
                      className="full secondary"
                      style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
                      onClick={() => handleAction(t.id, 'reject')}
                      onMouseEnter={btnEnter}
                      onMouseLeave={btnLeave}
                      onMouseDown={btnDown}
                      onMouseUp={btnUp}
                    >
                      ✕ Reject & Block
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: AI INSIGHTS & HISTORY */}
        <div className="stack">
          <div className="card">
            <h2>System Insights</h2>
            <p className="muted" style={{ marginTop: '8px' }}>
              The AI engine monitors velocity, transaction amounts, and account behavior.
            </p>
            
            {/* FIXED: Count of transactions currently in REVIEW state */}
            <div className="row between" style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-input)', borderRadius: '8px' }}>
              <span>Pending Reviews</span>
              <strong style={{ color: 'var(--yellow)' }}><CountUp value={reviewQueue.length} /></strong>
            </div>

            {/* FIXED: Count of transactions with high risk score */}
            <div className="row between" style={{ marginTop: '8px', padding: '12px', background: 'var(--bg-input)', borderRadius: '8px' }}>
              <span>High Risk Flags</span>
              <strong style={{ color: 'var(--red)' }}>
                <CountUp value={transfers.filter(t => Number(t.risk_score || 0) >= 40).length} />
              </strong>
            </div>

            {/* FIXED: Count of blocked transactions */}
            <div className="row between" style={{ marginTop: '8px', padding: '12px', background: 'var(--bg-input)', borderRadius: '8px' }}>
              <span>Auto-Blocked</span>
              <strong><CountUp value={blockedHistory.length} /></strong>
            </div>
          </div>

          <div className="card" ref={blockedRef}>
            <h2>Recently Blocked</h2>
            {blockedHistory.length === 0 ? <p className="muted">No blocked history.</p> : (
              blockedHistory.slice(0, 5).map(t => (
                <div key={t.id} className="row between" style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '13px' }}>₹{(t.amount_minor / 100).toLocaleString()}</span>
                  <span className="pill failed">BLOCKED</span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}