import AppSidebar from "@/components/SideBar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default function DashLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1">
      <SidebarProvider>
        <div className="flex min-h-screen w-full flex-col md:flex-row">
          {/* Sidebar */}
          <AppSidebar />
          <div className="hidden h-14 items-center border-b px-4 md:flex">
            <SidebarTrigger />
          </div>
          {/* MAIN AREA */}
          <main className="flex-1 overflow-auto p-6 pb-24 md:pb-6">
            {children}
          </main>
        </div>
      </SidebarProvider>
    </div>
  );
}
