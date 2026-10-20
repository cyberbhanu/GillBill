import bcrypt from "bcryptjs";

if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
  console.error("Run this command in an interactive terminal: pnpm admin:hash-password");
  process.exit(1);
}

let password = "";
let finished = false;
process.stdout.write("Enter a new super-admin password (12+ characters): ");
process.stdin.setRawMode(true);
process.stdin.resume();

process.stdin.on("data", async (buffer) => {
  if (finished) return;
  const input = buffer.toString("utf8");
  for (const char of input) {
    if (char === "\u0003") {
      finished = true;
      process.stdin.setRawMode(false);
      process.stdout.write("\nCancelled.\n");
      process.exit(130);
    }
    if (char === "\r" || char === "\n") {
      if (password.length < 12) {
        process.stdout.write("\nPassword must be at least 12 characters. Try again: ");
        password = "";
        continue;
      }
      finished = true;
      process.stdin.setRawMode(false);
      process.stdin.pause();
      const hash = await bcrypt.hash(password, 12);
      password = "";
      process.stdout.write(`\nSUPER_ADMIN_PASSWORD_HASH=${hash}\n`);
      process.stdout.write("Copy the hash value into your hosting environment variables. The password itself is not saved.\n");
      process.exit(0);
    }
    if (char === "\u007f" || char === "\b") {
      password = password.slice(0, -1);
      continue;
    }
    if (char >= " ") password += char;
  }
});
