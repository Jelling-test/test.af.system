// Staff wrapper for Admin Maalere - uses same component with StaffSidebar
import AdminMaalere from "../admin/Maalere";

const StaffMaalere = () => {
  return <AdminMaalere isStaffView={true} />;
};

export default StaffMaalere;
