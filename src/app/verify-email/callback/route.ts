import { NextResponse, type NextRequest } from "next/server";
import { verificationDestination } from "@/lib/auth-policy";
import { configuredAuthOrigin } from "@/lib/auth-options";
export function GET(request: NextRequest) {
 const params = request.nextUrl.searchParams;
 const origin = configuredAuthOrigin(process.env.NODE_ENV === "production", process.env.BETTER_AUTH_URL);
 const response = NextResponse.redirect(new URL(verificationDestination(params.get("error") || undefined, params.get("context") || undefined), origin));
 response.headers.set("Cache-Control", "no-store");
 response.headers.set("Referrer-Policy", "no-referrer");
 return response;
}
