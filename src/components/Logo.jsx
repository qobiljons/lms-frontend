import { motion } from "framer-motion";

export default function Logo({ size = 32, showText = true, className = "" }) {
  return (
    <div className={`logo-wrapper ${className}`} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <motion.svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        whileHover={{ rotate: [0, -5, 5, 0], transition: { duration: 0.5 } }}
      >
        <rect x="2" y="2" width="44" height="44" rx="12" fill="url(#logoGrad)" />
        
        <path
          d="M24 10 L32 22 L27 22 L27 34 L21 34 L21 22 L16 22 Z"
          fill="#fff"
          opacity="0.95"
        />
        
        <path
          d="M30 12 Q36 8 38 14 Q34 16 30 12Z"
          fill="#bbf7d0"
          opacity="0.9"
        />

        <defs>
          <linearGradient id="logoGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#16a34a" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>
      </motion.svg>

      {showText && (
        <span className="logo-text">
          <span className="logo-up">Up</span>
          <span className="logo-green">Green</span>
        </span>
      )}
    </div>
  );
}
