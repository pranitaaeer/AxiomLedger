export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 40 40" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background shape */}
      <rect width="40" height="40" rx="10" fill="var(--primary)" />
      
      {/* Abstract Ledger/Lines Shape */}
      <path 
        d="M12 12H28M12 20H22M12 28H26" 
        stroke="var(--primary-text)" 
        strokeWidth="3" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      
      {/* Checkmark indicating settled/verified */}
      <circle cx="27" cy="27" r="5" fill="var(--bg-card)" />
      <path 
        d="M25 27L26.5 28.5L29 25.5" 
        stroke="var(--primary)" 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
    </svg>
  );
}