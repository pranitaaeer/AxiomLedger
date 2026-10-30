import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { gsap, Flip, prefersReducedMotion, useMagnetic } from '../lib/fx'; // <-- GSAP + plugins
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';

type Account = {
  id: string;
  type: string;
  currency: string;
  balance_minor: number;
};

/* ---------- GSAP helpers ---------- */
// CSS transition aur GSAP ek saath transform pe chalte hain to animation lag karti hai.
// Isliye animation ke dauraan transition off karke baad mein original wapas set karte hain.
const withoutTransition = (els: HTMLElement[]) => {
  const saved = els.map((el) => el.style.transition);
  els.forEach((el) => (el.style.transition = 'none'));
  return () => els.forEach((el, i) => (el.style.transition = saved[i]));
};

const hoverTo = (el: HTMLElement, vars: gsap.TweenVars) => {
  if (prefersReducedMotion() || (el as HTMLButtonElement).disabled) return;
  gsap.to(el, { duration: 0.25, ease: 'power2.out', overwrite: 'auto', ...vars });
};

const pulse = (el: HTMLElement) => {
  if (prefersReducedMotion()) return;
  gsap.fromTo(el, { scale: 0.97 }, { scale: 1, duration: 0.45, ease: 'back.out(3)', overwrite: 'auto' });
};

// Paisa udta hai: source wallet se form card tak curved path par (MotionPath), peeche trail ke saath
const flyCoin = (from: Element, to: Element) =>
  new Promise<void>((resolve) => {
    if (prefersReducedMotion()) return resolve();

    const a = from.getBoundingClientRect();
    const b = to.getBoundingClientRect();
    const sx = a.left + a.width / 2;
    const sy = a.top + a.height / 2;
    const dx = b.left + b.width / 2 - sx;
    const dy = b.top + b.height / 2 - sy;

    const nodes: HTMLElement[] = [];
    const make = (size: number, opacity: number) => {
      const c = document.createElement('div');
      Object.assign(c.style, {
        position: 'fixed',
        left: `${sx - size / 2}px`,
        top: `${sy - size / 2}px`,
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        pointerEvents: 'none',
        zIndex: '9999',
        opacity: String(opacity),
        background: 'radial-gradient(circle at 30% 30%, #fde68a, #f59e0b)',
        boxShadow: '0 0 18px rgba(245, 158, 11, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: '800',
        fontSize: `${size * 0.5}px`,
        color: '#7c2d12',
      });
      document.body.appendChild(c);
      nodes.push(c);
      return c;
    };

    const path = [{ x: 0, y: 0 }, { x: dx * 0.35, y: Math.min(dy, 0) - 150 }, { x: dx, y: dy }];

    // Trail: chhote ghost circles thodi der baad usi path par
    for (let i = 1; i <= 7; i++) {
      const ghost = make(26 - i * 2.5, 0.55 - i * 0.06);
      gsap.to(ghost, { motionPath: { path, curviness: 1.5 }, duration: 0.9, delay: i * 0.04, ease: 'power2.inOut' });
    }

    const coin = make(44, 1);
    coin.textContent = '₹';

    gsap
      .timeline({
        onComplete: () => {
          // Landing: card halka dab ke wapas uchhalta hai
          gsap.fromTo(to, { scale: 0.985 }, { scale: 1, duration: 0.7, ease: 'elastic.out(1, 0.4)', clearProps: 'transform' });
          nodes.forEach((n) => n.remove());
          resolve();
        },
      })
      .to(coin, { motionPath: { path, curviness: 1.5 }, duration: 0.9, ease: 'power2.inOut' }, 0)
      .to(coin, { rotationY: 720, duration: 0.9, ease: 'none' }, 0)
      .to(coin, { scale: 0.4, opacity: 0, duration: 0.2, ease: 'power2.in' }, 0.75);
  });

// Success par confetti burst
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

export function SendMoney() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [walletSearch, setWalletSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 3;

  const [fromAccountId, setFrom] = useState('');
  const [toAccountId, setTo] = useState('');
  const [amount, setAmount] = useState(250000);
  const [currency, setCurrency] = useState('INR');
  const [idempotencyKey, setKey] = useState(() => `web-${Date.now()}`);
  
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any>(null);
  
  const navigate = useNavigate();

  // GSAP refs
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLElement>(null);
  const prevPage = useRef(1);
  const formCardRef = useRef<HTMLDivElement>(null);
  const flipState = useRef<ReturnType<typeof Flip.getState> | null>(null);
  const magSubmit = useMagnetic<HTMLButtonElement>(0.25);

  // Wallet list ka current layout capture (Flip): state badalne se pehle call hota hai
  const captureList = () => {
    if (listRef.current && !prefersReducedMotion()) {
      flipState.current = Flip.getState(Array.from(listRef.current.children));
    }
  };

  // 1. Fetch REAL Accounts from DB
  useEffect(() => {
  fetch('https://axiomledger.onrender.com/accounts')
    .then(async (res) => {
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP Error ${res.status}: ${errorText.substring(0, 100)}...`);
      }
      return res.json();
    })
    .then(data => {
      if (Array.isArray(data) && data.length > 0) {
        setAccounts(data);
        setFrom(data[0].id);
        setTo(data.length > 1 ? data[1].id : data[0].id);
      } else {
        console.warn("⚠️ empty arr:", data);
      }
    })
    .catch((err) => {
      // 2. Ye line console mein exact error print karegi
      console.error("❌ Exact API Error:", err.message);
    });
}, []);
  const filteredAccounts = accounts.filter(a => 
    a.id.toLowerCase().includes(walletSearch.toLowerCase()) || 
    a.type.toLowerCase().includes(walletSearch.toLowerCase())
  );

  const totalPages = Math.ceil(filteredAccounts.length / pageSize) || 1;
  const paginatedAccounts = filteredAccounts.slice((page - 1) * pageSize, page * pageSize);

  const showForm = !successData;
  const listKey = paginatedAccounts.map((a) => a.id).join(',');

  /* ---------- 1. Page load: left cards + right form card ---------- */
  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: 'power3.out' } })
        .from('.grid-2 > .stack > .card', { y: 40, opacity: 0, duration: 0.7, stagger: 0.12 })
        .from('.grid-2 > .card', { x: 60, opacity: 0, duration: 0.8 }, '-=0.6');
    }, rootRef);

    return () => ctx.revert();
  }, []);

  /* ---------- 2. Wallet list: load / search / pagination par stagger entry ---------- */
  useLayoutEffect(() => {
    const items = listRef.current ? (Array.from(listRef.current.children) as HTMLElement[]) : [];
    // page aage gaya to right se, peeche gaya to left se, search par neeche se
    const dir = page === prevPage.current ? 0 : page > prevPage.current ? 1 : -1;
    prevPage.current = page;
    if (items.length === 0 || prefersReducedMotion()) return;

    const restore = withoutTransition(items);

    // Search/pagination: Flip se cards apni purani jagah se nayi jagah smoothly udte hain,
    // naye cards direction ke hisaab se andar aate hain
    const state = flipState.current;
    flipState.current = null;
    if (state) {
      const flipCtx = gsap.context(() => {
        Flip.from(state, {
          duration: 0.7,
          ease: 'power3.inOut',
          stagger: 0.05,
          absolute: true,
          onEnter: (els) =>
            gsap.fromTo(
              els,
              { opacity: 0, x: dir * 50, y: dir === 0 ? 24 : 0, scale: 0.9 },
              { opacity: 1, x: 0, y: 0, scale: 1, duration: 0.6, stagger: 0.08, ease: 'back.out(1.6)', clearProps: 'opacity,transform' }
            ),
        });
      }, listRef);
      return () => {
        flipCtx.revert();
        restore();
      };
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        items,
        { opacity: 0, x: dir * 30, y: dir === 0 ? 16 : 0 },
        {
          opacity: 1,
          x: 0,
          y: 0,
          duration: 0.45,
          stagger: 0.07,
          ease: 'power3.out',
          clearProps: 'opacity,transform',
          onComplete: restore,
        }
      );
    }, listRef);

    return () => {
      ctx.revert();
      restore();
    };
  }, [listKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- 3. Transfer form: fields stagger (first load + "Make Another Transfer") ---------- */
  useLayoutEffect(() => {
    if (!showForm || prefersReducedMotion()) return;
    const header = headerRef.current;
    const form = formRef.current;
    if (!header || !form) return;

    const targets = [header, ...Array.from(form.children)] as HTMLElement[];
    const restore = withoutTransition(targets);
    const ctx = gsap.context(() => {
      gsap.from(targets, {
        y: 24,
        opacity: 0,
        duration: 0.55,
        stagger: 0.07,
        delay: 0.3,
        ease: 'power3.out',
        clearProps: 'opacity,transform',
        onComplete: restore,
      });
    }, rootRef);

    return () => {
      ctx.revert();
      restore();
    };
  }, [showForm]);

  /* ---------- 4. Error alert: slide-in + shake ---------- */
  useLayoutEffect(() => {
    const el = errorRef.current;
    if (!error || !el || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      gsap
        .timeline({ onComplete: () => gsap.set(el, { clearProps: 'opacity,transform' }) })
        .fromTo(el, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' })
        .to(el, {
          keyframes: { x: [0, -10, 10, -8, 8, -4, 4, 0], easeEach: 'power1.inOut' },
          duration: 0.5,
        });
    }, rootRef);

    return () => ctx.revert();
  }, [error]);

  /* ---------- 5. Success screen: emoji pop, confetti, rows stagger, amount count-up ---------- */
  useLayoutEffect(() => {
    if (!successData) return;

    const amountEl = amountRef.current;
    const target = Number(successData.amount_minor) / 100;
    const fmt = (n: number) => `₹${n.toFixed(2)}`;
    if (amountEl) amountEl.textContent = fmt(target);

    const root = successRef.current;
    if (!root || prefersReducedMotion()) return;

    const [hero, details, btns] = Array.from(root.children) as HTMLElement[];
    const emoji = hero.children[0] as HTMLElement;
    const heading = [hero.children[1], hero.children[2]];
    const rows = Array.from(details.children) as HTMLElement[];
    const buttons = Array.from(btns.children) as HTMLElement[];
    const isReview = successData.status === 'REVIEW';

    const restore = withoutTransition([...rows, ...buttons]);
    const pieces: HTMLElement[] = [];
    const counter = { val: 0 };
    if (amountEl) amountEl.textContent = fmt(0);

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' }, onComplete: restore });

      if (isReview) {
        tl.from(emoji, { scale: 0, rotation: -180, duration: 0.8, ease: 'back.out(2.5)' }, 0);
      } else {
        // Success: ring + tick apne aap draw hote hain (DrawSVG)
        tl.from(emoji.querySelector('.chk-ring'), { drawSVG: '0%', duration: 0.8, ease: 'power2.inOut' }, 0)
          .from(emoji.querySelector('.chk-tick'), { drawSVG: '0%', duration: 0.45, ease: 'power2.out' }, 0.65)
          .fromTo(emoji, { scale: 0.85 }, { scale: 1, duration: 0.8, ease: 'elastic.out(1, 0.4)' }, 0.7);
      }
      tl
        .from(heading, { y: 20, opacity: 0, duration: 0.5, stagger: 0.1, clearProps: 'opacity,transform' }, 0.4)
        .from(details, { y: 30, opacity: 0, duration: 0.5, clearProps: 'opacity,transform' }, 0.6)
        .from(rows, { x: -20, opacity: 0, duration: 0.4, stagger: 0.08, clearProps: 'opacity,transform' }, 0.7)
        .from(buttons, { y: 20, opacity: 0, duration: 0.4, stagger: 0.1, clearProps: 'opacity,transform' }, 1.0)
        .to(
          counter,
          {
            val: target,
            duration: 1.1,
            ease: 'power2.out',
            onUpdate: () => {
              if (amountEl) amountEl.textContent = fmt(counter.val);
            },
          },
          0.7
        );

      // REVIEW hone par emoji halka hil jaata hai (attention)
      if (isReview) {
        tl.to(
          emoji,
          { keyframes: { rotation: [0, -14, 14, -10, 10, 0], easeEach: 'sine.inOut' }, duration: 0.7 },
          0.8
        );
      }
    }, root);

    // Confetti sirf successful transfer par
    const call = isReview ? null : gsap.delayedCall(0.35, () => burst(emoji, pieces));

    return () => {
      call?.kill();
      ctx.revert();
      restore();
      pieces.forEach((p) => {
        gsap.killTweensOf(p);
        p.remove();
      });
    };
  }, [successData]);

  // 2. REAL API CALL for Transfer
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccessData(null);
    
    if (fromAccountId === toAccountId) {
      setError('Source and destination accounts cannot be the same.');
      setBusy(false);
      return;
    }

    try {
      const res = await apiClient.createTransfer({
        fromAccountId,
        toAccountId,
        amountMinor: amount,
        currency,
        idempotencyKey
      });

      // Coin selected wallet se form card tak udta hai, phir success screen aati hai
      const sourceEl =
        listRef.current?.querySelector(`[data-flip-id="${fromAccountId}"]`) ?? listRef.current;
      if (sourceEl && formCardRef.current) await flyCoin(sourceEl, formCardRef.current);

      setSuccessData(res);
      setKey(`web-${Date.now()}`);
      
      // Refresh balance badge & dashboard
      window.dispatchEvent(new Event('refresh-data'));
      
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err.message);
    } finally {
      setBusy(false);
    }
  }

  const formatBalance = (bal: number | string, curr: string) => {
    const num = Number(bal);
    return `${curr === 'INR' ? '₹' : '$'}${Math.abs(num / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="dashboard-container fade-in" ref={rootRef} style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 20px' }}>
      
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '24px', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: Searchable & Paginated Wallets List */}
        <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ background: 'radial-gradient(circle at top right, var(--accent-bg), transparent 70%), var(--bg-card)' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
              Send Money
            </h2>
            <p className="muted" style={{ margin: 0, fontSize: '14px', lineHeight: '1.5' }}>
              Execute secure ledger transfers instantly with automated double-entry verification.
            </p>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="row between">
              <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>Active Source Wallets</h3>
              <span className="pill">{filteredAccounts.length} total</span>
            </div>

            <input 
              type="text" 
              placeholder="Search wallets by ID or type..." 
              value={walletSearch}
              onChange={(e) => { captureList(); setWalletSearch(e.target.value); setPage(1); }}
              style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: '13px' }}
            />
            
            <div ref={listRef} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '210px' }}>
              {paginatedAccounts.length === 0 ? (
                <p className="muted" style={{ textAlign: 'center', padding: '24px 0' }}>
                  {accounts.length === 0 ? 'Loading real accounts from DB...' : 'No matching accounts found.'}
                </p>
              ) : (
                paginatedAccounts.map(acc => {
                  const isSelected = fromAccountId === acc.id;
                  return (
                    <div 
                      key={acc.id} 
                      data-flip-id={acc.id}
                      onClick={(e) => { setFrom(acc.id); pulse(e.currentTarget); }}
                      onMouseEnter={(e) => hoverTo(e.currentTarget, { y: -3 })}
                      onMouseLeave={(e) => hoverTo(e.currentTarget, { y: 0 })}
                      style={{ 
                        padding: '12px 14px', 
                        border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`, 
                        borderRadius: '12px', 
                        background: isSelected ? 'var(--accent-bg)' : 'var(--bg-input)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s ease, background 0.2s ease'
                      }}
                    >
                      <div className="row between" style={{ alignItems: 'center' }}>
                        <span className="pill settled" style={{ fontSize: '10px' }}>{acc.type}</span>
                        <strong style={{ fontSize: '14px', fontVariantNumeric: 'tabular-nums', color: Number(acc.balance_minor) < 0 ? 'var(--red)' : 'var(--text)' }}>
                          {formatBalance(acc.balance_minor, acc.currency)}
                        </strong>
                      </div>
                      <div className="muted" style={{ fontSize: '11px', fontFamily: 'monospace' }}>
                        {acc.id}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {totalPages > 1 && (
              <div className="row between" style={{ alignItems: 'center', marginTop: '4px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                <button type="button" className="secondary btn-small" disabled={page === 1} onClick={() => { captureList(); setPage(p => Math.max(p - 1, 1)); }} style={{ opacity: page === 1 ? 0.4 : 1 }}>
                  Previous
                </button>
                <span className="muted" style={{ fontSize: '12px' }}>Page {page} of {totalPages}</span>
                <button type="button" className="secondary btn-small" disabled={page === totalPages} onClick={() => { captureList(); setPage(p => Math.min(p + 1, totalPages)); }} style={{ opacity: page === totalPages ? 0.4 : 1 }}>
                  Next
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Real Transfer Form */}
        <div className="card" ref={formCardRef} style={{ padding: '32px' }}>
          {!successData ? (
            <>
              <div ref={headerRef} style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 4px' }}>Initiate Transfer</h2>
                <p className="muted" style={{ fontSize: '13px', margin: 0 }}>Fill out transaction parameters</p>
              </div>

              <form ref={formRef} onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: '600' }}>
                  From Account
                  <select value={fromAccountId} onChange={e => setFrom(e.target.value)} required style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: '14px' }}>
                    <option value="" disabled>Select Source</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.type} — {a.id.slice(0, 12)}...</option>
                    ))}
                  </select>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: '600' }}>
                  To Account
                  <select value={toAccountId} onChange={e => setTo(e.target.value)} required style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: '14px' }}>
                    <option value="" disabled>Select Destination</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.type} — {a.id.slice(0, 12)}...</option>
                    ))}
                  </select>
                </label>
                
                <div className="row" style={{ display: 'flex', gap: '12px' }}>
                  <label style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: '600' }}>
                    Amount (Minor Units)
                    <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} min={1} required style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: '14px' }} />
                  </label>
                  <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: '600' }}>
                    Currency
                    <input value={currency} onChange={e => setCurrency(e.target.value)} required style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: '14px' }} />
                  </label>
                </div>
                
                <div style={{ padding: '14px', background: 'var(--bg-input)', borderRadius: '12px', border: '1px dashed var(--border-strong)' }}>
                  <p className="muted" style={{ fontSize: '11px', margin: '0 0 6px', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em' }}>
                    Idempotency Key (Prevents duplicates)
                  </p>
                  <input value={idempotencyKey} onChange={e => setKey(e.target.value)} required style={{ fontFamily: 'monospace', fontSize: '12px', padding: '4px 0', border: 'none', background: 'transparent', width: '100%', color: 'var(--text)', outline: 'none' }} />
                </div>

                {error && <div ref={errorRef} className="alert-error" style={{ fontSize: '13px', padding: '10px 14px', borderRadius: '8px' }}>{error}</div>}

                <button
                  ref={magSubmit}
                  type="submit"
                  disabled={busy}
                  onMouseEnter={(e) => hoverTo(e.currentTarget, { scale: 1.03 })}
                  onMouseLeave={(e) => hoverTo(e.currentTarget, { scale: 1 })}
                  onMouseDown={(e) => hoverTo(e.currentTarget, { scale: 0.97, duration: 0.1 })}
                  onMouseUp={(e) => hoverTo(e.currentTarget, { scale: 1.03, duration: 0.15 })}
                  style={{ marginTop: '8px', height: '48px', fontSize: '15px', fontWeight: '700', background: 'var(--primary)', color: 'var(--primary-text)', borderRadius: '10px', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s ease, box-shadow 0.2s ease' }}
                >
                  {busy ? 'Processing Secure Transfer...' : 'Send Transfer →'}
                </button>
              </form>
            </>
          ) : (
            <div ref={successRef} className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>
                  {successData.status === 'REVIEW' ? (
                    '⚠️'
                  ) : (
                    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-label="Success" role="img" style={{ display: 'inline-block' }}>
                      <circle className="chk-ring" cx="32" cy="32" r="28" stroke="#34d399" strokeWidth="4" strokeLinecap="round" transform="rotate(-90 32 32)" />
                      <path className="chk-tick" d="M19 33 L28 42 L45 23" stroke="#34d399" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <h2 style={{ color: successData.status === 'REVIEW' ? '#fbbf24' : '#34d399', fontSize: '22px', fontWeight: '800', margin: '0 0 6px' }}>
                  {successData.status === 'REVIEW' ? 'Flagged for Compliance Review' : 'Transfer Successful'}
                </h2>
                <p className="muted" style={{ fontSize: '13px', lineHeight: '1.5', maxWidth: '340px', margin: '0 auto' }}>
                  {successData.status === 'REVIEW' 
                    ? 'This transaction triggered risk thresholds and requires administrative review.' 
                    : 'Funds have been successfully cleared and posted to the double-entry ledger.'}
                </p>
              </div>

              <div style={{ padding: '18px', background: 'var(--bg-input)', borderRadius: '14px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
                <div className="row between">
                  <span className="muted">Transferred Amount</span>
                  {/* Text count-up GSAP se set hota hai (final value: ₹amount.toFixed(2)) */}
                  <strong ref={amountRef} style={{ fontSize: '16px' }}></strong>
                </div>
                <div className="row between">
                  <span className="muted">Ledger Status</span>
                  <span className={`pill ${successData.status.toLowerCase()}`}>{successData.status}</span>
                </div>
                <div className="row between">
                  <span className="muted">Transaction Ref</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{successData.id.split('-')[0]}</span>
                </div>
                {successData.risk_score > 0 && (
                  <div className="row between">
                    <span className="muted">AI Risk Score</span>
                    <span style={{ color: 'var(--red)', fontWeight: 'bold' }}>{successData.risk_score} / 100</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                <button type="button" className="secondary" style={{ height: '44px', borderRadius: '10px', fontWeight: '600' }} onClick={() => setSuccessData(null)}>
                  Make Another Transfer
                </button>
                <button type="button" style={{ height: '44px', borderRadius: '10px', fontWeight: '600', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer' }} onClick={() => navigate('/dashboard')}>
                  Back to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}