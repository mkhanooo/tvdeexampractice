// Minimal local server: serves the app's static files and persists question
// edits straight to questions.js / questions.json on disk. No browser storage
// is involved — GET /api/questions always reads fresh from disk, and
// POST /api/questions overwrites both files.
"use strict";

var http = require("http");
var fs = require("fs");
var path = require("path");

var ROOT = __dirname;
var PORT = process.env.PORT || 8080;

var MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function sendJson(res, status, obj){
  var body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function questionsToJs(questions){
  return "// Auto-generated question data. Edit via Manage Questions in the app.\n" +
    "window.TVDE_QUESTIONS = " + JSON.stringify(questions, null, 2) + ";\n";
}

function readBody(req){
  return new Promise(function(resolve, reject){
    var chunks = [];
    var size = 0;
    req.on("data", function(chunk){
      size += chunk.length;
      if(size > 20 * 1024 * 1024){ reject(new Error("Payload too large")); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on("end", function(){ resolve(Buffer.concat(chunks).toString("utf8")); });
    req.on("error", reject);
  });
}

function validateQuestions(data){
  if(!Array.isArray(data)) throw new Error("Expected an array of questions");
  data.forEach(function(q, i){
    if(!q || typeof q !== "object") throw new Error("Question " + i + " is not an object");
    if(typeof q.id !== "number") throw new Error("Question " + i + " is missing a numeric id");
    if(typeof q.text !== "string" || !q.text.trim()) throw new Error("Question " + i + " is missing text");
    if(!Array.isArray(q.options) || q.options.length < 2) throw new Error("Question " + i + " needs at least 2 options");
    if(typeof q.correctIndex !== "number" || q.correctIndex < 0 || q.correctIndex >= q.options.length){
      throw new Error("Question " + i + " has an invalid correctIndex");
    }
  });
}

function handleApi(req, res, pathname){
  if(pathname !== "/api/questions") return false;

  if(req.method === "GET"){
    fs.readFile(path.join(ROOT, "questions.json"), "utf8", function(err, raw){
      if(err){ sendJson(res, 500, { error: "Could not read questions.json: " + err.message }); return; }
      if(raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1); // strip BOM if present
      try{ sendJson(res, 200, JSON.parse(raw)); }
      catch(e){ sendJson(res, 500, { error: "questions.json is not valid JSON: " + e.message }); }
    });
    return true;
  }

  if(req.method === "POST"){
    readBody(req).then(function(body){
      var data;
      try{ data = JSON.parse(body); }
      catch(e){ sendJson(res, 400, { error: "Invalid JSON body" }); return; }

      try{ validateQuestions(data); }
      catch(e){ sendJson(res, 400, { error: e.message }); return; }

      var json = JSON.stringify(data, null, 2) + "\n";
      var js = questionsToJs(data);
      fs.writeFile(path.join(ROOT, "questions.json"), json, "utf8", function(err1){
        if(err1){ sendJson(res, 500, { error: "Could not write questions.json: " + err1.message }); return; }
        fs.writeFile(path.join(ROOT, "questions.js"), js, "utf8", function(err2){
          if(err2){ sendJson(res, 500, { error: "Could not write questions.js: " + err2.message }); return; }
          sendJson(res, 200, { ok: true });
        });
      });
    }).catch(function(e){
      sendJson(res, 400, { error: e.message });
    });
    return true;
  }

  sendJson(res, 405, { error: "Method not allowed" });
  return true;
}

function serveStatic(req, res, pathname){
  var rel = pathname === "/" ? "/index.html" : pathname;
  rel = path.normalize(rel).replace(/^(\.\.[\/\\])+/, "");
  var abs = path.join(ROOT, rel);
  if(!abs.startsWith(ROOT)){ res.writeHead(403); res.end("Forbidden"); return; }

  fs.readFile(abs, function(err, content){
    if(err){ res.writeHead(404, { "Content-Type": "text/plain" }); res.end("Not found"); return; }
    var ext = path.extname(abs).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(content);
  });
}

var server = http.createServer(function(req, res){
  var pathname;
  try{ pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname); }
  catch(e){ res.writeHead(400); res.end("Bad request"); return; }

  if(handleApi(req, res, pathname)) return;
  serveStatic(req, res, pathname);
});

server.listen(PORT, function(){
  console.log("TVDE Exam Practice running at http://localhost:" + PORT);
  console.log("Question edits in Manage Questions now save straight to questions.js / questions.json on disk.");
});
