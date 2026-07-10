import type { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  className?: string;
}

const BUTTON_CSS = `
._btn-reset { all: unset; }
._btn {
  position: relative; display: inline-flex; height: 3.5rem; align-items: center;
  border-radius: 9999px; padding-left: 2rem; padding-right: 2rem;
  font-family: Inter, sans-serif; font-size: 1.2rem; font-weight: 640;
  color: #fafaf6; letter-spacing: -0.06em; cursor: pointer;
}
._btn-item { background-color: transparent; color: #1d1d1f; }
._btn-item ._btn-bg { border-color: #f59e0b; background-color: #f59e0b; }
._btn-inner, ._btn-inner-hover, ._btn-inner-static { pointer-events: none; display: block; }
._btn-inner { position: relative; }
._btn-inner-hover { position: absolute; top: 0; left: 0; opacity: 0; transform: translateY(70%); color: #fafaf6; }
._btn-bg { overflow: hidden; border-radius: 2rem; position: absolute; top: 0; left: 0; width: 100%; height: 100%; transform: scale(1); transition: transform 1.8s cubic-bezier(0.19,1,0.22,1); }
._btn-bg, ._btn-bg-layer, ._btn-bg-layers { display: block; }
._btn-bg-layers { position: absolute; left: 50%; transform: translate(-50%); top: -60%; aspect-ratio: 1/1; width: max(200%, 10rem); }
._btn-bg-layer { border-radius: 9999px; position: absolute; top: 0; left: 0; width: 100%; height: 100%; transform: scale(0); }
._btn-bg-layer._l1 { background-color: #f59e0b; }
._btn-bg-layer._l2 { background-color: #d97706; }
._btn-bg-layer._l3 { background-color: #b45309; }
._btn:hover ._btn-inner-static { opacity: 0; transform: translateY(-70%); transition: transform 1.4s cubic-bezier(0.19,1,0.22,1), opacity 0.3s linear; }
._btn:hover ._btn-inner-hover { opacity: 1; transform: translateY(0); transition: transform 1.4s cubic-bezier(0.19,1,0.22,1), opacity 1.4s cubic-bezier(0.19,1,0.22,1); }
._btn:hover ._btn-bg-layer { transition: transform 1.3s cubic-bezier(0.19,1,0.22,1), opacity 0.3s linear; }
._btn:hover ._l1 { transform: scale(1); }
._btn:hover ._l2 { transition-delay: 0.1s; transform: scale(1); }
._btn:hover ._l3 { transition-delay: 0.2s; transform: scale(1); }
`;

export default function Button({ children, onClick, href, className = "" }: ButtonProps) {
  if (href) {
    return (
      <>
        <style>{BUTTON_CSS}</style>
        <a href={href} className={`_btn-reset _btn _btn-item group ${className}`}>
          <span className="_btn-bg">
            <span className="_btn-bg-layers">
              <span className="_btn-bg-layer _l1" />
              <span className="_btn-bg-layer _l2" />
              <span className="_btn-bg-layer _l3" />
            </span>
          </span>
          <span className="_btn-inner">
            <span className="_btn-inner-static">{children}</span>
            <span className="_btn-inner-hover" aria-hidden="true">{children}</span>
          </span>
        </a>
      </>
    );
  }

  return (
    <>
      <style>{BUTTON_CSS}</style>
      <button onClick={onClick} className={`_btn-reset _btn _btn-item group ${className}`}>
        <span className="_btn-bg">
          <span className="_btn-bg-layers">
            <span className="_btn-bg-layer _l1" />
            <span className="_btn-bg-layer _l2" />
            <span className="_btn-bg-layer _l3" />
          </span>
        </span>
        <span className="_btn-inner">
          <span className="_btn-inner-static">{children}</span>
          <span className="_btn-inner-hover" aria-hidden="true">{children}</span>
        </span>
      </button>
    </>
  );
}
