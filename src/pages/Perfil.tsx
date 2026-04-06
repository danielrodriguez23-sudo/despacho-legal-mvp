import { useEffect, useState } from "react";
import { User as UserIcon, Save, Lock } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string;
  role?: string | null;
  telefono?: string | null;
  created_at?: string | null;
}

export default function Perfil() {
  const { user } = useAuth();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [fullName, setFullName] = useState("");
  const [telefono, setTelefono] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (!error && data) {
        setProfile(data as ProfileRow);
        setFullName(data.full_name ?? "");
        setTelefono((data as any).telefono ?? "");
      }
      setLoading(false);
    })();
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setMsg(null);
    setSaving(true);

    const payload: Record<string, any> = {
      full_name: fullName.trim() || null,
    };
    // Solo incluimos telefono si la columna existe en el profile cargado
    if (profile && "telefono" in profile) {
      payload.telefono = telefono.trim() || null;
    }

    const { error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", user.id);

    if (error) {
      setMsg({ type: "err", text: error.message });
    } else {
      setMsg({ type: "ok", text: "Perfil actualizado correctamente" });
    }
    setSaving(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg(null);

    if (newPwd.length < 6) {
      setPwdMsg({ type: "err", text: "La contraseña debe tener al menos 6 caracteres" });
      return;
    }
    if (newPwd !== newPwd2) {
      setPwdMsg({ type: "err", text: "Las contraseñas no coinciden" });
      return;
    }
    if (!user?.email) {
      setPwdMsg({ type: "err", text: "No se ha podido identificar el usuario" });
      return;
    }

    setPwdSaving(true);

    // Verificar contraseña actual reautenticando
    const { error: reauthErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPwd,
    });
    if (reauthErr) {
      setPwdMsg({ type: "err", text: "La contraseña actual no es correcta" });
      setPwdSaving(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPwd });
    if (error) {
      setPwdMsg({ type: "err", text: error.message });
    } else {
      setPwdMsg({ type: "ok", text: "Contraseña actualizada correctamente" });
      setCurrentPwd("");
      setNewPwd("");
      setNewPwd2("");
    }
    setPwdSaving(false);
  };

  if (loading) {
    return <div className="p-6 text-gray-500">Cargando perfil...</div>;
  }

  const initial = (profile?.full_name || user?.email || "?")
    .charAt(0)
    .toUpperCase();

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mi perfil</h1>
        <p className="text-sm text-gray-600 mt-1">
          Gestiona tu información personal y tu contraseña
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
            {initial}
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-900">
              {profile?.full_name || "Sin nombre"}
            </p>
            <p className="text-sm text-gray-600">{user?.email}</p>
            {profile?.role && (
              <span className="inline-flex mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                {profile.role}
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
            <UserIcon className="w-4 h-4" />
            Información personal
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre completo
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={user?.email ?? ""}
              disabled
              className="w-full px-3 py-2 border border-gray-200 bg-gray-50 text-gray-500 rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">
              Para cambiar el email contacta con el administrador.
            </p>
          </div>

          {profile && "telefono" in profile && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Teléfono
              </label>
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {msg && (
            <div
              className={`px-4 py-3 rounded-lg text-sm ${
                msg.type === "ok"
                  ? "bg-green-50 border border-green-200 text-green-700"
                  : "bg-red-50 border border-red-200 text-red-700"
              }`}
            >
              {msg.text}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-4">
          <Lock className="w-4 h-4" />
          Cambiar contraseña
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contraseña actual
            </label>
            <input
              type="password"
              value={currentPwd}
              onChange={(e) => setCurrentPwd(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nueva contraseña
              </label>
              <input
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Repetir nueva contraseña
              </label>
              <input
                type="password"
                value={newPwd2}
                onChange={(e) => setNewPwd2(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                minLength={6}
              />
            </div>
          </div>

          {pwdMsg && (
            <div
              className={`px-4 py-3 rounded-lg text-sm ${
                pwdMsg.type === "ok"
                  ? "bg-green-50 border border-green-200 text-green-700"
                  : "bg-red-50 border border-red-200 text-red-700"
              }`}
            >
              {pwdMsg.text}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pwdSaving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              <Lock className="w-4 h-4" />
              {pwdSaving ? "Guardando..." : "Cambiar contraseña"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
