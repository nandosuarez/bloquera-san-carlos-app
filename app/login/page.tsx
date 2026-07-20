import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { SubmitButton } from "@/components/submit-button";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  inactive_user: "Este usuario esta inactivo.",
  invalid_credentials: "El usuario o la clave no coinciden.",
  missing_fields: "Escribe tu usuario y tu clave para continuar.",
  server_error: "No fue posible validar el acceso."
};

const successMessages: Record<string, string> = {
  signed_out: "La sesion se cerro correctamente."
};

type LoginPageProps = {
  searchParams?: {
    error?: string;
    success?: string;
  };
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  const session = verifySessionToken(
    cookies().get(SESSION_COOKIE_NAME)?.value ?? null
  );

  if (session) {
    redirect("/inicio");
  }

  const errorMessage = searchParams?.error
    ? errorMessages[searchParams.error] ?? "Ocurrio un error inesperado."
    : null;

  const successMessage = searchParams?.success
    ? successMessages[searchParams.success] ?? null
    : null;

  return (
    <main className="login-screen">
      <section className="login-panel login-panel-centered">
        <div className="login-card login-card-compact">
          <div className="login-brand">
            <BrandLogo />
            <span className="card-kicker">Bloquera San Carlos</span>
            <h1>Iniciar sesion</h1>
          </div>

          {errorMessage ? (
            <div className="message message-error">{errorMessage}</div>
          ) : null}

          {successMessage ? (
            <div className="message message-success">{successMessage}</div>
          ) : null}

          <form action="/api/auth/login" className="login-form" method="post">
            <label className="field">
              <span>Usuario</span>
              <input
                autoComplete="username"
                name="username"
                placeholder="admin"
                required
                type="text"
              />
            </label>

            <label className="field">
              <span>Clave</span>
              <input
                autoComplete="current-password"
                name="password"
                placeholder="Tu clave"
                required
                type="password"
              />
            </label>

            <SubmitButton>Ingresar</SubmitButton>
          </form>
        </div>
      </section>
    </main>
  );
}
