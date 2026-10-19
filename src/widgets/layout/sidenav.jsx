import PropTypes from "prop-types";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { XMarkIcon, ArrowRightOnRectangleIcon } from "@heroicons/react/24/outline";
import {
  Button,
  IconButton,
  Typography,
} from "@material-tailwind/react";
import { useMaterialTailwindController, setOpenSidenav, useAuth } from "@/context";
import { dashboardPathWithSavedFilters } from "@/utils/urlFilters";

export function Sidenav({ brandImg, brandName, menuItems, routes }) {
  const [controller, dispatch] = useMaterialTailwindController();
  const { sidenavColor, sidenavType, openSidenav } = controller;
  const navigate = useNavigate();
  const { logout } = useAuth();
  const sidenavTypes = {
    dark: "bg-gradient-to-br from-gray-800 to-gray-900",
    white: "bg-white shadow-sm",
    transparent: "bg-transparent",
  };

  const useMenuItems = menuItems && menuItems.length > 0;

  // Đóng sidebar và navigate (dùng cho mobile)
  const handleNavClick = () => {
    setOpenSidenav(dispatch, false);
  };

  const handleLogout = () => {
    handleNavClick();
    logout();
    navigate("/lcs");
  };

  return (
    <>
      {/* ── Backdrop: tap ra ngoài để đóng sidebar trên mobile ── */}
      {openSidenav && (
        <div
          className="fixed inset-0 z-40 bg-black/40 xl:hidden"
          onClick={() => setOpenSidenav(dispatch, false)}
        />
      )}

      <aside
        className={`${sidenavTypes[sidenavType]} ${
          openSidenav ? "translate-x-0" : "-translate-x-80"
        } fixed inset-0 z-50 my-4 ml-4 flex h-[calc(100vh-32px)] w-72 flex-col rounded-xl transition-transform duration-300 xl:translate-x-0 border border-blue-gray-100`}
      >
        <div className="relative shrink-0">
          <Link
            to="/dashboard/home"
            className="py-6 px-8 text-center block"
            onClick={handleNavClick}
          >
            <Typography
              variant="h6"
              color={sidenavType === "dark" ? "white" : "blue-gray"}
            >
              {brandName || "Material Tailwind React"}
            </Typography>
          </Link>
          <IconButton
            variant="text"
            color={sidenavType === "dark" ? "white" : "blue-gray"}
            size="sm"
            ripple={false}
            className="absolute right-0 top-0 grid rounded-br-none rounded-tl-none xl:hidden"
            onClick={() => setOpenSidenav(dispatch, false)}
          >
            <XMarkIcon strokeWidth={2.5} className="h-5 w-5" />
          </IconButton>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto m-4 mt-0">
          {useMenuItems ? (
            <ul className="mb-2 flex flex-col gap-1">
              {menuItems.map(({ path, name, icon }) => (
                <li key={path}>
                  <NavLink
                    to={dashboardPathWithSavedFilters(path)}
                    end={path === "/home"}
                    onClick={handleNavClick}
                  >
                    {({ isActive }) => (
                      <Button
                        variant={isActive ? "gradient" : "text"}
                        color={
                          isActive
                            ? (sidenavColor === "dark" ? "blue-gray" : sidenavColor)
                            : sidenavType === "dark"
                            ? "white"
                            : "blue-gray"
                        }
                        className="flex items-center gap-4 px-4 capitalize"
                        fullWidth
                      >
                        {icon}
                        <Typography color="inherit" className="font-medium capitalize">
                          {name}
                        </Typography>
                      </Button>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          ) : (
            routes && routes.map(({ layout, title, pages }, key) => (
              <ul key={key} className="mb-4 flex flex-col gap-1">
                {title && (
                  <li className="mx-3.5 mt-4 mb-2">
                    <Typography
                      variant="small"
                      color={sidenavType === "dark" ? "white" : "blue-gray"}
                      className="font-black uppercase opacity-75"
                    >
                      {title}
                    </Typography>
                  </li>
                )}
                {pages && pages.map(({ icon, name, path }) => (
                  <li key={name}>
                    <NavLink to={`/${layout}${path}`} onClick={handleNavClick}>
                      {({ isActive }) => (
                        <Button
                          variant={isActive ? "gradient" : "text"}
                          color={
                            isActive ? sidenavColor : sidenavType === "dark" ? "white" : "blue-gray"
                          }
                          className="flex items-center gap-4 px-4 capitalize"
                          fullWidth
                        >
                          {icon}
                          <Typography color="inherit" className="font-medium capitalize">
                            {name}
                          </Typography>
                        </Button>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            ))
          )}
        </div>
        <div className="shrink-0 border-t border-blue-gray-100 mx-4 mb-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <Button
            variant="text"
            color="red"
            className="flex items-center gap-4 px-4 capitalize w-full justify-start"
            fullWidth
            onClick={handleLogout}
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5 shrink-0" />
            <Typography color="inherit" className="font-medium capitalize">
              Đăng xuất
            </Typography>
          </Button>
        </div>
      </aside>
    </>
  );
}

Sidenav.defaultProps = {
  brandImg: "/img/logo-ct.png",
  brandName: "Cafe - Đặt hàng NCC",
  menuItems: null,
  routes: [],
};

Sidenav.propTypes = {
  brandImg: PropTypes.string,
  brandName: PropTypes.string,
  menuItems: PropTypes.arrayOf(PropTypes.shape({ path: PropTypes.string, name: PropTypes.string, icon: PropTypes.node })),
  routes: PropTypes.arrayOf(PropTypes.object),
};

Sidenav.displayName = "/src/widgets/layout/sidnave.jsx";

export default Sidenav;
