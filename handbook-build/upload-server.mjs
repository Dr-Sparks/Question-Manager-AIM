// Local screenshot-grabber. Catches multipart uploads from a one-page form
// and writes the bytes to handbook-build/testportal/screenshots/<name>.
// The page also auto-submits when a file is chosen, so Chrome MCP's
// upload_image (which only populates a file input) ends up posting bytes.
//
// Run: node handbook-build/upload-server.mjs
// Stop: Ctrl-C, or kill via pid file written to /tmp/aim-upload-server.pid

import http from "node:http";
import fs from "node:fs/promises";
import { writeFileSync } from "node:fs";
import path from "node:path";

const PORT = 9999;
const OUT_DIR = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "testportal/screenshots"
);

await fs.mkdir(OUT_DIR, { recursive: true });
writeFileSync("/tmp/aim-upload-server.pid", String(process.pid));

// Stupid-simple multipart parser for image uploads with one file field.
// Looks for the file part and writes its body to disk.
function parseFilenameFromBoundary(buf, boundary) {
  const text = buf.toString("latin1"); // bytes-safe ASCII view
  const filenameMatch = text.match(/filename="([^"]+)"/);
  return filenameMatch ? filenameMatch[1] : "upload.png";
}

function extractFileBytes(buf, boundary) {
  // Body layout: --boundary\r\nheaders\r\n\r\nfileBytes\r\n--boundary--
  const boundaryBytes = Buffer.from(`--${boundary}`);
  const startIdx = buf.indexOf(boundaryBytes);
  if (startIdx < 0) return null;
  // Skip past headers (find double CRLF after the boundary)
  const headerEnd = buf.indexOf(Buffer.from("\r\n\r\n"), startIdx);
  if (headerEnd < 0) return null;
  const bodyStart = headerEnd + 4;
  // End of file body = next boundary
  const bodyEnd = buf.indexOf(boundaryBytes, bodyStart);
  if (bodyEnd < 0) return null;
  // Trim the trailing CRLF before the boundary
  return buf.subarray(bodyStart, bodyEnd - 2);
}

const PAGE = `<!doctype html>
<html><body style="font-family: -apple-system, sans-serif; padding: 24px;">
  <h2>Screenshot Upload Sink</h2>
  <p>Used by the handbook-build pipeline. Page auto-submits on file pick.</p>
  <form id="f" enctype="multipart/form-data" method="POST" action="/save">
    <input id="filename" name="filename" placeholder="filename without extension" value="step"/>
    <input id="file" type="file" name="file" accept="image/*"/>
  </form>
  <pre id="out"></pre>
  <script>
    const f = document.getElementById('f');
    const file = document.getElementById('file');
    const fn = document.getElementById('filename');
    const out = document.getElementById('out');
    file.addEventListener('change', () => {
      if (file.files.length === 0) return;
      const fd = new FormData(f);
      fetch('/save?name=' + encodeURIComponent(fn.value || 'step'), { method: 'POST', body: fd })
        .then(r => r.text()).then(t => out.textContent = t);
    });
    // Convenience: allow external code to set the filename via URL hash
    if (location.hash) fn.value = decodeURIComponent(location.hash.slice(1));
  </script>
</body></html>`;

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && (req.url === "/" || req.url.startsWith("/?"))) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(PAGE);
    return;
  }
  if (req.method === "POST" && req.url.startsWith("/save")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    let nameHint = url.searchParams.get("name") || "step";
    nameHint = nameHint.replace(/[^a-zA-Z0-9_-]/g, "_");

    const ctype = req.headers["content-type"] || "";
    const boundaryMatch = ctype.match(/boundary=(.+)$/);
    if (!boundaryMatch) {
      res.writeHead(400);
      res.end("missing boundary");
      return;
    }
    const boundary = boundaryMatch[1];
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const buf = Buffer.concat(chunks);
    const filename = parseFilenameFromBoundary(buf, boundary);
    const fileBytes = extractFileBytes(buf, boundary);
    if (!fileBytes) {
      res.writeHead(400);
      res.end("no file in upload");
      return;
    }
    const ext = path.extname(filename) || ".png";
    const outFile = path.join(OUT_DIR, `${nameHint}${ext}`);
    await fs.writeFile(outFile, fileBytes);
    const stats = await fs.stat(outFile);
    console.log(`[upload-server] saved ${outFile} (${stats.size} bytes)`);
    res.writeHead(200, { "content-type": "text/plain" });
    res.end(`saved ${outFile} (${stats.size} bytes)\n`);
    return;
  }
  res.writeHead(404);
  res.end("not found");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[upload-server] listening on http://127.0.0.1:${PORT} -> ${OUT_DIR}`);
});
