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
} from "lucide-react";

const menuItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/clientes", icon: Users, label: "Clientes" },
  { to: "/expedientes", icon: FolderOpen, label: "Expedientes" },
  { to: "/tareas", icon: CheckSquare, label: "Tareas" },
  { to: "/agenda", icon: Calendar, label: "Agenda" },
  { to: "/documentos", icon: FileText, label: "Documentos" },
  { to: "/facturas", icon: Receipt, label: "Facturas" },
  { to: "/pagos-efectivo", icon: Banknote, label: "Pagos Efectivo" },
];

export default function Sidebar() {
  return (
    <div className="w-64 bg-gray-900 text-white flex flex-col">
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-xl font-bold">Rojas & Corrales Abogados</h1>
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
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
