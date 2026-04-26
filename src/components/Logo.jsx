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
          d="M24 14 C20 14 16 12 13 12 L13 32 C16 32 20 33 24 35 C28 33 32 32 35 32 L35 12 C32 12 28 14 24 14Z"
          fill="#fff"
          opacity="0.95"
        />

        <line x1="24" y1="14" x2="24" y2="35" stroke="#16a34a" strokeWidth="1.2" opacity="0.5" />

        <line x1="16" y1="18" x2="22" y2="18" stroke="#bbf7d0" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="16" y1="22" x2="21" y2="22" stroke="#bbf7d0" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="16" y1="26" x2="20" y2="26" stroke="#bbf7d0" strokeWidth="1.5" strokeLinecap="round" />

        <line x1="26" y1="18" x2="32" y2="18" stroke="#bbf7d0" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="27" y1="22" x2="32" y2="22" stroke="#bbf7d0" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="28" y1="26" x2="32" y2="26" stroke="#bbf7d0" strokeWidth="1.5" strokeLinecap="round" />

        <defs>
          <linearGradient id="logoGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#16a34a" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>
      </motion.svg>

      {showText && (
        <span className="logo-text">
          <span className="logo-up">Edu</span>
          <span className="logo-green">Flow</span>
        </span>
      )}
    </div>
  );
}
