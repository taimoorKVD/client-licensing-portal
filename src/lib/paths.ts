/**
 * The public marketing site stays at `/`.
 * The signed-in application, including sign-in and authenticator steps, is under `/app`.
 */

export const APP_HOME = "/app" as const;
export const LOGIN_PATH = "/app/login" as const;
export const LOGIN_END_PATH = "/app/login/end" as const;
export const MFA_ENROLL_PATH = "/app/login/mfa/enroll" as const;
export const MFA_CHALLENGE_PATH = "/app/login/mfa/challenge" as const;

/** True for the application and its sign-in routes. The marketing site is everything else. */
export function isAppPath(pathname: string): boolean {
  return pathname === APP_HOME || pathname.startsWith(`${APP_HOME}/`);
}

/** Prefix an application path. `appPath("/licenses")` is `/app/licenses`. */
export function appPath(path: string = "/"): string {
  if (path === "" || path === "/") return APP_HOME;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${APP_HOME}${suffix}`;
}

/** Routes that must render without a session. Legacy `/login` is included so the redirect can run. */
export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname === LOGIN_PATH || pathname.startsWith(`${LOGIN_PATH}/`)) return true;
  if (pathname === "/login" || pathname.startsWith("/login/")) return true;
  return false;
}

/** Old sign-in bookmarks. `/login/mfa/enroll` becomes `/app/login/mfa/enroll`. */
export function legacyLoginPath(pathname: string): string | null {
  if (pathname === "/login") return LOGIN_PATH;
  if (pathname.startsWith("/login/")) return `${APP_HOME}${pathname}`;
  return null;
}
