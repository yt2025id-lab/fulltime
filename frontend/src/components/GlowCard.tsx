import type { ReactNode } from "react";

const CARD_CSS = `
._glow-card {
  width: 100%;
  min-height: 320px;
  background: #111;
  position: relative;
  display: flex;
  place-content: center;
  place-items: center;
  overflow: hidden;
  border-radius: 20px;
}
._glow-card-inner {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}
._glow-card::before {
  content: '';
  position: absolute;
  width: 120px;
  background-image: linear-gradient(180deg, #c0392b, #ff6b35, #fbbf24, #fe53bb);
  height: 200%;
  animation: _glow-rotate 4s linear infinite;
}
._glow-card::after {
  content: '';
  position: absolute;
  background: #111;
  inset: 4px;
  border-radius: 16px;
}
@keyframes _glow-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`;

interface GlowCardProps {
  children: ReactNode;
  className?: string;
}

export default function GlowCard({ children, className = "" }: GlowCardProps) {
  return (
    <>
      <style>{CARD_CSS}</style>
      <div className={`_glow-card ${className}`}>
        <div className="_glow-card-inner">{children}</div>
      </div>
    </>
  );
}
