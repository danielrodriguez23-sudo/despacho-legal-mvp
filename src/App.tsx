import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { GoogleDriveProvider } from "./contexts/GoogleDriveContext";
import AppLayout from "./components/layout/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Clientes from "./pages/Clientes";
import Expedientes from "./pages/Expedientes";
import ExpedienteDetalle from "./pages/ExpedienteDetalle";
import Tareas from "./pages/Tareas";
import Agenda from "./pages/Agenda";
import Documentos from "./pages/Documentos";
import Facturas from "./pages/Facturas";
import PagosEfectivo from "./pages/PagosEfectivo";
import Perfil from "./pages/Perfil";
import Leads from "./pages/Leads";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <GoogleDriveProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="expedientes" element={<Expedientes />} />
            <Route path="expedientes/:id" element={<ExpedienteDetalle />} />
            <Route path="tareas" element={<Tareas />} />
            <Route path="agenda" element={<Agenda />} />
            <Route path="documentos" element={<Documentos />} />
            <Route path="facturas" element={<Facturas />} />
            <Route path="pagos-efectivo" element={<PagosEfectivo />} />
            <Route path="leads" element={<Leads />} />
            <Route path="perfil" element={<Perfil />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </GoogleDriveProvider>
    </AuthProvider>
  );
}

export default App;
