process.env.SPECULIB_DEV = "1";
const { spawn } = require("node:child_process");
const electron = require("electron");
const child = spawn(electron, ["."], { stdio: "inherit", env: process.env });
child.on("exit", (code) => process.exit(code ?? 0));
