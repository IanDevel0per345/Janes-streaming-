import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default async function proxy(request: NextRequest) {
  const response = NextResponse.next();

  // Permissive CSP for all embed providers and DLNA
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https: http:",
    "font-src 'self' data:",
    "connect-src 'self' https: http: ws: wss: localhost:3005",
    "media-src 'self' blob: https: http:",
    "frame-src *",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors *",
  ].join("; ");
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Frame-Options", "SAMEORIGIN");

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|manifest.webmanifest|sw.js|.*\\.(?:png|svg|ico|jpg|jpeg|gif|webp|avif|css|js|map|txt|xml)$).*)",
  ],
};
