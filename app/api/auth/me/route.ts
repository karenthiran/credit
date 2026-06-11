import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
    const user = getAuthUser(request);

    if (!user) {
        return NextResponse.json(
            { success: false, message: "Unauthenticated" },
            { status: 401 }
        );
    }

    return NextResponse.json({
        success: true,
        user,
    });
}