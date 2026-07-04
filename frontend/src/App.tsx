import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProviders } from "./context/FullTimeContext";
import Landing from "./pages/Landing";
import Markets from "./pages/Markets";
import MarketDetail from "./pages/MarketDetail";
import AuditTrail from "./pages/AuditTrail";
import Portfolio from "./pages/Portfolio";
import Admin from "./pages/Admin";

export default function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/markets" element={<Markets />} />
          <Route path="/markets/:id" element={<MarketDetail />} />
          <Route path="/markets/:id/audit" element={<AuditTrail />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </BrowserRouter>
    </AppProviders>
  );
}
