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

const overviewItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Control Centre", url: "/control-centre", icon: Gauge },
];

const operationsItems = [
  { title: "Camps", url: "/camps", icon: Tent },
  { title: "Roster", url: "/roster", icon: CalendarClock },
  { title: "Attendance", url: "/attendance", icon: ClipboardCheck },
  { title: "Fixtures", url: "/fixtures", icon: Swords },
  { title: "Session Plans", url: "/session-plans", icon: BookOpen },
  { title: "Equipment", url: "/equipment", icon: Package },
];

const peopleItems = [
  { title: "Players", url: "/players", icon: Users },
  { title: "Coaches", url: "/coaches", icon: UserCog },
];

const financeItems = [
  { title: "Payroll", url: "/payroll", icon: DollarSign },
  { title: "Invoices", url: "/invoices", icon: FileText },
];

const toolsItems = [
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

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarContent className="bg-sidebar">
        <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary shrink-0">
            <Trophy className="h-4.5 w-4.5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <p className="text-sm font-bold text-sidebar-primary-foreground leading-tight">Teaching Tekkers</p>
              <p className="text-[11px] text-sidebar-foreground/50">Operations Platform</p>
            </div>
          )}
        </div>

        {renderGroup("Overview", overviewItems)}
        {renderGroup("Operations", operationsItems)}
        {renderGroup("People", peopleItems)}
        {renderGroup("Finance", financeItems)}
        {renderGroup("Tools", toolsItems)}

        <div className="my-2 mx-4 border-t border-sidebar-border" />

        {renderGroup("Coach Portal", coachItems)}
      </SidebarContent>

      <SidebarFooter className="bg-sidebar border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/" className="text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" activeClassName="">
                <LogOut className="mr-2.5 h-4 w-4" />
                {!collapsed && <span className="text-sm">Logout</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
