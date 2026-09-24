import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims() refreshes an expired session and verifies the JWT locally,
  // instead of getUser()'s Auth round-trip on every single request.
  const { data } = await supabase.auth.getClaims();

  // Guest-only: if no session, sign in anonymously so every visitor has a stable id.
  if (!data?.claims) {
    await supabase.auth.signInAnonymously();
  }

  return response;
}
