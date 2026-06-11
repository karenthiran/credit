import "dotenv/config";

import bcrypt from "bcryptjs";

import { connectToDb } from "../lib/dbConnect";
import { normalizeUsername } from "../lib/auth";
import { User } from "../lib/model/userModel";

async function main() {
    const usernameArg = process.argv[2];
    const passwordArg = process.argv[3];

    if (!usernameArg || !passwordArg) {
        console.error("Usage: npm run seed:admin -- <username> <password>");
        process.exit(1);
    }

    const username = normalizeUsername(usernameArg);
    const password = await bcrypt.hash(passwordArg, 12);

    await connectToDb();

    await User.findOneAndUpdate(
        { username },
        {
            username,
            password,
            role: "admin",
        },
        {
            upsert: true,
            returnDocument: "after",
            setDefaultsOnInsert: true,
        }
    );

    console.log(`Admin user ready: ${username}`);
}

main().catch((error) => {
    console.error("Admin bootstrap failed:", error);
    process.exit(1);
});