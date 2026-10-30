import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import {
  gsap,
  ScrollTrigger,
  SplitText,
  Odometer,
  getScrollParent,
  prefersReducedMotion,
  useSpotlight,
} from '../lib/fx'; // <-- GSAP + plugins
import { apiClient } from '../api/client';
import type { Transfer } from '../api/client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

/* ---------- GSAP helpers ---------- */

// KPI card 3D tilt: mouse ke hisaab se card jhukta hai
const tiltEnter = (e: ReactMouseEvent<HTMLElement>) => {
  if (prefersReducedMotion()) return;
  e.currentTarget.style.transition = 'none'; // CSS transition GSAP ke saath lag karta hai
};

const tiltMove = (e: ReactMouseEvent<HTMLElement>) => {
  if (prefersReducedMotion()) return;
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const px = (e.clientX - r.left) / r.width - 0.5;
  const py = (e.clientY - r.top) / r.height - 0.5;
  gsap.to(el, {
    rotationY: px * 12,
    rotationX: -py * 12,
    y: -6,
    transformPerspective: 900,
    duration: 0.4,
    ease: 'power2.out',
    overwrite: 'auto',
  });
};

const tiltLeave = (e: ReactMouseEvent<HTMLElement>) => {
  if (prefersReducedMotion()) return;
  const el = e.currentTarget;
  gsap.to(el, {
    rotationX: 0,
    rotationY: 0,
    y: 0,
    duration: 0.8,
    ease: 'elastic.out(1, 0.6)',
    overwrite: 'auto',
    onComplete: () => {
      el.style.transition = '';
    },
  });
};

export function AnalyticsDashboard() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);

  // GSAP refs
  const rootRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLParagraphElement>(null);
  const pieWrapRef = useRef<HTMLDivElement>(null);
  const spot1 = useSpotlight<HTMLDivElement>();
  const spot2 = useSpotlight<HTMLDivElement>();
  const spot3 = useSpotlight<HTMLDivElement>();

  useEffect(() => {
    apiClient.listTransfers()
      .then(data => setTransfers(data))
      .finally(() => setLoading(false));
  }, []);

  // 1. Calculate Real Metrics
  const totalVolume = transfers.reduce((acc, curr) => acc + Number(curr.amount_minor), 0) / 100;
  const settledCount = transfers.filter(t => t.status === 'SETTLED').length;
  const reviewCount = transfers.filter(t => t.status === 'REVIEW').length;
  const failedCount = transfers.filter(t => t.status === 'FAILED').length;
  
  const totalTransactions = transfers.length || 1; // Prevent divide by zero
  const successRate = ((settledCount / totalTransactions) * 100).toFixed(1);

  // 2. Prepare Pie Chart Data
  const pieData = [
    { name: 'Settled', value: settledCount },
    { name: 'Review', value: reviewCount },
    { name: 'Failed', value: failedCount },
  ];
  const COLORS = ['#10b981', '#fbbf24', '#f87171'];

  // 3. Prepare Trend Data (Reverse to show chronological order)
  const trendData = [...transfers]
    .reverse()
    .slice(-15) // Last 15 transactions for clean graph
    .map((t, i) => ({
      name: `TX ${i + 1}`,
      amount: Number(t.amount_minor) / 100,
    }));

  /* ---------- Loading text: halka breathing pulse ---------- */
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

  /* ---------- Main entrance ---------- */
  // Title: SplitText mask reveal | KPI: clip-path wipe + Odometer | Charts: ScrollTrigger se reveal
  useLayoutEffect(() => {
    if (loading) return;
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) return;

    const [header, kpiGrid, chartGrid] = Array.from(root.children) as HTMLElement[];
    const titleBlock = header.children[0] as HTMLElement;
    const titleEl = titleBlock.children[0] as HTMLElement;
    const sub = titleBlock.children[1];
    const pill = header.children[1] as HTMLElement;
    const kpiCards = Array.from(kpiGrid.children) as HTMLElement[];
    const [areaCard, pieCard] = Array.from(chartGrid.children) as HTMLElement[];
    const areaWrap = areaCard.children[1] as HTMLElement;
    const pieWrap = pieWrapRef.current;
    const scroller = getScrollParent(root);

    let split: ReturnType<typeof SplitText.create> | undefined;

    const ctx = gsap.context(() => {
      split = SplitText.create(titleEl, { type: 'chars', mask: 'chars' });

      gsap
        .timeline({ defaults: { ease: 'power4.out' } })
        .from(split.chars, { yPercent: 120, duration: 0.9, stagger: 0.025 })
        .from(sub, { y: 16, opacity: 0, duration: 0.6 }, '-=0.5')
        .from(pill, { scale: 0, opacity: 0, duration: 0.6, ease: 'back.out(3)' }, '<')
        .fromTo(
          kpiCards,
          { clipPath: 'inset(100% 0% 0% 0%)', y: 30 },
          {
            clipPath: 'inset(0% 0% 0% 0%)',
            y: 0,
            duration: 0.9,
            stagger: 0.15,
            clearProps: 'clipPath,transform',
          },
          '-=0.3'
        );

      // Charts: viewport mein aate hi reveal (Area: left->right wipe, Pie: circular reveal + spin)
      const reveals: gsap.core.Tween[] = [];

      reveals.push(
        gsap.fromTo(
          areaWrap,
          { clipPath: 'inset(0% 100% 0% 0%)' },
          { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.6, ease: 'power2.inOut', paused: true, clearProps: 'clipPath' }
        )
      );
      if (pieWrap) {
        reveals.push(
          gsap.fromTo(
            pieWrap,
            { clipPath: 'circle(0% at 50% 50%)', rotation: -120, scale: 0.85 },
            {
              clipPath: 'circle(75% at 50% 50%)',
              rotation: 0,
              scale: 1,
              duration: 1.4,
              ease: 'power3.out',
              paused: true,
              clearProps: 'clipPath,transform',
            }
          )
        );
      }

      [areaCard, pieCard].forEach((trigger, i) => {
        const tween = reveals[i];
        if (!tween) return;
        ScrollTrigger.create({
          trigger,
          scroller,
          start: 'top 92%',
          once: true,
          onEnter: () => tween.play(),
        });
        // Safety: kisi wajah se trigger na chale to bhi chart dikhe
        gsap.delayedCall(6, () => tween.play());
      });

      ScrollTrigger.refresh();

      // "Live Data Connected" pill ke around green ring pulse (idle loop)
      gsap.fromTo(
        pill,
        { boxShadow: '0 0 0 0 rgba(16, 185, 129, 0.55)' },
        {
          boxShadow: '0 0 0 12px rgba(16, 185, 129, 0)',
          duration: 1.6,
          repeat: -1,
          delay: 1.2,
          ease: 'power2.out',
        }
      );
    }, root);

    return () => {
      ctx.revert();
      split?.revert();
    };
  }, [loading]);

  if (loading) {
    return <div className="dashboard-container"><p className="muted" ref={loaderRef}>Loading analytics data...</p></div>;
  }

  return (
    <div className="dashboard-container fade-in" ref={rootRef} style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '32px 20px', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Header Section */}
      <div className="row between" style={{ alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '-0.03em', margin: '0 0 4px 0' }}>
            Financial Analytics
          </h2>
          <p className="muted">Real-time ledger metrics, volume trends, and system health.</p>
        </div>
        <span className="pill settled" style={{ padding: '6px 14px' }}>
          ● Live Data Connected
        </span>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
        <div
          ref={spot1}
          className="card"
          onMouseEnter={tiltEnter}
          onMouseMove={tiltMove}
          onMouseLeave={tiltLeave}
          style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
        >
          <p className="muted" style={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: '800', letterSpacing: '0.05em' }}>
            Total Transaction Volume
          </p>
          <h2 style={{ fontSize: '32px', fontWeight: '800', margin: 0, color: 'var(--primary)', fontVariantNumeric: 'tabular-nums' }}>
            <Odometer text={`₹${totalVolume.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} delay={0.9} />
          </h2>
          <span className="muted" style={{ fontSize: '12px' }}>Across all ledger accounts</span>
        </div>

        <div
          ref={spot2}
          className="card"
          onMouseEnter={tiltEnter}
          onMouseMove={tiltMove}
          onMouseLeave={tiltLeave}
          style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
        >
          <p className="muted" style={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: '800', letterSpacing: '0.05em' }}>
            Successful Transfers
          </p>
          <h2 style={{ fontSize: '32px', fontWeight: '800', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
            <Odometer text={String(settledCount)} delay={1.05} />{' '}
            <span style={{ fontSize: '16px', color: 'var(--primary)' }}>
              (<Odometer text={successRate} delay={1.2} />%)
            </span>
          </h2>
          <span className="muted" style={{ fontSize: '12px' }}>Fully cleared double-entry logs</span>
        </div>

        <div
          ref={spot3}
          className="card"
          onMouseEnter={tiltEnter}
          onMouseMove={tiltMove}
          onMouseLeave={tiltLeave}
          style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
        >
          <p className="muted" style={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: '800', letterSpacing: '0.05em' }}>
            Flagged / Failed
          </p>
          <h2 style={{ fontSize: '32px', fontWeight: '800', margin: 0, color: 'var(--red)', fontVariantNumeric: 'tabular-nums' }}>
            <Odometer text={String(reviewCount + failedCount)} delay={1.35} />
          </h2>
          <span className="muted" style={{ fontSize: '12px' }}>Requires administrative review</span>
        </div>
      </div>

      {/* Charts Section Grid */}
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.6fr', gap: '20px' }}>
        
        {/* Area Chart: Volume Trend */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="row between">
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>Transfer Volume Trend</h3>
              <p className="muted" style={{ fontSize: '12px' }}>Monetary flow across recent ledger entries</p>
            </div>
            <span className="pill">INR (₹)</span>
          </div>

          <div style={{ height: '280px', width: '100%' }}>
            {trendData.length === 0 ? (
               <p className="muted">No transfer data available.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow)' }}
                    itemStyle={{ color: 'var(--text)', fontWeight: 600 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="var(--primary)"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorAmt)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Pie Chart: System Health Status */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>System Health Status</h3>
            <p className="muted" style={{ fontSize: '12px' }}>Success vs Flagged transaction ratio</p>
          </div>

          <div ref={pieWrapRef} style={{ height: '280px', width: '100%', position: 'relative' }}>
             {settledCount === 0 && reviewCount === 0 && failedCount === 0 ? (
               <p className="muted">No data.</p>
             ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={pieData.filter(d => d.value > 0)} // Only show non-zero values
                    innerRadius={70} 
                    outerRadius={100} 
                    paddingAngle={8} 
                    dataKey="value"
                    isAnimationActive={false}
                  >
                    {pieData.filter(d => d.value > 0).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[pieData.findIndex(p => p.name === entry.name) % COLORS.length]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }} 
                  />
                </PieChart>
              </ResponsiveContainer>
             )}
          </div>
        </div>

      </div>
    </div>
  );
}