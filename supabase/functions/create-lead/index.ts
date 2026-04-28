import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://emiliorojasabogadosmadrid.es",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Método no permitido" }),
      { status: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const { nombre, email, telefono, mensaje } = body;

    // Validar campos requeridos
    if (!nombre || typeof nombre !== "string" || nombre.trim() === "") {
      return new Response(
        JSON.stringify({ error: "El nombre es obligatorio" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }
    if (!email || typeof email !== "string" || email.trim() === "") {
      return new Response(
        JSON.stringify({ error: "El email es obligatorio" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      return new Response(
        JSON.stringify({ error: "El formato del email no es válido" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }
    if (!mensaje || typeof mensaje !== "string" || mensaje.trim() === "") {
      return new Response(
        JSON.stringify({ error: "El mensaje es obligatorio" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Crear cliente Supabase con Service Role Key (bypass RLS)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from("leads")
      .insert({
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        telefono: telefono?.trim() || null,
        mensaje: mensaje.trim(),
        asunto: "Contacto desde web",
        estado: "nuevo",
        origen: "web",
        fecha_contacto: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.error("[create-lead] Error al insertar en Supabase:", error);
      return new Response(
        JSON.stringify({ error: "Error interno del servidor" }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    console.log(`[create-lead] Lead creado correctamente. ID: ${data.id} | Email: ${email.trim()}`);

    return new Response(
      JSON.stringify({ success: true, lead_id: data.id }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[create-lead] Error inesperado:", err);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
