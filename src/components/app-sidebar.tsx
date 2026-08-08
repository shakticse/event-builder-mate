import { Link, useRouterState } from "@tanstack/react-router";
import {
  ClipboardList,
  LayoutDashboard,
  Layers,
  LogOut,
  Package,
  Undo2,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "BOM Builder", url: "/", icon: Package },
  { title: "Gate Pass", url: "/gate-pass", icon: ClipboardList },
  { title: "Return Items", url: "/returns", icon: Undo2 },
  { title: "Stock Consolidation", url: "/stock-consolidation", icon: Layers },
];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const collapsed = state === "collapsed";
  const { user, logout } = useAuth();

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex h-12 items-center px-2">
          <Package className="h-5 w-5 shrink-0 text-sidebar-primary" />
          <span className="ml-2 truncate font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
            Event Rentals
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    tooltip={collapsed ? item.title : undefined}
                  >
                    <Link to={item.url} onClick={handleLinkClick}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {user ? (
            <SidebarMenuItem>
              <div className="px-2 py-1 group-data-[collapsible=icon]:hidden">
                <p className="truncate text-sm font-medium text-sidebar-foreground">
                  {user.name || user.email}
                </p>
                <p className="truncate text-xs text-sidebar-foreground/70">
                  {user.role || user.email}
                </p>
              </div>
            </SidebarMenuItem>
          ) : null}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => {
                handleLinkClick();
                logout();
              }}
              tooltip={collapsed ? "Log out" : undefined}
            >
              <LogOut className="h-4 w-4" />
              <span>Log out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
