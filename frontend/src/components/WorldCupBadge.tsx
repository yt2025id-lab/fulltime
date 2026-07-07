const BADGE_CSS = `
._badge {
  display: flex; justify-content: center; align-items: center;
  width: 14rem; overflow: hidden; height: 3.2rem;
  background-size: 300% 300%; cursor: default;
  backdrop-filter: blur(1rem); border-radius: 5rem;
  transition: 0.5s; position: relative;
  animation: _gradient 5s ease infinite;
  border: double 4px transparent;
  background-image: linear-gradient(#212121, #212121),
    linear-gradient(137.48deg, #ffdb3b 10%, #fe53bb 45%, #c0392b 67%, #ff6b35 87%);
  background-origin: border-box;
  background-clip: content-box, border-box;
}
._badge-stars { position: absolute; z-index: -1; width: 100%; height: 100%; overflow: hidden; transition: 0.5s; backdrop-filter: blur(1rem); border-radius: 5rem; }
._badge strong { z-index: 2; font-family: Inter, sans-serif; font-size: 13px; letter-spacing: 4px; color: #ffffff; text-shadow: 0 0 4px white; text-transform: uppercase; font-weight: 700; }
._badge ._glow { position: absolute; display: flex; width: 12rem; }
._badge ._circle { width: 100%; height: 30px; filter: blur(2rem); animation: _pulse 4s infinite; z-index: -1; }
._badge ._circle:nth-of-type(1) { background: rgba(254, 83, 186, 0.636); }
._badge ._circle:nth-of-type(2) { background: rgba(192, 57, 43, 0.704); }
._badge:hover ._badge-stars { z-index: 1; background-color: #212121; }
._badge:hover { transform: scale(1.1); }
._badge:active { border: double 4px #c0392b; background-origin: border-box; background-clip: content-box, border-box; animation: none; }
._badge:active ._circle { background: #c0392b; }
._badge ._stars { position: relative; background: transparent; width: 200rem; height: 200rem; }
._badge ._stars::after { content: ""; position: absolute; top: -10rem; left: -100rem; width: 100%; height: 100%; animation: _starRotate 90s linear infinite; background-image: radial-gradient(#ffffff 1px, transparent 1%); background-size: 50px 50px; }
._badge ._stars::before { content: ""; position: absolute; top: 0; left: -50%; width: 170%; height: 500%; animation: _star 60s linear infinite; background-image: radial-gradient(#ffffff 1px, transparent 1%); background-size: 50px 50px; opacity: 0.5; }
@keyframes _star { from { transform: translateY(0); } to { transform: translateY(-135rem); } }
@keyframes _starRotate { from { transform: rotate(360deg); } to { transform: rotate(0); } }
@keyframes _gradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
@keyframes _pulse { 0% { transform: scale(0.75); box-shadow: 0 0 0 0 rgba(0,0,0,0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(0,0,0,0); } 100% { transform: scale(0.75); box-shadow: 0 0 0 0 rgba(0,0,0,0); } }
`;

export default function WorldCupBadge() {
  return (
    <>
      <style>{BADGE_CSS}</style>
      <div className="_badge">
        <div className="_badge-stars">
          <div className="_stars" />
        </div>
        <div className="_glow">
          <div className="_circle" />
          <div className="_circle" />
        </div>
        <strong>FIFA World Cup 2026</strong>
      </div>
    </>
  );
}
