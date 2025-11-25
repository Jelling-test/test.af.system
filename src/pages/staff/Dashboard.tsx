// Staff wrapper for Admin Dashboard - uses same component with StaffSidebar
import AdminDashboard from "../admin/Dashboard";

const StaffDashboard = () => {
  return <AdminDashboard isStaffView={true} />;
};

export default StaffDashboard;
