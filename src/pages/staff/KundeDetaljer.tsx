// Staff wrapper for Admin Kunder - uses same component with StaffSidebar
import AdminKunder from "../admin/Kunder";

const StaffKundeDetaljer = () => {
  return <AdminKunder isStaffView={true} />;
};

export default StaffKundeDetaljer;
