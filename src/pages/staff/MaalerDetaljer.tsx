// Staff wrapper for Admin MaalerDetaljer - uses same component with StaffSidebar
import AdminMaalerDetaljer from "../admin/MaalerDetaljer";

const StaffMaalerDetaljer = () => {
  return <AdminMaalerDetaljer isStaffView={true} />;
};

export default StaffMaalerDetaljer;
