import type { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export const AUTH_COOKIE_NAME = "loanflow_session";

export type UserRole = "admin" | "officer";

export type AuthUser = {
    id: string;
    username: string;
    role: UserRole;
};

type AuthTokenPayload = jwt.JwtPayload & {
    username: string;
    role: UserRole;
};

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error("JWT_SECRET is not configured");
    }

    return secret;
}

export function normalizeUsername(username: string) {
    return username.trim();
}

export function signAuthToken(user: AuthUser) {
    return jwt.sign(
        {
            username: user.username,
            role: user.role,
        },
        getJwtSecret(),
        {
            subject: user.id,
            expiresIn: "7d",
        }
    );
}

export function verifyAuthToken(token: string): AuthUser {
    const payload = jwt.verify(token, getJwtSecret()) as AuthTokenPayload;

    if (!payload.sub || !payload.username || !payload.role) {
        throw new Error("Invalid auth token");
    }

    return {
        id: payload.sub,
        username: payload.username,
        role: payload.role,
    };
}

export function getAuthUser(request: NextRequest): AuthUser | null {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

    if (!token) {
        return null;
    }

    try {
        return verifyAuthToken(token);
    } catch {
        return null;
    }
}

export function setAuthCookie(response: NextResponse, token: string) {
    response.cookies.set(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
    });
}

export function clearAuthCookie(response: NextResponse) {
    response.cookies.set(AUTH_COOKIE_NAME, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0,
    });
}