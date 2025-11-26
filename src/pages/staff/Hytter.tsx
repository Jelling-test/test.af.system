// Staff wrapper for Admin Hytter - uses same component with StaffSidebar
import AdminHytter from "../admin/Hytter";

const StaffHytter = () => {
  return <AdminHytter isStaffView={true} />;
};

export default StaffHytter;
