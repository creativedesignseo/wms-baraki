// POST /api/users/create — the admin gives an employee an account.
// In a multi-tenant WMS nobody self-registers into a warehouse: only a
// manager/owner creates accounts, ALWAYS scoped to their own warehouse.
// Role limits: a manager may only create operators; an owner may create any
// role. The warehouse_id is taken from the CREATOR, never from the request.

import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/lib/types";

const ROLES: Role[] = ["operator", "manager", "owner"];

interface CreateBody {
  email: string;
  password: string;
  full_name?: string | null;
  role: Role;
}

export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const creator = ctx.profile.role;
  if (creator !== "manager" && creator !== "owner") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() || "";
  const password = body.password ?? "";
  const fullName = body.full_name?.trim() || null;
  const role = body.role;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Correo no válido" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 6 caracteres" },
      { status: 400 },
    );
  }
  if (!ROLES.includes(role)) {
    return NextResponse.json({ error: "Rol no válido" }, { status: 400 });
  }
  // A manager can ONLY create operators (no self-promotion / no peers/owners).
  if (creator === "manager" && role !== "operator") {
    return NextResponse.json(
      { error: "Un encargado solo puede crear operarios." },
      { status: 403 },
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // admin hands over credentials; no email round-trip
    user_metadata: {
      // warehouse comes from the CREATOR — never the request body.
      warehouse_id: ctx.profile.warehouse_id,
      role,
      full_name: fullName,
    },
  });

  if (error) {
    const dup = /already|registered|exists/i.test(error.message);
    return NextResponse.json(
      { error: dup ? "Ya existe una cuenta con ese correo." : error.message },
      { status: dup ? 409 : 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
