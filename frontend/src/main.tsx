import { Buffer } from "buffer";
(globalThis as any).Buffer = Buffer;
(globalThis as any).global = globalThis;
(globalThis as any).process = { env: {} };

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
