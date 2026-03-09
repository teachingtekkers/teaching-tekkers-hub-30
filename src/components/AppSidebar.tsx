import {
  LayoutDashboard, Tent, Users, UserCog, ClipboardCheck, Trophy, LogOut,
  Gauge, CalendarClock, DollarSign, FileText, Swords, BookOpen, Package,
  MessageSquare, FileBarChart, BarChart3,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const adminItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Camps", url: "/camps", icon: Tent },
  { title: "Players", url: "/players", icon: Users },
  { title: "Coaches", url: "/coaches", icon: UserCog },
  { title: "Attendance", url: "/attendance", icon: ClipboardCheck },
];

const operationsItems = [
  { title: "Control Centre", url: "/control-centre", icon: Gauge },
  { title: "Roster", url: "/roster", icon: CalendarClock },
  { title: "Payroll", url: "/payroll", icon: DollarSign },
  { title: "Invoices", url: "/invoices", icon: FileText },
];

const campToolsItems = [
  { title: "Fixtures", url: "/fixtures", icon: Swords },
  { title: "Session Plans", url: "/session-plans", icon: BookOpen },
  { title: "Equipment", url: "/equipment", icon: Package },
];

const businessItems = [
  { title: "Communications", url: "/communications", icon: MessageSquare },
  { title: "Proposals", url: "/proposals", icon: FileBarChart },
  { title: "Reports", url: "/reports", icon: BarChart3 },
];

const coachItems = [
  { title: "My Camps", url: "/my-camps", icon: Trophy },
  { title: "Session Plans", url: "/coach-session-plans", icon: BookOpen },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const renderItems = (items: { title: string; url: string; icon: React.ElementType }[]) =>
    items.map((item) => (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild>
          <NavLink to={item.url} end className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
            <item.icon className="mr-2 h-4 w-4" />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  const renderGroup = (label: string, items: { title: string; url: string; icon: React.ElementType }[]) => (
    <SidebarGroup>
      <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider">{label}</SidebarGroupLabel>
      <SidebarGroupContent><SidebarMenu>{renderItems(items)}</SidebarMenu></SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarContent className="bg-sidebar">
        <div className="flex items-center gap-2 px-4 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
            <Trophy className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <p className="text-sm font-bold text-sidebar-primary-foreground">Teaching Tekkers</p>
              <p className="text-xs text-sidebar-foreground">Operations</p>
            </div>
          )}
        </div>

        {renderGroup("Admin", adminItems)}
        {renderGroup("Operations", operationsItems)}
        {renderGroup("Camp Tools", campToolsItems)}
        {renderGroup("Business", businessItems)}
        {renderGroup("Coach Portal", coachItems)}
      </SidebarContent>

      <SidebarFooter className="bg-sidebar border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/" className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" activeClassName="">
                <LogOut className="mr-2 h-4 w-4" />
                {!collapsed && <span>Logout</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
