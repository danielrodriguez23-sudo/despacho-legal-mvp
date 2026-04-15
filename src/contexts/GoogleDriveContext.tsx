import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { GoogleOAuthProvider, useGoogleLogin } from "@react-oauth/google";
import { saveToken, getToken, clearToken, isAuthenticated as checkAuth } from "../utils/googleDrive";

interface GoogleDriveContextType {
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
}

const GoogleDriveContext = createContext<GoogleDriveContextType>({
  isConnected: false,
  connect: () => {},
  disconnect: () => {},
});

export const useGoogleDrive = () => useContext(GoogleDriveContext);

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

function GoogleDriveInner({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(checkAuth());

  // Verificar token al montar y cuando cambia el storage
  useEffect(() => {
    const check = () => setIsConnected(checkAuth());
    check();
    window.addEventListener("storage", check);
    // Verificar cada minuto por si expira
    const iv = setInterval(check, 60_000);
    return () => {
      window.removeEventListener("storage", check);
      clearInterval(iv);
    };
  }, []);

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      saveToken(tokenResponse.access_token, tokenResponse.expires_in);
      setIsConnected(true);
    },
    onError: (err) => {
      console.error("[GoogleDrive] Login error:", err);
    },
    scope: "https://www.googleapis.com/auth/drive",
  });

  const connect = useCallback(() => login(), [login]);

  const disconnect = useCallback(() => {
    const token = getToken();
    if (token) {
      // Revocar token en Google
      fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, {
        method: "POST",
      }).catch(() => {});
    }
    clearToken();
    setIsConnected(false);
  }, []);

  return (
    <GoogleDriveContext.Provider value={{ isConnected, connect, disconnect }}>
      {children}
    </GoogleDriveContext.Provider>
  );
}

export function GoogleDriveProvider({ children }: { children: ReactNode }) {
  if (!CLIENT_ID) {
    // Sin Client ID configurado, proveer contexto vacío
    return (
      <GoogleDriveContext.Provider
        value={{ isConnected: false, connect: () => {}, disconnect: () => {} }}
      >
        {children}
      </GoogleDriveContext.Provider>
    );
  }

  return (
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <GoogleDriveInner>{children}</GoogleDriveInner>
    </GoogleOAuthProvider>
  );
}
