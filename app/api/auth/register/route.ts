import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/app/lib/db";

// bcrypt hashing at cost-factor 12 takes ~250ms; give the function room.
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, password } = body as {
    name?: string;
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const existing = await db.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists." },
      { status: 409 }
    );
  }

  const hashed = await bcrypt.hash(password, 12);

  const user = await db.user.create({
    data: {
      email: email.toLowerCase().trim(),
      password: hashed,
      name: name?.trim() || null,
    },
  });

  return NextResponse.json(
    { id: user.id, email: user.email },
    { status: 201 }
  );
}
