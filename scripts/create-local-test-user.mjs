import process from "node:process";
import { createInterface } from "node:readline/promises";

import { createClient } from "@supabase/supabase-js";

import { readLocalSupabaseStatus } from "./local-supabase-status.mjs";

async function readSecret(label) {
  if (!process.stdin.isTTY) {
    throw new Error(
      "La contraseña debe capturarse desde una terminal interactiva.",
    );
  }

  process.stdout.write(label);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  return new Promise((resolve, reject) => {
    let value = "";
    const onData = (character) => {
      if (character === "\u0003") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        reject(new Error("Operación cancelada."));
        return;
      }
      if (character === "\r" || character === "\n") {
        process.stdin.off("data", onData);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdout.write("\n");
        resolve(value);
        return;
      }
      if (character === "\u007f") {
        value = value.slice(0, -1);
        return;
      }
      value += character;
    };
    process.stdin.on("data", onData);
  });
}

const status = readLocalSupabaseStatus();
const reader = createInterface({
  input: process.stdin,
  output: process.stdout,
});
const email = (await reader.question("Correo local del usuario de prueba: "))
  .trim()
  .toLowerCase();
reader.close();

const password = await readSecret("Contraseña (mínimo 8 caracteres): ");
const confirmation = await readSecret("Confirma la contraseña: ");

if (!email.includes("@") || password.length < 8 || password !== confirmation) {
  throw new Error("Correo inválido o contraseñas distintas/demasiado cortas.");
}

const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (error) {
  throw new Error(`No fue posible crear el usuario local: ${error.message}`);
}

console.log(
  "Usuario local creado. No se asignaron espacios, membresías ni roles de producto.",
);
