
import { useCallback, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Draggable } from 'gsap/Draggable';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { SplitText } from 'gsap/SplitText';
 
// Saare plugins ek hi jagah register (GSAP 3.13+ mein sab free hain)
gsap.registerPlugin(Flip, ScrollTrigger, Draggable, MotionPathPlugin, ScrambleTextPlugin, DrawSVGPlugin, SplitText);
 
export { gsap, Flip, ScrollTrigger, Draggable, SplitText };
 
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 
/* ------------------------------------------------------------------ */
/* Magnetic: element cursor ki taraf khichta hai, chhodne par elastic wapas  */
/* Usage: const mag = useMagnetic<HTMLButtonElement>(0.3);  <button ref={mag} /> */
/* ------------------------------------------------------------------ */
export function useMagnetic<T extends HTMLElement>(strength = 0.35) {
  const cleanup = useRef<(() => void) | null>(null);
 
  return useCallback(
    (el: T | null) => {
      cleanup.current?.();
      cleanup.current = null;
      if (!el || prefersReducedMotion()) return;
 
      const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.5)' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.5)' });
 
      const move = (e: MouseEvent) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * strength);
        yTo((e.clientY - (r.top + r.height / 2)) * strength);
      };
      const leave = () => {
        xTo(0);
        yTo(0);
      };
 
      el.addEventListener('mousemove', move);
      el.addEventListener('mouseleave', leave);
      cleanup.current = () => {
        el.removeEventListener('mousemove', move);
        el.removeEventListener('mouseleave', leave);
        gsap.set(el, { x: 0, y: 0 });
      };
    },
    [strength]
  );
}
 
/* ------------------------------------------------------------------ */
/* Spotlight: card ke andar cursor ke peeche chalne wali glow            */
/* Usage: const spot = useSpotlight<HTMLDivElement>();  <div ref={spot} /> */
/* ------------------------------------------------------------------ */
export function useSpotlight<T extends HTMLElement>() {
  const cleanup = useRef<(() => void) | null>(null);
 
  return useCallback((el: T | null) => {
    cleanup.current?.();
    cleanup.current = null;
    if (!el || prefersReducedMotion()) return;
 
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
 
    const spot = document.createElement('div');
    spot.setAttribute('aria-hidden', 'true');
    Object.assign(spot.style, {
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
      borderRadius: 'inherit',
      opacity: '0',
      background:
        'radial-gradient(260px circle at var(--mx, 50%) var(--my, 50%), color-mix(in srgb, var(--primary) 24%, transparent), transparent 65%)',
    });
    el.appendChild(spot);
 
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      spot.style.setProperty('--mx', `${e.clientX - r.left}px`);
      spot.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    const enter = () => gsap.to(spot, { opacity: 1, duration: 0.3, overwrite: 'auto' });
    const leave = () => gsap.to(spot, { opacity: 0, duration: 0.4, overwrite: 'auto' });
 
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointerleave', leave);
    cleanup.current = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerenter', enter);
      el.removeEventListener('pointerleave', leave);
      gsap.killTweensOf(spot);
      spot.remove();
    };
  }, []);
}
 
/* ------------------------------------------------------------------ */
/* ScrollTrigger ke liye sahi scroller dhoondhta hai (window ya parent container) */
/* ------------------------------------------------------------------ */
export function getScrollParent(el: HTMLElement | null): HTMLElement | Window {
  let node = el?.parentElement ?? null;
  while (node) {
    const oy = getComputedStyle(node).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return window;
}
 
/* ------------------------------------------------------------------ */
/* Odometer: har digit apne reel pe ghoom ke final number par rukta hai    */
/* Usage: <Odometer text="₹1,24,500.00" delay={1} />                    */
/* ------------------------------------------------------------------ */
export function Odometer({ text, duration = 1.8, delay = 0 }: { text: string; duration?: number; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
 
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
 
    root.textContent = '';
    root.setAttribute('role', 'img');
    root.setAttribute('aria-label', text);
    root.style.display = 'inline-flex';
    root.style.whiteSpace = 'pre';
 
    const cols: HTMLElement[] = [];
    const digits: number[] = [];
 
    Array.from(text).forEach((ch) => {
      if (/\d/.test(ch)) {
        const wrap = document.createElement('span');
        wrap.setAttribute('aria-hidden', 'true');
        Object.assign(wrap.style, {
          display: 'inline-block',
          height: '1.2em',
          lineHeight: '1.2em',
          overflow: 'hidden',
          verticalAlign: 'bottom',
        });
 
        const col = document.createElement('span');
        col.style.display = 'block';
        col.style.willChange = 'transform';
        let html = '';
        for (let r = 0; r < 3; r++) {
          for (let d = 0; d < 10; d++) html += `<span style="display:block;height:1.2em">${d}</span>`;
        }
        col.innerHTML = html;
 
        wrap.appendChild(col);
        root.appendChild(wrap);
        cols.push(col);
        digits.push(Number(ch));
      } else {
        const s = document.createElement('span');
        s.setAttribute('aria-hidden', 'true');
        s.style.whiteSpace = 'pre';
        s.style.lineHeight = '1.2em';
        s.textContent = ch;
        root.appendChild(s);
      }
    });
 
    // 30 items ka reel: teesre set (index 20-29) par rukte hain => do poore chakkar ghoomte hain
    const finalY = (i: number) => -(((20 + digits[i]) / 30) * 100);
 
    if (prefersReducedMotion()) {
      cols.forEach((c, i) => gsap.set(c, { yPercent: finalY(i) }));
      return;
    }
 
    const tween = gsap.fromTo(
      cols,
      { yPercent: 0 },
      {
        yPercent: (i: number) => finalY(i),
        duration,
        delay,
        ease: 'power4.out',
        stagger: { each: 0.09, from: 'end' },
      }
    );
 
    return () => {
      tween.kill();
    };
  }, [text, duration, delay]);
 
  return <span ref={ref}></span>;
}
 
