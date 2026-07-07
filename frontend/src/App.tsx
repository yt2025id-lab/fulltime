import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProviders } from "./context/FullTimeContext";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Matches from "./pages/Matches";
import Faq from "./pages/Faq";
import Faucet from "./pages/Faucet";

export default function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/app" element={<Dashboard />} />
          <Route path="/matches" element={<Matches />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/faucet" element={<Faucet />} />
        </Routes>
      </BrowserRouter>
    </AppProviders>
  );
}
