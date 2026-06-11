import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

import { connectToDb } from "@/lib/dbConnect";
import {
    normalizeUsername,
    setAuthCookie,
    signAuthToken,
} from "@/lib/auth";
import { User } from "@/lib/model/userModel";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => null);
        const username = normalizeUsername(
            String(body?.username ?? body?.name ?? "")
        );
        const password = String(body?.password ?? "");

        if (!username || !password) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Username and password are required",
                },
                { status: 400 }
            );
        }

        await connectToDb();

        const user = await User.findOne({ username });

        if (!user) {
            return NextResponse.json(
                { success: false, message: "Invalid credentials" },
                { status: 401 }
            );
        }

        if (typeof user.password !== "string" || !user.password) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Account password is not set. Please reset the account.",
                },
                { status: 401 }
            );
        }

        const passwordMatches = await bcrypt.compare(password, user.password);

        if (!passwordMatches) {
            return NextResponse.json(
                { success: false, message: "Invalid credentials" },
                { status: 401 }
            );
        }

        const token = signAuthToken({
            id: user._id.toString(),
            username: user.username,
            role: user.role,
        });

        const response = NextResponse.json({
            success: true,
            message: "Login successful",
            user: {
                id: user._id.toString(),
                username: user.username,
                role: user.role,
            },
        });

        setAuthCookie(response, token);

        return response;
    } catch (error) {
        console.error("Login error:", error);

        return NextResponse.json(
            { success: false, message: "Login failed" },
            { status: 500 }
        );
    }
}