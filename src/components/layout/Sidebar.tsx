import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FolderOpen,
  CheckSquare,
  Calendar,
  FileText,
  Receipt,
  Banknote,
  Mail,
} from "lucide-react";
import { supabase } from "../../lib/supabase";

export default function Sidebar() {
  const [leadsNuevos, setLeadsNuevos] = useState(0);

  const fetchLeadsCount = async () => {
    const { count } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("estado", "nuevo");
    setLeadsNuevos(count ?? 0);
  };

  useEffect(() => {
    fetchLeadsCount();
    const interval = setInterval(fetchLeadsCount, 30_000);
    return () => clearInterval(interval);
  }, []);

  const menuItems = [
    { to: "/dashboard",      icon: LayoutDashboard, label: "Dashboard" },
    { to: "/clientes",       icon: Users,           label: "Clientes" },
    { to: "/leads",          icon: Mail,            label: "Leads",           badge: leadsNuevos },
    { to: "/expedientes",    icon: FolderOpen,      label: "Expedientes" },
    { to: "/tareas",         icon: CheckSquare,     label: "Tareas" },
    { to: "/agenda",         icon: Calendar,        label: "Agenda" },
    { to: "/documentos",     icon: FileText,        label: "Documentos" },
    { to: "/facturas",       icon: Receipt,         label: "Facturas" },
    { to: "/pagos-efectivo", icon: Banknote,        label: "Pagos Efectivo" },
  ];

  return (
    <div className="w-64 bg-gray-900 text-white flex flex-col">
      <div className="p-4 border-b border-gray-800 bg-white flex items-center justify-center">
        <img
          src="/Logo.jpg"
          alt="Emilio Rojas Abogados"
          className="h-14 w-auto object-contain"
        />
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-gray-300 hover:bg-gray-800 hover:text-white"
                  }`
                }
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {"badge" in item && item.badge > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
