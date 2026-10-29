import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import "../../styles/auth/LoginPage.scss";

const LoginPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Force Dark Mode
    document.documentElement.setAttribute('data-theme', 'dark');

    const ctx = gsap.context(() => {
      // 1. Background Coins Animation
      gsap.to(".floating-coin", {
        y: "random(-40, 40)",
        x: "random(-30, 30)",
        rotation: "random(-20, 20)",
        duration: "random(4, 8)",
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        stagger: { each: 0.2, from: "random" },
      });

      // 2. Card Entrance
      gsap.from(cardRef.current, {
        y: 100,
        opacity: 0,
        scale: 0.9,
        duration: 1.2,
        ease: "power4.out",
      });

      // 3. Form Items Stagger
      gsap.from(".form-item", {
        y: 30,
        opacity: 0,
        duration: 0.8,
        stagger: 0.1,
        delay: 0.4,
        ease: "power3.out",
      });

      // 4. Logo Glow pulse
      gsap.to(".logo-icon", {
        boxShadow: "0 0 50px rgba(34, 197, 94, 0.8)",
        duration: 1.5,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut"
      });

    }, containerRef);

    // 5. 3D Tilt Effect on Mouse Move
    const card = cardRef.current;
    const handleMouseMove = (e: MouseEvent) => {
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = ((y - centerY) / centerY) * -10; // Max 10 deg tilt
      const rotateY = ((x - centerX) / centerX) * 10;

      gsap.to(card, {
        rotateX,
        rotateY,
        transformPerspective: 1000,
        duration: 0.5,
        ease: "power2.out"
      });
    };

    const handleMouseLeave = () => {
      if (!card) return;
      gsap.to(card, {
        rotateX: 0,
        rotateY: 0,
        duration: 0.8,
        ease: "elastic.out(1, 0.5)"
      });
    };

    if (card) {
      card.addEventListener("mousemove", handleMouseMove);
      card.addEventListener("mouseleave", handleMouseLeave);
    }

    return () => {
      ctx.revert();
      if (card) {
        card.removeEventListener("mousemove", handleMouseMove);
        card.removeEventListener("mouseleave", handleMouseLeave);
      }
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    gsap.to(".login-btn", { scale: 0.95, duration: 0.1, yoyo: true, repeat: 1 });

    setTimeout(() => {
      setIsLoading(false);
      window.location.href = "/dashboard"; // Redirect to dashboard on success
    }, 1500);
  };

  return (
    <div ref={containerRef} className="login-wrapper" data-theme="dark">
      
      {/* Glowing Orbs */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />

      {/* Floating Coins Background */}
      <div className="coins-container">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="floating-coin"
            style={{
              left: `${5 + i * 8}%`,
              top: `${10 + (i % 5) * 18}%`,
              fontSize: `${24 + (i % 4) * 12}px`,
            }}
          >
            {i % 3 === 0 ? "₹" : i % 3 === 1 ? "$" : "€"}
          </div>
        ))}
      </div>

      {/* Main Glassmorphism Card */}
      <div ref={cardRef} className="login-card">
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

        <form ref={formRef} onSubmit={handleSubmit} className="login-form">
          <div className="form-group form-item">
            <label>Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@axiomledger.com"
            />
          </div>

          <div className="form-group form-item">
            <div className="label-row">
              <label>Password</label>
              <a href="#" className="forgot-link">Forgot password?</a>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button type="submit" disabled={isLoading} className="login-btn form-item">
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-black" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Authenticating...
              </>
            ) : (
              "Access Dashboard →"
            )}
          </button>
        </form>

        <div className="login-footer form-item">
          Don't have an account? <a href="#">Request Access</a>
        </div>
      </div>

      <p className="security-text">
        AES-256 Encryption • SOC2 Compliant • Zero-Knowledge Architecture
      </p>
    </div>
  );
};

export default LoginPage;