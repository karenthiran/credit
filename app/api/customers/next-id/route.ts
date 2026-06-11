import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
    return NextResponse.json(
        {
            success: false,
            message: "Customer IDs are entered manually during registration",
        },
        { status: 410 },
    );
}