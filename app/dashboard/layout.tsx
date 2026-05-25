import Sidebar from "@/components/layout/Sidebar";
import CompanyBanner from "@/components/layout/CompanyBanner";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col bg-gray-50">
        <CompanyBanner />
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}