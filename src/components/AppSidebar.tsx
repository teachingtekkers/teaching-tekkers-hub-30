import {
  LayoutDashboard, Tent, Users, UserCog, ClipboardCheck, Trophy, LogOut,
  CalendarClock, DollarSign, FileText, Swords, BookOpen, ListChecks,
  Briefcase, CreditCard, Calendar, FileCheck, ShieldCheck, CloudDownload, Database, Building2,
  Calculator, ImagePlus, Sparkles, Megaphone, MapPin, UserPlus, Map, BarChart3,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";

/* ── Admin: Seasonal Camps ── */
const seasonalCampsItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Camp Planning", url: "/camp-planning", icon: Map },
  { title: "Tasks & Deadlines", url: "/tasks", icon: ListChecks },
];

/* ── Admin: Staffing Admin ── */
const staffingItems = [
  { title: "Staff Profiles", url: "/coaches", icon: UserCog },
  { title: "Roster Generator", url: "/roster", icon: CalendarClock },
  { title: "Bonus Calculator", url: "/bonus-calculator", icon: Calculator },
  { title: "Staff Payroll", url: "/payroll", icon: DollarSign },
];

/* ── Admin: Club Admin ── */
const clubAdminItems = [
  { title: "Clubs", url: "/clubs", icon: Building2 },
  { title: "Camps", url: "/camps", icon: Tent },
  { title: "Club Payments", url: "/invoices", icon: FileText },
];

/* ── Admin: Booking Admin ── */
const bookingAdminItems = [
  { title: "Bookings", url: "/players", icon: Users },
  { title: "Booking Sync", url: "/booking-sync", icon: CloudDownload },
];

/* ── Admin: Coach Tools ── */
const coachToolsItems = [
  { title: "Attendance", url: "/attendance", icon: ClipboardCheck },
  { title: "Fixtures Generator", url: "/fixtures", icon: Swords },
  { title: "Session Plans", url: "/session-plans", icon: BookOpen },
  { title: "Itineraries", url: "/itineraries", icon: FileCheck },
];

/* ── Admin: Social Media ── */
const socialMediaItems = [
  { title: "Media Uploads", url: "/media-uploads", icon: ImagePlus },
  { title: "AI Content Planner", url: "/ai-content-planner", icon: Sparkles },
  { title: "Ad Poster Creation", url: "/ad-posters", icon: Megaphone },
];

/* ── Admin: Private Coaching ── */
const privateCoachingItems = [
  { title: "Dashboard", url: "/private/dashboard", icon: LayoutDashboard },
  { title: "Venues", url: "/private/venues", icon: MapPin },
  { title: "Children", url: "/private/children", icon: UserPlus },
  { title: "Sessions", url: "/private/sessions", icon: Briefcase },
  { title: "Attendance", url: "/private/attendance", icon: ClipboardCheck },
  { title: "Payments", url: "/private/payments", icon: CreditCard },
  { title: "Session Plans", url: "/private/session-plans", icon: BookOpen },
];

/* ── Admin: System ── */
const systemItems = [
  { title: "User Management", url: "/users", icon: ShieldCheck },
  { title: "DB Diagnostics", url: "/diagnostics", icon: Database },
];

/* ── Head Coach ── */
const headCoachItems = [
  { title: "My Camps", url: "/coach/my-camps", icon: Trophy },
  { title: "Attendance", url: "/coach/attendance", icon: ClipboardCheck },
  { title: "Fixtures", url: "/coach/fixtures", icon: Swords },
  { title: "Session Plans", url: "/coach/session-plans", icon: BookOpen },
  { title: "Camp Itinerary", url: "/coach/itinerary", icon: FileCheck },
];

interface AppSidebarProps {
  role: "admin" | "head_coach";
}

export function AppSidebar({ role }: AppSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut } = useAuth();

  const renderItems = (items: { title: string; url: string; icon: React.ElementType }[]) =>
    items.map((item) => (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton asChild>
          <NavLink
            to={item.url}
            end
            className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
          >
            <item.icon className="mr-2.5 h-4 w-4 shrink-0" />
            {!collapsed && <span className="text-sm">{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  const renderGroup = (label: string, items: { title: string; url: string; icon: React.ElementType }[]) => (
    <SidebarGroup key={label}>
      <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-[0.1em] font-semibold mb-1">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent><SidebarMenu>{renderItems(items)}</SidebarMenu></SidebarGroupContent>
    </SidebarGroup>
  );

  const divider = <div className="my-1 mx-4 border-t border-sidebar-border" />;

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarContent className="bg-sidebar">
        {/* Brand */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary shrink-0">
            <Trophy className="h-4.5 w-4.5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <p className="text-sm font-bold text-sidebar-primary-foreground leading-tight">Teaching Tekkers</p>
              <p className="text-[11px] text-sidebar-foreground/50">
                {role === "admin" ? "Admin" : "Head Coach"}
              </p>
            </div>
          )}
        </div>

        {role === "admin" ? (
          <>
            {renderGroup("Seasonal Camps", seasonalCampsItems)}
            {divider}
            {renderGroup("Staffing Admin", staffingItems)}
            {divider}
            {renderGroup("Club Admin", clubAdminItems)}
            {divider}
            {renderGroup("Booking Admin", bookingAdminItems)}
            {divider}
            {renderGroup("Coach Tools", coachToolsItems)}
            {divider}
            {renderGroup("Social Media", socialMediaItems)}
            {divider}
            {renderGroup("Private Coaching", privateCoachingItems)}
            {divider}
            {renderGroup("System", systemItems)}
          </>
        ) : (
          renderGroup("Head Coach", headCoachItems)
        )}
      </SidebarContent>

      <SidebarFooter className="bg-sidebar border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <button
                onClick={() => signOut()}
                className="flex items-center w-full text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground px-3 py-2 rounded-md transition-colors"
              >
                <LogOut className="mr-2.5 h-4 w-4" />
                {!collapsed && <span className="text-sm">Logout</span>}
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
