import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider, Route, createRoutesFromElements } from "react-router-dom";
import { lazy, Suspense } from "react";
import ErrorBoundary from "@/components/shared/ErrorBoundary";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

// Eager load critical pages
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";

// Lazy load remaining pages for better performance
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const VaelgMaaler = lazy(() => import("./pages/VaelgMaaler"));
const VaelgPakke = lazy(() => import("./pages/VaelgPakke"));
const TillaegsPakke = lazy(() => import("./pages/TillaegsPakke"));
const BetalingGennemfoert = lazy(() => import("./pages/BetalingGennemfoert"));
const BetalingAnnulleret = lazy(() => import("./pages/BetalingAnnulleret"));
const Help = lazy(() => import("./pages/Help"));
const GuestGuide = lazy(() => import("./pages/guide/GuestGuide"));
const StaffGuide = lazy(() => import("./pages/guide/StaffGuide"));
const AdminGuide = lazy(() => import("./pages/guide/AdminGuide"));
const StaffLogin = lazy(() => import("./pages/staff/Login"));
const StaffDashboard = lazy(() => import("./pages/staff/Dashboard"));
const KundeDetaljer = lazy(() => import("./pages/staff/KundeDetaljer"));
const StaffMaalere = lazy(() => import("./pages/staff/Maalere"));
const StaffMaalerDetaljer = lazy(() => import("./pages/staff/MaalerDetaljer"));
const StaffHytter = lazy(() => import("./pages/staff/Hytter"));
const PlaceholderPage = lazy(() => import("./pages/staff/Placeholder"));
const AdminLogin = lazy(() => import("./pages/admin/Login"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminMaalere = lazy(() => import("./pages/admin/Maalere"));
const AdminMaalerDetaljer = lazy(() => import("./pages/admin/MaalerDetaljer"));
const AdminPriser = lazy(() => import("./pages/admin/Priser"));
const AdminKunder = lazy(() => import("./pages/admin/Kunder"));
const AdminRapporter = lazy(() => import("./pages/admin/Rapporter"));
const AdminPersonale = lazy(() => import("./pages/admin/Personale"));
const AdminIndstillinger = lazy(() => import("./pages/admin/Indstillinger"));
const AdminBom = lazy(() => import("./pages/admin/Bom"));
const AdminGruppeMails = lazy(() => import("./pages/admin/GruppeMails"));
const AdminHytter = lazy(() => import("./pages/admin/Hytter"));
const AdminParring = lazy(() => import("./pages/admin/Parring"));
const AdminKort = lazy(() => import("./pages/admin/Kort"));
const AdminStandere = lazy(() => import("./pages/admin/Standere"));
const AdminManuelTaend = lazy(() => import("./pages/admin/ManuelTaend"));
const AdminElInfrastruktur = lazy(() => import("./pages/admin/ElInfrastruktur"));
const AdminPladser = lazy(() => import("./pages/admin/Pladser"));
const AdminPersonligSide = lazy(() => import("./pages/admin/PersonligSide"));
const AdminBageri = lazy(() => import("./pages/admin/AdminBageri"));
const AdminEvents = lazy(() => import("./pages/admin/AdminEvents"));
const AdminExternalEvents = lazy(() => import("./pages/admin/AdminExternalEvents"));
const AdminAttractions = lazy(() => import("./pages/admin/AdminAttractions"));
const AdminCafe = lazy(() => import("./pages/admin/AdminCafe"));
const AdminPractical = lazy(() => import("./pages/admin/AdminPractical"));
const AdminPool = lazy(() => import("./pages/admin/AdminPool"));
const AdminPlayground = lazy(() => import("./pages/admin/AdminPlayground"));
const AdminCabinInfo = lazy(() => import("./pages/admin/AdminCabinInfo"));
const AdminDashboardImages = lazy(() => import("./pages/admin/AdminDashboardImages"));
const StaffBom = lazy(() => import("./pages/staff/Bom"));
const RemoteGate = lazy(() => import("./pages/RemoteGate"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="/" element={<Index />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/vaelg-maaler" element={<VaelgMaaler />} />
      <Route path="/vaelg-pakke" element={<VaelgPakke />} />
      <Route path="/tillaegs-pakke" element={<TillaegsPakke />} />
      <Route path="/betaling-gennemfoert" element={<BetalingGennemfoert />} />
      <Route path="/betaling-annulleret" element={<BetalingAnnulleret />} />
      
      {/* Auth Routes */}
      <Route path="/auth/callback" element={<AuthCallback />} />
      
      {/* Help & Guide Routes */}
      <Route path="/help" element={<Help />} />
      <Route path="/guide/guest" element={<GuestGuide />} />
      <Route path="/guide/staff" element={<StaffGuide />} />
      <Route path="/guide/admin" element={<AdminGuide />} />
      
      {/* Staff Routes */}
      <Route path="/staff/login" element={<StaffLogin />} />
      <Route path="/staff/dashboard" element={<StaffDashboard />} />
      <Route path="/staff/kunde-detaljer" element={<KundeDetaljer />} />
      <Route path="/staff/bom" element={<StaffBom />} />
      <Route path="/staff/maalere" element={<StaffMaalere />} />
      <Route path="/staff/maalere/:meterId" element={<StaffMaalerDetaljer />} />
      <Route path="/staff/hytter" element={<StaffHytter />} />
      <Route path="/staff/flyt-gaest" element={<PlaceholderPage title="Flyt gæst" description="Flyt gæster til nye pladser" />} />
      <Route path="/staff/kort" element={<AdminKort isStaff={true} />} />
      <Route path="/staff/manuel-taend" element={<AdminManuelTaend isStaff={true} />} />
      <Route path="/staff/parring" element={<AdminParring isStaff={true} />} />
      
      {/* Admin Routes */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/admin/maalere" element={<AdminMaalere />} />
      <Route path="/admin/maalere/:meterId" element={<AdminMaalerDetaljer />} />
      <Route path="/admin/parring" element={<AdminParring />} />
      <Route path="/admin/hytter" element={<AdminHytter />} />
      <Route path="/admin/priser" element={<AdminPriser />} />
      <Route path="/admin/kunder" element={<AdminKunder />} />
      <Route path="/admin/bom" element={<AdminBom />} />
      <Route path="/admin/gruppe-mails" element={<AdminGruppeMails />} />
      <Route path="/admin/rapporter" element={<AdminRapporter />} />
      <Route path="/admin/personale" element={<AdminPersonale />} />
      <Route path="/admin/indstillinger" element={<AdminIndstillinger />} />
      <Route path="/admin/kort" element={<AdminKort />} />
      <Route path="/admin/standere" element={<AdminStandere />} />
      <Route path="/admin/manuel-taend" element={<AdminManuelTaend />} />
      <Route path="/admin/el-infrastruktur" element={<AdminElInfrastruktur />} />
      <Route path="/admin/pladser" element={<AdminPladser />} />
      <Route path="/admin/personlig-side" element={<AdminPersonligSide />} />
      <Route path="/admin/bageri" element={<AdminBageri />} />
      <Route path="/admin/events" element={<AdminEvents />} />
      <Route path="/admin/eksterne-events" element={<AdminExternalEvents />} />
      <Route path="/admin/attraktioner" element={<AdminAttractions />} />
      <Route path="/admin/cafe" element={<AdminCafe />} />
      <Route path="/admin/praktisk" element={<AdminPractical />} />
      <Route path="/admin/friluftsbad" element={<AdminPool />} />
      <Route path="/admin/legeplads" element={<AdminPlayground />} />
      <Route path="/admin/hytter-info" element={<AdminCabinInfo />} />
      <Route path="/admin/dashboard-billeder" element={<AdminDashboardImages />} />
      
      {/* Remote Gate Control */}
      <Route path="/bom" element={<RemoteGate />} />
      
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </>
  ),
  {
    future: {
      v7_relativeSplatPath: true,
    },
  }
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Suspense fallback={<LoadingSpinner />}>
          <RouterProvider 
            router={router}
            future={{
              v7_startTransition: true,
            }}
          />
        </Suspense>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
