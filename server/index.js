// server/index.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const lastSnapshots = new Map(); // tabId/userId -> {raw, ts}
let classSmoothed = 0;

io.on("connection", (socket) => {
  console.log("client connected", socket.id);
  socket.on("engagementSnapshot", ({ senderTabId, snapshot }) => {
    const key = senderTabId || socket.id;
    lastSnapshots.set(key, { raw: snapshot.raw, ts: Date.now() });
    computeAndEmit();
  });
});

app.post("/api/snapshot", (req, res) => {
  const snapshot = req.body.snapshot;
  lastSnapshots.set("http:" + Date.now(), {
    raw: snapshot.raw,
    ts: Date.now(),
  });
  computeAndEmit();
  res.json({ ok: true });
});

app.get("/api/classScore", (req, res) => {
  res.json({ classScore: classSmoothed });
});

// GIF search endpoint using Google Custom Search API
app.get("/api/searchGif", async (req, res) => {
  try {
    const topic = req.query.topic;
    console.log("[searchGif] Received request for topic:", topic);

    if (!topic) {
      console.warn("[searchGif] No topic provided");
      return res.status(400).json({ error: "Topic is required" });
    }

    // Google Custom Search API requires:
    // 1. API Key: Get from https://console.developers.google.com/
    // 2. Search Engine ID: Get from https://cse.google.com/cse/
    const API_KEY = process.env.GOOGLE_API_KEY || "YOUR_GOOGLE_API_KEY";
    const SEARCH_ENGINE_ID =
      process.env.GOOGLE_SEARCH_ENGINE_ID || "YOUR_SEARCH_ENGINE_ID";

    console.log("[searchGif] Using API Key:", API_KEY.substring(0, 10) + "...");
    console.log("[searchGif] Using Search Engine ID:", SEARCH_ENGINE_ID);

    // Search query: topic + gif
    const searchQuery = `${topic} gif animated`;
    const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(
      searchQuery
    )}&cx=${SEARCH_ENGINE_ID}&key=${API_KEY}&searchType=image&num=1`;

    console.log(
      "[searchGif] Calling Google API with URL:",
      url.substring(0, 100) + "..."
    );

    const response = await fetch(url);
    const data = await response.json();

    console.log(
      "[searchGif] Google API response:",
      data.error
        ? data.error
        : "Success, items: " + (data.items ? data.items.length : 0)
    );

    if (data.items && data.items.length > 0) {
      const gifUrl = data.items[0].link;
      console.log("[searchGif] Found GIF URL:", gifUrl);
      return res.json({ ok: true, gifUrl, topic });
    } else {
      console.warn("[searchGif] No GIF found for topic:", topic);
      return res.json({ ok: false, error: "No GIF found", topic });
    }
  } catch (err) {
    console.error("[searchGif] Error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

function computeAndEmit() {
  // keep only recent (last 60s)
  const now = Date.now();
  const values = Array.from(lastSnapshots.values())
    .filter((s) => now - s.ts < 60000)
    .map((s) => s.raw);
  const rawClass = values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : 0;
  // EMA smoothing
  const alpha = 0.2;
  classSmoothed = alpha * rawClass + (1 - alpha) * classSmoothed;
  // broadcast to all connected sockets
  io.emit("engagementUpdate", { classScore: classSmoothed });
}

const PORT = process.env.PORT || 3000;

server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. Start the server with a different PORT or free the port.`
    );
    process.exit(1);
  }
  console.error("Server error", err);
  process.exit(1);
});

server.listen(PORT, () => console.log(`server listening ${PORT}`));
