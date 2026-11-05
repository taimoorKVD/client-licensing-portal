import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/env";

export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.next({ request });
  }

  const { url, publishableKey } = getSupabaseEnv();
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value);
        });
      },
    },
  });

  // Verify the JWT. Do not trust getSession(), and do not read user_metadata.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims.sub);
  const path = request.nextUrl.pathname;
  const isLogin = path === "/login" || path.startsWith("/login/");
  const isApi = path.startsWith("/api/");

  if (!signedIn && isApi) {
    const denied = NextResponse.json({ error: "Sign in required." }, { status: 401 });
    copyCookies(supabaseResponse, denied);
    return denied;
  }

  if (!signedIn && !isLogin) {
    return redirectTo(request, supabaseResponse, "/login");
  }

  if (signedIn && isLogin) {
    return redirectTo(request, supabaseResponse, "/");
  }

  return supabaseResponse;
}

function redirectTo(request: NextRequest, supabaseResponse: NextResponse, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  const redirect = NextResponse.redirect(url);
  copyCookies(supabaseResponse, redirect);
  return redirect;
}

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
}
