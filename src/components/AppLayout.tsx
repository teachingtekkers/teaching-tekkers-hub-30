import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

export function AdminLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar role="admin" />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b bg-card px-4 shrink-0">
            <SidebarTrigger className="mr-4" />
            <div className="flex-1" />
            <Badge variant="outline" className="text-xs font-medium">Admin</Badge>
          </header>
          <main className="flex-1 p-5 md:p-8 overflow-auto bg-background">
            <div className="max-w-7xl mx-auto">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export function CoachLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar role="head_coach" />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b bg-card px-4 shrink-0">
            <SidebarTrigger className="mr-4" />
            <div className="flex-1" />
            <Badge variant="outline" className="text-xs font-medium">Head Coach</Badge>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-auto bg-background">
            <div className="max-w-3xl mx-auto">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

// Keep backward compat
export function AppLayout() {
  return <AdminLayout />;
}
