import { NextResponse, type NextRequest } from "next/server";
import { verificationDestination } from "@/lib/auth-policy";
export function GET(request: NextRequest) {
 const params = request.nextUrl.searchParams;
 const response = NextResponse.redirect(new URL(verificationDestination(params.get("error") || undefined, params.get("context") || undefined), request.url));
 response.headers.set("Cache-Control", "no-store");
 response.headers.set("Referrer-Policy", "no-referrer");
 return response;
}
