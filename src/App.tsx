import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import CampsPage from "./pages/CampsPage";
import PlayersPage from "./pages/PlayersPage";
import CoachesPage from "./pages/CoachesPage";
import AttendancePage from "./pages/AttendancePage";
import MyCampsPage from "./pages/MyCampsPage";
import RosterPage from "./pages/RosterPage";
import PayrollPage from "./pages/PayrollPage";
import InvoicesPage from "./pages/InvoicesPage";
import ControlCentrePage from "./pages/ControlCentrePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/camps" element={<CampsPage />} />
            <Route path="/players" element={<PlayersPage />} />
            <Route path="/coaches" element={<CoachesPage />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/my-camps" element={<MyCampsPage />} />
            <Route path="/roster" element={<RosterPage />} />
            <Route path="/payroll" element={<PayrollPage />} />
            <Route path="/invoices" element={<InvoicesPage />} />
            <Route path="/control-centre" element={<ControlCentrePage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
