import { useState } from "react";
import {
  Users,
  FolderOpen,
  CheckSquare,
  Receipt,
  Calendar,
  AlertTriangle,
  AlarmClock,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useDashboardStats } from "../hooks/useDashboardStats";
import { useUpcomingCitas } from "../hooks/useUpcomingCitas";
import { useUrgentTareas } from "../hooks/useUrgentTareas";
import { useVencimientos, type VencimientoTarea } from "../hooks/useVencimientos";
import { useIngresos } from "../hooks/useIngresos";

const formatEuro = (n: number) =>
  n.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: number | null;
  loading: boolean;
  bg: string;
  iconColor: string;
}

function StatCard({ icon: Icon, label, value, loading, bg, iconColor }: StatCardProps) {
  return (
    <div
      className={`${bg} rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{label}</p>
          {loading ? (
            <div className="mt-2 h-9 w-16 bg-gray-200 rounded animate-pulse" />
          ) : (
            <p className="mt-1 text-3xl font-bold text-gray-900">{value ?? 0}</p>
          )}
        </div>
        <div className={`p-3 rounded-lg bg-white/70 ${iconColor}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
          <div className="h-3 bg-gray-100 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  const fecha = d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const hora = d.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return { fecha, hora };
};

const formatDate = (iso: string | null) => {
  if (!iso) return "Sin fecha";
  const [y, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
};

const prioridadBadge: Record<string, string> = {
  urgente: "bg-red-100 text-red-700",
  alta: "bg-orange-100 text-orange-700",
  media: "bg-yellow-100 text-yellow-700",
  baja: "bg-gray-100 text-gray-700",
};

export default function Dashboard() {
  const { stats, loading: statsLoading, error: statsError } = useDashboardStats();
  const { citas, loading: citasLoading, error: citasError } = useUpcomingCitas(5);
  const { tareas, loading: tareasLoading, error: tareasError } = useUrgentTareas(5);
  const {
    vencidas,
    hoy: venceHoy,
    proximos7,
    loading: vencLoading,
    error: vencError,
  } = useVencimientos();
  const {
    resumen: facturasResumen,
    meses,
    loading: ingresosLoading,
    error: ingresosError,
  } = useIngresos();

  const [mesSeleccionado, setMesSeleccionado] = useState<string>("");
  const mesActivo =
    meses.find((m) => m.key === mesSeleccionado) ?? meses[0] ?? null;

  const renderVencRow = (t: VencimientoTarea, tone: "red" | "orange" | "yellow") => {
    const toneCls =
      tone === "red"
        ? "border-red-200 bg-red-50"
        : tone === "orange"
        ? "border-orange-200 bg-orange-50"
        : "border-yellow-200 bg-yellow-50";
    return (
      <li
        key={t.id}
        className={`border ${toneCls} rounded-lg px-3 py-2 flex items-start justify-between gap-3`}
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{t.titulo}</p>
          {t.expedientes && (
            <p className="text-xs text-gray-600 mt-0.5 truncate">
              {t.expedientes.numero_expediente} · {t.expedientes.titulo}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-gray-500">Vence</p>
          <p className="text-sm font-semibold text-gray-900">
            {formatDate(t.fecha_vencimiento)}
          </p>
        </div>
      </li>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-600 mt-1">
          Resumen general del despacho
        </p>
      </div>

      {!vencLoading && (vencidas.length > 0 || venceHoy.length > 0) && (
        <Link
          to="/tareas"
          className="mb-4 flex items-center gap-3 bg-red-600 text-white px-4 py-3 rounded-lg shadow-sm hover:bg-red-700 transition-colors"
        >
          <AlarmClock className="w-5 h-5 shrink-0" />
          <p className="text-sm font-semibold">
            {vencidas.length > 0 && (
              <>
                {vencidas.length} {vencidas.length === 1 ? "tarea vencida" : "tareas vencidas"}
              </>
            )}
            {vencidas.length > 0 && venceHoy.length > 0 && " · "}
            {venceHoy.length > 0 && (
              <>
                {venceHoy.length} {venceHoy.length === 1 ? "vence hoy" : "vencen hoy"}
              </>
            )}
          </p>
        </Link>
      )}

      {statsError && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {statsError}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={Users}
          label="Total clientes"
          value={stats?.totalClientes ?? null}
          loading={statsLoading}
          bg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatCard
          icon={FolderOpen}
          label="Expedientes abiertos"
          value={stats?.expedientesAbiertos ?? null}
          loading={statsLoading}
          bg="bg-green-50"
          iconColor="text-green-600"
        />
        <StatCard
          icon={CheckSquare}
          label="Tareas pendientes"
          value={stats?.tareasPendientes ?? null}
          loading={statsLoading}
          bg="bg-amber-50"
          iconColor="text-amber-600"
        />
        <StatCard
          icon={Receipt}
          label="Facturas pendientes"
          value={stats?.facturasPendientes ?? null}
          loading={statsLoading}
          bg="bg-purple-50"
          iconColor="text-purple-600"
        />
      </div>

      <section className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
        <header className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <AlarmClock className="w-5 h-5 text-red-600" />
          <h2 className="text-base font-semibold text-gray-900">
            Plazos y vencimientos
          </h2>
        </header>
        <div className="p-5">
          {vencLoading ? (
            <SkeletonList rows={3} />
          ) : vencError ? (
            <div className="text-sm text-red-600">{vencError}</div>
          ) : vencidas.length === 0 && venceHoy.length === 0 && proximos7.length === 0 ? (
            <p className="text-sm text-gray-500 italic">
              No hay tareas con vencimiento en los próximos 7 días.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h3 className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">
                  Vencidas ({vencidas.length})
                </h3>
                {vencidas.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Ninguna</p>
                ) : (
                  <ul className="space-y-2">
                    {vencidas.map((t) => renderVencRow(t, "red"))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-2">
                  Vencen hoy ({venceHoy.length})
                </h3>
                {venceHoy.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Ninguna</p>
                ) : (
                  <ul className="space-y-2">
                    {venceHoy.map((t) => renderVencRow(t, "orange"))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="text-xs font-semibold text-yellow-700 uppercase tracking-wide mb-2">
                  Próximos 7 días ({proximos7.length})
                </h3>
                {proximos7.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Ninguna</p>
                ) : (
                  <ul className="space-y-2">
                    {proximos7.map((t) => renderVencRow(t, "yellow"))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <header className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <Wallet className="w-5 h-5 text-green-600" />
            <h2 className="text-base font-semibold text-gray-900">
              Estado de facturas
            </h2>
          </header>
          <div className="p-5">
            {ingresosLoading ? (
              <SkeletonList rows={3} />
            ) : ingresosError ? (
              <div className="text-sm text-red-600">{ingresosError}</div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div>
                    <p className="text-xs text-green-700 font-semibold uppercase">
                      Pagadas
                    </p>
                    <p className="text-xs text-gray-600">
                      {facturasResumen.pagadasCount}{" "}
                      {facturasResumen.pagadasCount === 1 ? "factura" : "facturas"}
                    </p>
                  </div>
                  <p className="text-xl font-bold text-gray-900">
                    {formatEuro(facturasResumen.pagadasTotal)}
                  </p>
                </div>
                <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div>
                    <p className="text-xs text-yellow-700 font-semibold uppercase">
                      Pendientes
                    </p>
                    <p className="text-xs text-gray-600">
                      {facturasResumen.pendientesCount}{" "}
                      {facturasResumen.pendientesCount === 1
                        ? "factura"
                        : "facturas"}
                    </p>
                  </div>
                  <p className="text-xl font-bold text-gray-900">
                    {formatEuro(facturasResumen.pendientesTotal)}
                  </p>
                </div>
                <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div>
                    <p className="text-xs text-red-700 font-semibold uppercase">
                      Vencidas
                    </p>
                    <p className="text-xs text-gray-600">
                      {facturasResumen.vencidasCount}{" "}
                      {facturasResumen.vencidasCount === 1
                        ? "factura"
                        : "facturas"}
                    </p>
                  </div>
                  <p className="text-xl font-bold text-gray-900">
                    {formatEuro(facturasResumen.vencidasTotal)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <header className="flex items-center justify-between gap-2 px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-semibold text-gray-900">
                Ingresos del mes
              </h2>
            </div>
            {meses.length > 0 && (
              <select
                value={mesActivo?.key ?? ""}
                onChange={(e) => setMesSeleccionado(e.target.value)}
                className="text-sm px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {meses.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            )}
          </header>
          <div className="p-5">
            {ingresosLoading ? (
              <SkeletonList rows={3} />
            ) : ingresosError ? (
              <div className="text-sm text-red-600">{ingresosError}</div>
            ) : !mesActivo ? (
              <p className="text-sm text-gray-500 italic">Sin datos</p>
            ) : (
              <div className="space-y-4">
                <div className="text-center py-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Total {mesActivo.label}
                  </p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {formatEuro(mesActivo.total)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-700 font-semibold uppercase">
                      Facturas pagadas
                    </p>
                    <p className="text-lg font-bold text-gray-900 mt-1">
                      {formatEuro(mesActivo.facturas)}
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-xs text-green-700 font-semibold uppercase">
                      Pagos en efectivo
                    </p>
                    <p className="text-lg font-bold text-gray-900 mt-1">
                      {formatEuro(mesActivo.efectivo)}
                    </p>
                  </div>
                </div>
                {mesActivo.total > 0 && (
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-blue-500"
                      style={{
                        width: `${(mesActivo.facturas / mesActivo.total) * 100}%`,
                      }}
                    />
                    <div
                      className="h-full bg-green-500"
                      style={{
                        width: `${(mesActivo.efectivo / mesActivo.total) * 100}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <header className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">
              Próximas citas
            </h2>
          </header>
          <div className="p-5">
            {citasLoading ? (
              <SkeletonList rows={4} />
            ) : citasError ? (
              <div className="text-sm text-red-600">{citasError}</div>
            ) : citas.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                No hay citas programadas.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {citas.map((c) => {
                  const { fecha, hora } = formatDateTime(c.fecha_inicio);
                  const cliente = c.clientes
                    ? [c.clientes.nombre, c.clientes.apellidos]
                        .filter(Boolean)
                        .join(" ")
                    : "Sin cliente";
                  return (
                    <li key={c.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {c.titulo || c.tipo || "Cita"}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">
                            {cliente}
                            {c.tipo && c.titulo ? ` · ${c.tipo}` : ""}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-medium text-gray-900">
                            {fecha}
                          </p>
                          <p className="text-xs text-gray-500">{hora}</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <header className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            <h2 className="text-base font-semibold text-gray-900">
              Tareas urgentes
            </h2>
          </header>
          <div className="p-5">
            {tareasLoading ? (
              <SkeletonList rows={4} />
            ) : tareasError ? (
              <div className="text-sm text-red-600">{tareasError}</div>
            ) : tareas.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                No hay tareas urgentes pendientes.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {tareas.map((t) => {
                  const exp = t.expedientes;
                  const cliente = exp?.clientes
                    ? [exp.clientes.nombre, exp.clientes.apellidos]
                        .filter(Boolean)
                        .join(" ")
                    : null;
                  const contexto = exp
                    ? `${exp.numero_expediente}${cliente ? ` · ${cliente}` : ""}`
                    : "Sin expediente";
                  const prio = t.prioridad ?? "media";
                  return (
                    <li key={t.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {t.titulo}
                            </p>
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${prioridadBadge[prio] ?? prioridadBadge.media}`}
                            >
                              {prio}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">
                            {contexto}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-gray-500">Vence</p>
                          <p className="text-sm font-medium text-gray-900">
                            {formatDate(t.fecha_vencimiento)}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
