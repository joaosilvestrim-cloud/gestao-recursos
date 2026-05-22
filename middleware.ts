import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { canAccess, getDefaultRoute, type Role } from '@/lib/auth/roles';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths — never intercept
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next({ request });
  }

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
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — required to keep cookies fresh
  const { data: { user } } = await supabase.auth.getUser();

  // Not authenticated → redirect to login
  if (!user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Get role from user_metadata (set when admin creates the user)
  const role = (user.user_metadata?.role ?? 'collaborator') as Role;

  // Root path → redirect to default page for this role
  if (pathname === '/') {
    return NextResponse.redirect(new URL(getDefaultRoute(role), request.url));
  }

  // Check if user has permission for this route
  if (!canAccess(pathname, role)) {
    // Redirect to their default page with a query flag
    const defaultRoute = new URL(getDefaultRoute(role), request.url);
    defaultRoute.searchParams.set('error', 'forbidden');
    return NextResponse.redirect(defaultRoute);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
