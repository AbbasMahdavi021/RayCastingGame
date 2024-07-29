const { spawn } = require("child_process");
const { WebSocketServer } = require("ws");
const { watchFile } = require("fs");
const path = require("path");

function cmd(program, args) {
  const spawnOptions = { shell: true };
  console.log("CMD:", program, args.flat(), spawnOptions);
  const p = spawn(program, args.flat(), spawnOptions);
  p.stdout.on("data", (data) => process.stdout.write(data));
  p.stderr.on("data", (data) => process.stderr.write(data));
  p.on("close", (code) => {
    if (code !== 0) {
      console.error(program, args, "exited with", code);
    }
  });
  return p;
}

cmd("tsc", ["-w"]);
cmd("http-server", ["-p", "3000", "-a", "127.0.0.1", "-s", "-c-1"]);

const wss = new WebSocketServer({
  port: 8080,
});

const webSockets = [];

wss.on("connection", (ws) => {
  webSockets.push(ws);
  ws.on("close", () => {
    webSockets.splice(webSockets.indexOf(ws), 1);
  });
});

const FILES_TO_WATCH = ["index.html", "index.js"];

FILES_TO_WATCH.forEach((file) =>
  watchFile(path.join(__dirname, file), { interval: 50 }, () => {
    webSockets.forEach((socket) => socket.send("reload"));
    console.log("Reload");
  })
);
