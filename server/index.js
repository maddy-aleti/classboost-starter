// server/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const lastSnapshots = new Map(); // tabId/userId -> {raw, ts}
let classSmoothed = 0;

io.on('connection', socket => {
  console.log('client connected', socket.id);
  socket.on('engagementSnapshot', ({ senderTabId, snapshot }) => {
    const key = senderTabId || socket.id;
    lastSnapshots.set(key, { raw: snapshot.raw, ts: Date.now() });
    computeAndEmit();
  });
});

app.post('/api/snapshot', (req, res) => {
  const snapshot = req.body.snapshot;
  lastSnapshots.set('http:'+Date.now(), { raw: snapshot.raw, ts: Date.now() });
  computeAndEmit();
  res.json({ ok:true });
});

app.get('/api/classScore', (req, res) => {
  res.json({ classScore: classSmoothed });
});


function computeAndEmit() {
  // keep only recent (last 60s)
  const now = Date.now();
  const values = Array.from(lastSnapshots.values()).filter(s => now - s.ts < 60000).map(s => s.raw);
  const rawClass = values.length ? values.reduce((a,b)=>a+b,0)/values.length : 0;
  // EMA smoothing
  const alpha = 0.2;
  classSmoothed = alpha * rawClass + (1-alpha) * classSmoothed;
  // broadcast to all connected sockets
  io.emit('engagementUpdate', { classScore: classSmoothed });
}

const PORT = process.env.PORT || 3000;

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Start the server with a different PORT or free the port.`);
    process.exit(1);
  }
  console.error('Server error', err);
  process.exit(1);
});

server.listen(PORT, ()=> console.log(`server listening ${PORT}`));
