import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth";

const PUBLIC_PATHS = ["/", "/login"];

function isAssetPath(pathname: string) {
    return (
        pathname.startsWith("/_next/") ||
        pathname === "/favicon.ico" ||
        pathname === "/robots.txt" ||
        pathname === "/sitemap.xml" ||
        pathname.includes(".")
    );
}

function isPublicApiPath(pathname: string) {
    return pathname.startsWith("/api/auth/");
}

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (
        isAssetPath(pathname) ||
        pathname.startsWith("/api") ||
        isPublicApiPath(pathname)
    ) {
        return NextResponse.next();
    }

    const user = getAuthUser(request);

    if (!user) {
        if (PUBLIC_PATHS.includes(pathname)) {
            return NextResponse.next();
        }

        return NextResponse.redirect(new URL("/", request.url));
    }

    if (PUBLIC_PATHS.includes(pathname)) {
        const landingPage = user.role === "admin" ? "/dashboard" : "/collections";
        return NextResponse.redirect(new URL(landingPage, request.url));
    }

    if (user.role === "officer") {
        const officerCanAccessCollections =
            pathname === "/collections" || pathname.startsWith("/collections/");

        if (!officerCanAccessCollections) {
            return NextResponse.redirect(new URL("/collections", request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};