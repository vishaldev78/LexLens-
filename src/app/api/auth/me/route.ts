import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/auth";

export async function GET() {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ user: null }, { status: 200 });
  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      age: user.age,
      createdAt: user.createdAt,
    },
  });
}
