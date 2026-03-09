import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminLayout, CoachLayout } from "@/components/AppLayout";
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/NotFound";

// Admin: Seasonal Camps
import DashboardPage from "./pages/DashboardPage";
import CampsPage from "./pages/CampsPage";
import PlayersPage from "./pages/PlayersPage";
import CoachesPage from "./pages/CoachesPage";
import RosterPage from "./pages/RosterPage";
import PayrollPage from "./pages/PayrollPage";
import InvoicesPage from "./pages/InvoicesPage";
import ReportsPage from "./pages/ReportsPage";

// Admin: Private Coaching
import PrivateDashboardPage from "./pages/private/PrivateDashboardPage";
import PrivateSessionsPage from "./pages/private/PrivateSessionsPage";
import PrivateBookingsPage from "./pages/private/PrivateBookingsPage";
import PrivatePaymentsPage from "./pages/private/PrivatePaymentsPage";

// Head Coach
import MyCampsPage from "./pages/MyCampsPage";
import AttendancePage from "./pages/AttendancePage";
import FixturesPage from "./pages/FixturesPage";
import CoachSessionPlansPage from "./pages/CoachSessionPlansPage";
import CoachItineraryPage from "./pages/coach/CoachItineraryPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LoginPage />} />

          {/* Admin routes */}
          <Route element={<AdminLayout />}>
            {/* Seasonal Camps */}
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/camps" element={<CampsPage />} />
            <Route path="/players" element={<PlayersPage />} />
            <Route path="/coaches" element={<CoachesPage />} />
            <Route path="/roster" element={<RosterPage />} />
            <Route path="/payroll" element={<PayrollPage />} />
            <Route path="/invoices" element={<InvoicesPage />} />
            <Route path="/reports" element={<ReportsPage />} />

            {/* Private Coaching */}
            <Route path="/private/dashboard" element={<PrivateDashboardPage />} />
            <Route path="/private/sessions" element={<PrivateSessionsPage />} />
            <Route path="/private/bookings" element={<PrivateBookingsPage />} />
            <Route path="/private/payments" element={<PrivatePaymentsPage />} />
          </Route>

          {/* Head Coach routes */}
          <Route element={<CoachLayout />}>
            <Route path="/coach/my-camps" element={<MyCampsPage />} />
            <Route path="/coach/attendance" element={<AttendancePage />} />
            <Route path="/coach/fixtures" element={<FixturesPage />} />
            <Route path="/coach/session-plans" element={<CoachSessionPlansPage />} />
            <Route path="/coach/itinerary" element={<CoachItineraryPage />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
