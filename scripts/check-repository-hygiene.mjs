import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const files = execFileSync(
  "git",
  ["ls-files", "-co", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);

const forbiddenPathParts = [
  "node_modules/",
  ".next/",
  "out/",
  "coverage/",
  "playwright-report/",
  "test-results/",
  "supabase/.temp/",
];

const pathProblems = files.filter(
  (file) =>
    file === ".env" ||
    (file.startsWith(".env.") && file !== ".env.example") ||
    file.endsWith(".log") ||
    file.endsWith(".tsbuildinfo") ||
    forbiddenPathParts.some(
      (part) => file.startsWith(part) || file.includes(`/${part}`),
    ),
);

const secretPatterns = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bsb_secret_[A-Za-z0-9_-]{16,}\b/,
  /\beyJhbGciOiJ[A-Za-z0-9_-]{16,}\b/,
];
const emailPattern = /[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/gi;
const contentProblems = [];

for (const file of files) {
  // Tracked files deleted in the working tree have nothing left to check.
  if (!existsSync(file)) continue;
  const contents = readFileSync(file);
  if (contents.includes(0)) continue;

  const text = contents.toString("utf8");
  if (secretPatterns.some((pattern) => pattern.test(text))) {
    contentProblems.push(`${file}: posible secreto literal`);
  }

  for (const match of text.matchAll(emailPattern)) {
    if (!["example.test", "stepable.local"].includes(match[1].toLowerCase())) {
      contentProblems.push(`${file}: correo fuera del dominio reservado`);
      break;
    }
  }
}

const problems = [
  ...pathProblems.map((file) => `${file}: archivo local o generado`),
  ...contentProblems,
];

if (problems.length > 0) {
  console.error("La revisión de higiene del repositorio encontró problemas:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log(
    `Higiene del repositorio correcta: ${files.length} archivos versionados o versionables revisados.`,
  );
}
