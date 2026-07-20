import { verifyPassword } from "@/lib/passwords";
import { redirectTo } from "@/lib/redirects";
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
  getSessionCookieOptions
} from "@/lib/session";
import { findUserByUsername } from "@/lib/users";

function redirectWithQuery(request: Request, query: string) {
  return redirectTo(request, `/login?${query}`);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const username = formData.get("username");
  const password = formData.get("password");

  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    !username.trim() ||
    !password.trim()
  ) {
    return redirectWithQuery(request, "error=missing_fields");
  }

  try {
    const user = await findUserByUsername(username);

    if (!user) {
      return redirectWithQuery(request, "error=invalid_credentials");
    }

    if (!user.isActive) {
      return redirectWithQuery(request, "error=inactive_user");
    }

    const passwordMatches = await verifyPassword(password, user.passwordHash);

    if (!passwordMatches) {
      return redirectWithQuery(request, "error=invalid_credentials");
    }

    const response = redirectTo(request, "/inicio");

    response.cookies.set(
      SESSION_COOKIE_NAME,
      createSessionToken({
        email: user.email,
        name: user.name,
        role: user.role,
        userId: user.id
      }),
      getSessionCookieOptions()
    );

    return response;
  } catch (error) {
    console.error("Error during login", error);
    return redirectWithQuery(request, "error=server_error");
  }
}
