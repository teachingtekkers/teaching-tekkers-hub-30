import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout, CoachLayout } from "@/components/AppLayout";
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/NotFound";

// Admin: Seasonal Camps
import DashboardPage from "./pages/DashboardPage";
import TasksDeadlinesPage from "./pages/TasksDeadlinesPage";

// Admin: Staffing
import CoachesPage from "./pages/CoachesPage";
import CoachDetailPage from "./pages/CoachDetailPage";
import RosterPage from "./pages/RosterPage";
import BonusCalculatorPage from "./pages/BonusCalculatorPage";
import PayrollPage from "./pages/PayrollPage";

// Admin: Club Admin
import ClubsPage from "./pages/ClubsPage";
import CampsPage from "./pages/CampsPage";
import CampDetailPage from "./pages/CampDetailPage";
import InvoicesPage from "./pages/InvoicesPage";

// Admin: Booking Admin
import PlayersPage from "./pages/PlayersPage";
import BookingSyncPage from "./pages/BookingSyncPage";

// Admin: Coach Tools
import AdminAttendancePage from "./pages/AdminAttendancePage";
import FixturesPage from "./pages/FixturesPage";
import SessionPlansPage from "./pages/SessionPlansPage";
import ItinerariesPage from "./pages/ItinerariesPage";

// Admin: Social Media
import MediaUploadsPage from "./pages/MediaUploadsPage";
import AIContentPlannerPage from "./pages/AIContentPlannerPage";
import AdPosterPage from "./pages/AdPosterPage";

// Admin: Private Coaching
import PrivateDashboardPage from "./pages/private/PrivateDashboardPage";
import PrivateVenuesPage from "./pages/private/PrivateVenuesPage";
import PrivateChildrenPage from "./pages/private/PrivateChildrenPage";
import PrivateSessionsPage from "./pages/private/PrivateSessionsPage";
import PrivateAttendancePage from "./pages/private/PrivateAttendancePage";
import PrivatePaymentsPage from "./pages/private/PrivatePaymentsPage";
import PrivateSessionPlansPage from "./pages/private/PrivateSessionPlansPage";

// Admin: System
import UserManagementPage from "./pages/UserManagementPage";
import DatabaseDiagnosticsPage from "./pages/DatabaseDiagnosticsPage";
import ReportsPage from "./pages/ReportsPage";

// Head Coach
import MyCampsPage from "./pages/MyCampsPage";
import AttendancePage from "./pages/AttendancePage";
import CoachFixturesPage from "./pages/FixturesPage";
import CoachSessionPlansPage from "./pages/CoachSessionPlansPage";
import CoachItineraryPage from "./pages/coach/CoachItineraryPage";

const queryClient = new QueryClient();

function ProtectedAdminLayout() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AdminLayout />
    </ProtectedRoute>
  );
}

function ProtectedCoachLayout() {
  return (
    <ProtectedRoute allowedRoles={["head_coach"]}>
      <CoachLayout />
    </ProtectedRoute>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LoginPage />} />

            {/* Admin routes */}
            <Route element={<ProtectedAdminLayout />}>
              {/* Seasonal Camps */}
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/tasks" element={<TasksDeadlinesPage />} />

              {/* Staffing Admin */}
              <Route path="/coaches" element={<CoachesPage />} />
              <Route path="/coaches/:id" element={<CoachDetailPage />} />
              <Route path="/roster" element={<RosterPage />} />
              <Route path="/bonus-calculator" element={<BonusCalculatorPage />} />
              <Route path="/payroll" element={<PayrollPage />} />

              {/* Club Admin */}
              <Route path="/clubs" element={<ClubsPage />} />
              <Route path="/camps" element={<CampsPage />} />
              <Route path="/camps/:id" element={<CampDetailPage />} />
              <Route path="/invoices" element={<InvoicesPage />} />

              {/* Booking Admin */}
              <Route path="/players" element={<PlayersPage />} />
              <Route path="/booking-sync" element={<BookingSyncPage />} />

              {/* Coach Tools */}
              <Route path="/attendance" element={<AdminAttendancePage />} />
              <Route path="/fixtures" element={<FixturesPage />} />
              <Route path="/session-plans" element={<SessionPlansPage />} />
              <Route path="/itineraries" element={<ItinerariesPage />} />

              {/* Social Media */}
              <Route path="/media-uploads" element={<MediaUploadsPage />} />
              <Route path="/ai-content-planner" element={<AIContentPlannerPage />} />
              <Route path="/ad-posters" element={<AdPosterPage />} />

              {/* Private Coaching */}
              <Route path="/private/dashboard" element={<PrivateDashboardPage />} />
              <Route path="/private/venues" element={<PrivateVenuesPage />} />
              <Route path="/private/children" element={<PrivateChildrenPage />} />
              <Route path="/private/sessions" element={<PrivateSessionsPage />} />
              <Route path="/private/attendance" element={<PrivateAttendancePage />} />
              <Route path="/private/payments" element={<PrivatePaymentsPage />} />
              <Route path="/private/session-plans" element={<PrivateSessionPlansPage />} />

              {/* System */}
              <Route path="/users" element={<UserManagementPage />} />
              <Route path="/diagnostics" element={<DatabaseDiagnosticsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
            </Route>

            {/* Head Coach routes */}
            <Route element={<ProtectedCoachLayout />}>
              <Route path="/coach/my-camps" element={<MyCampsPage />} />
              <Route path="/coach/attendance" element={<AttendancePage />} />
              <Route path="/coach/fixtures" element={<CoachFixturesPage />} />
              <Route path="/coach/session-plans" element={<CoachSessionPlansPage />} />
              <Route path="/coach/itinerary" element={<CoachItineraryPage />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
