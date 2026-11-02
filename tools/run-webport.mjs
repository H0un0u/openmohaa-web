import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = path.join(repoRoot, "web-client");
const mainRoot = path.resolve(process.env.MOHAA_MAIN_DIR || path.join(repoRoot, "main"));
const noOpen = process.argv.includes("--no-open");

function stop(message) {
    console.error(`\n${message}\n`);
    process.exit(1);
}

function ensureFiles() {
    const required = [
        "openmohaa.html",
        "openmohaa.js",
        "openmohaa.wasm",
        "game.wasm",
        "cgame.wasm",
    ];
    const missing = required.filter(name => !fs.existsSync(path.join(webRoot, name)));
    if (missing.length) {
        stop(`The prebuilt browser client is incomplete. Missing: ${missing.join(", ")}`);
    }

    if (!fs.existsSync(mainRoot) || !fs.statSync(mainRoot).isDirectory()) {
        stop(`Game files were not found at:\n  ${mainRoot}\n\nPut your own Allied Assault game data in the repository's main/ folder, or set MOHAA_MAIN_DIR to its folder.`);
    }

    const archives = fs.readdirSync(mainRoot, { withFileTypes: true })
        .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith(".pk3"))
        .map(entry => entry.name)
        .sort((left, right) => left.localeCompare(right));
    if (!archives.some(name => name.toLowerCase() === "pak0.pk3")) {
        stop(`No Pak0.pk3 was found in:\n  ${mainRoot}\n\nPut the game's .pk3 files in main/ and run this launcher again.`);
    }

    return archives;
}

function findAudioPack() {
    const candidates = [
        path.join(webRoot, "sound.pk3"),
        path.join(repoRoot, "build", "web", "Release", "sound.pk3"),
    ];
    const existing = candidates.find(file => fs.existsSync(file) && fs.statSync(file).isFile());
    if (existing) {
        console.log(`Using supplemental game audio: ${path.relative(repoRoot, existing)}`);
        return existing;
    }

    const packer = path.join(repoRoot, "code", "web", "package_audio.py");
    if (!fs.existsSync(packer) || !fs.existsSync(path.join(mainRoot, "sound"))) {
        console.log("No supplemental sound files found; the game will use audio inside the .pk3 files.");
        return null;
    }

    const pythonOptions = [
        ["python", []],
        ["py", ["-3"]],
        ["python3", []],
    ];
    const python = pythonOptions.find(([command, prefix]) => {
        const result = spawnSync(command, [...prefix, "--version"], { stdio: "ignore", windowsHide: true });
        return !result.error && result.status === 0;
    });
    if (!python) {
        console.log("Python was not found, so supplemental loose sounds were skipped. The game will still run with sounds in the .pk3 files.");
        return null;
    }

    const output = path.join(webRoot, "sound.pk3");
    console.log("Preparing the supplemental sound pack from your local game files (first run only)…");
    const [command, prefix] = python;
    const result = spawnSync(command, [
        ...prefix,
        packer,
        "--game-dir", mainRoot,
        "--output", output,
    ], { cwd: repoRoot, stdio: "inherit", windowsHide: true });
    if (result.error || result.status !== 0 || !fs.existsSync(output)) {
        console.log("The supplemental sound pack could not be prepared. The game will still run with sounds in the .pk3 files.");
        return null;
    }
    return output;
}

const archives = ensureFiles();
const audioPack = findAudioPack();
const configFiles = archives.map(name => ({ src: `../main/${name}`, dst: "/main" }));
const mainTheme = path.join(mainRoot, "sound", "music", "mus_MainTheme.mp3");
if (fs.existsSync(mainTheme)) {
    configFiles.push({ src: "../main/sound/music/mus_MainTheme.mp3", dst: "/main/sound/music" });
}
if (audioPack) {
    configFiles.push({ src: "sound.pk3", dst: "/main", audioPack: true });
}
configFiles.push(
    { src: "game.wasm", dst: "/" },
    { src: "cgame.wasm", dst: "/" },
);
const config = Buffer.from(JSON.stringify({ main: { files: configFiles } }, null, 2));

const mimeTypes = new Map([
    [".html", "text/html; charset=utf-8"],
    [".js", "text/javascript; charset=utf-8"],
    [".json", "application/json; charset=utf-8"],
    [".wasm", "application/wasm"],
    [".pk3", "application/octet-stream"],
    [".mp3", "audio/mpeg"],
]);

function sendBuffer(response, body, contentType, method) {
    response.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": body.length,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
    });
    response.end(method === "HEAD" ? undefined : body);
}

function sendFile(response, file, method) {
    fs.stat(file, (error, stats) => {
        if (error || !stats.isFile()) {
            response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            response.end("Not found");
            return;
        }
        response.writeHead(200, {
            "Content-Type": mimeTypes.get(path.extname(file).toLowerCase()) || "application/octet-stream",
            "Content-Length": stats.size,
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        });
        if (method === "HEAD") {
            response.end();
            return;
        }
        const stream = fs.createReadStream(file);
        stream.on("error", () => response.destroy());
        stream.pipe(response);
    });
}

const server = http.createServer((request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405, { Allow: "GET, HEAD" });
        response.end();
        return;
    }

    let pathname;
    try {
        pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    } catch {
        response.writeHead(400);
        response.end();
        return;
    }

    if (pathname === "/" || pathname === "") {
        response.writeHead(302, { Location: "/web-client/openmohaa.html" });
        response.end();
        return;
    }

    const segments = pathname.replaceAll("\\", "/").split("/").filter(Boolean);
    const area = segments.shift();
    const relativePath = segments.join(path.sep);
    if (segments.some(segment => segment === "." || segment === "..")) {
        response.writeHead(403);
        response.end();
        return;
    }

    if (area === "web-client" && relativePath === "openmohaa-config.json") {
        sendBuffer(response, config, "application/json; charset=utf-8", request.method);
        return;
    }
    if (area === "web-client" && relativePath === "sound.pk3" && audioPack) {
        sendFile(response, audioPack, request.method);
        return;
    }

    const base = area === "web-client" ? webRoot : area === "main" ? mainRoot : null;
    if (!base) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
    }
    const file = path.resolve(base, relativePath);
    const relative = path.relative(base, file);
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        response.writeHead(403);
        response.end();
        return;
    }
    sendFile(response, file, request.method);
});

server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    const url = `http://127.0.0.1:${address.port}/web-client/openmohaa.html`;
    console.log(`OpenMoHAA Web Port is running at ${url}`);
    console.log("This server is available only on this PC. Keep this window open; press Ctrl+C to stop it.");

    if (!noOpen && process.platform === "win32") {
        const opener = spawn("cmd.exe", ["/c", "start", "", url], { detached: true, stdio: "ignore", windowsHide: true });
        opener.on("error", () => console.log(`Open this address in your browser: ${url}`));
        opener.unref();
    } else if (!noOpen) {
        console.log(`Open this address in your browser: ${url}`);
    }
});
