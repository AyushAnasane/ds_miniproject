const express = require("express");
const path = require("path");
const { Pool } = require("pg");
const { SinglyLinkedList, Stack, CircularQueue, BinarySearchTree, HashTable, mergeSort, binarySearch } = require("./data-structures");
const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
let pool = null;
if (process.env.DATABASE_URL) pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false } });

// Arrays of packet records are the registry; each concept below is a real custom implementation.
const packets = [];
const packetHistory = new SinglyLinkedList();
const commandStack = new Stack(10);
const circularQueue = new CircularQueue(10);
const eventTree = new BinarySearchTree();
const hashIndex = new HashTable(11);
const graph = { SomaiyaSat: ["GS-West", "GS-East"], "GS-West": ["SomaiyaSat", "Relay-1"], "GS-East": ["SomaiyaSat", "Relay-1", "Relay-2"], "Relay-1": ["GS-West", "GS-East", "Relay-2"], "Relay-2": ["GS-East", "Relay-1"] };
const demoPackets = [
  { id: 101, timestamp: 1728471000000, priority: 1, type: "TT&C", status: "Received" },
  { id: 102, timestamp: 1728471020000, priority: 2, type: "SSTV", status: "Queued" },
  { id: 103, timestamp: 1728471050000, priority: 3, type: "M17/Codec2", status: "Queued" },
  { id: 104, timestamp: 1728471090000, priority: 1, type: "TT&C", status: "Received" }
];
packets.push(...demoPackets);
demoPackets.forEach(p => { packetHistory.prepend({ id: p.id, action: "Demo packet loaded" }); hashIndex.set(p.id, p); });
function logCommand(text) { commandStack.push({ text, at: new Date().toISOString() }); }
async function initDb() {
  if (!pool) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS telemetry_packets (id INTEGER PRIMARY KEY, timestamp BIGINT NOT NULL, priority INTEGER NOT NULL, payload_type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Received', created_at TIMESTAMPTZ DEFAULT NOW())`);
  const result = await pool.query("SELECT id, timestamp, priority, payload_type AS type, status FROM telemetry_packets ORDER BY timestamp ASC LIMIT 100");
  if (result.rows.length) {
    packets.length = 0;
    result.rows.forEach(row => { const p = { ...row, id: Number(row.id), timestamp: Number(row.timestamp), priority: Number(row.priority) }; packets.push(p); hashIndex.set(p.id, p); });
  }
}
async function persistPacket(p) { if (!pool) return; await pool.query(`INSERT INTO telemetry_packets (id,timestamp,priority,payload_type,status) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET timestamp=$2,priority=$3,payload_type=$4,status=$5`, [p.id,p.timestamp,p.priority,p.type,p.status]); }
app.get("/api/status", (req,res) => res.json({ mission:"SomaiyaSat & SomaiyaPod", mode:"SIMULATION", battery:87, linkQuality:"GOOD", deployment:"CONFIRMED", packetCount:packets.length, queueCount:circularQueue.size, database:pool?"connected-configured":"local-demo" }));
app.get("/api/packets", (req,res) => res.json(mergeSort(packets, (a,b)=>b.timestamp-a.timestamp)));
app.post("/api/packets", async (req,res) => {
  const id=Number(req.body.id), timestamp=Number(req.body.timestamp||Date.now()), priority=Number(req.body.priority);
  if (!Number.isInteger(id)||id<1||![1,2,3].includes(priority)) return res.status(400).json({error:"Provide a positive integer packet ID and priority 1, 2, or 3."});
  if (hashIndex.get(id)) return res.status(409).json({error:"That packet ID already exists."});
  const type=priority===1?"TT&C":priority===2?"SSTV":"M17/Codec2", p={id,timestamp,priority,type,status:"Received"};
  packets.push(p); packetHistory.prepend({id,action:"Packet registered",at:new Date().toISOString()}); hashIndex.set(id,p); logCommand(`Registered packet ${id}`);
  try { await persistPacket(p); } catch(e) { console.error("Database write failed:",e.message); }
  res.status(201).json(p);
});
app.get("/api/packets/:id", (req,res) => { const id=Number(req.params.id), p=hashIndex.get(id); if(!p)return res.status(404).json({error:"Packet not found."}); logCommand(`Searched packet ${id}`); res.json(p); });
app.post("/api/queue", (req,res) => { const id=Number(req.body.id); if(!hashIndex.get(id))return res.status(404).json({error:"Register that packet first."}); if(!circularQueue.enqueue(id))return res.status(409).json({error:"Queue overflow: circular buffer is full."}); logCommand(`Queued packet ${id}`); res.json({queue:circularQueue.toArray(),message:`Packet ${id} added to circular buffer.`}); });
app.post("/api/queue/transmit", (req,res) => { const id=circularQueue.dequeue(); if(id===null)return res.status(409).json({error:"Queue underflow: buffer is empty."}); logCommand(`Transmitted packet ${id}`); res.json({id,queue:circularQueue.toArray(),message:`Simulated transmission of packet ${id} complete.`}); });
app.get("/api/queue", (req,res) => res.json({items:circularQueue.toArray(),capacity:circularQueue.capacity,front:circularQueue.front,size:circularQueue.size}));
app.get("/api/history", (req,res) => res.json(packetHistory.toArray(15)));
app.get("/api/commands", (req,res) => res.json(commandStack.toArrayNewestFirst()));
app.post("/api/events", (req,res) => { const id=Number(req.body.id); if(!Number.isInteger(id))return res.status(400).json({error:"Event ID must be an integer."}); eventTree.insert(id); logCommand(`Inserted mission event ${id} into BST`); res.json({events:eventTree.inorder(),found:eventTree.search(id),note:"Custom binary search tree; inorder traversal returns sorted event IDs."}); });
app.get("/api/events", (req,res) => res.json(eventTree.inorder()));
app.get("/api/graph", (req,res) => res.json(graph));
app.get("/api/graph/traverse/:method", (req,res) => {
  const method=req.params.method.toLowerCase(); if(!["bfs","dfs"].includes(method))return res.status(400).json({error:"Choose bfs or dfs."});
  const start="SomaiyaSat", visited=new Set(), order=[];
  if(method==="bfs") { const q=new CircularQueue(Object.keys(graph).length+1); q.enqueue(start); visited.add(start); while(q.size){const v=q.dequeue();order.push(v);for(const n of graph[v])if(!visited.has(n)){visited.add(n);q.enqueue(n);}} }
  else { const s=new Stack(Object.keys(graph).length+1); s.push(start); while(s.items.length){const v=s.pop();if(visited.has(v))continue;visited.add(v);order.push(v);[...graph[v]].reverse().forEach(n=>{if(!visited.has(n))s.push(n);});} }
  logCommand(`Ran ${method.toUpperCase()} graph traversal`); res.json({method:method.toUpperCase(),order,visitedCount:order.length,application:method==="bfs"?"Explores nearby links first (useful for minimum-hop route discovery).":"Explores one route deeply before backtracking (useful for reachability exploration)."});
});
app.get("/api/sort-search", (req,res) => { const sorted=mergeSort(packets,(a,b)=>a.timestamp-b.timestamp); const timestamp=req.query.timestamp===undefined?null:Number(req.query.timestamp); const found=timestamp===null||!Number.isFinite(timestamp)?null:binarySearch(sorted,timestamp,p=>p.timestamp); res.json({sorted, searchedTimestamp:timestamp, found, algorithm:"Merge sort + binary search", complexity:{sort:"O(n log n)",search:"O(log n) after sorting"}}); });
app.get("/api/hash/:id", (req,res) => { const id=Number(req.params.id), packet=hashIndex.get(id); if(!packet)return res.status(404).json({error:"Packet ID not found in hash table."}); logCommand(`Hash-table lookup ${id}`); res.json({id,bucket:hashIndex.bucketFor(id),packet,method:"Custom modulo-11 hash table with separate chaining"}); });
// Priority policy from the use case: TT&C/housekeeping > SSTV > M17/Codec2.
app.post("/api/scheduler", (req,res) => {
  const battery=Number(req.body.battery), linkQuality=Number(req.body.linkQuality);
  if(!Number.isFinite(battery)||battery<0||battery>100||!Number.isFinite(linkQuality)||linkQuality<0||linkQuality>100)return res.status(400).json({error:"Battery and link quality must be between 0 and 100."});
  const ranked=mergeSort(packets.filter(p=>p.status!=="Transmitted"),(a,b)=>a.priority-b.priority||a.timestamp-b.timestamp);
  let decision, selected=null;
  if(battery<30){decision="HOLD: battery below 30%; conserve power and defer non-emergency payloads.";selected=ranked.find(p=>p.priority===1)||null;}
  else if(linkQuality<50){decision="DEFER: link quality below 50%; wait for a stronger ground link.";selected=ranked.find(p=>p.priority===1)||null;}
  else {selected=ranked[0]||null;decision=selected?`TRANSMIT NEXT: packet ${selected.id} (${selected.type}), priority ${selected.priority}.`:"NO PENDING PACKETS: register telemetry before scheduling.";}
  logCommand(`Scheduler evaluated battery ${battery}% / link ${linkQuality}%`);
  res.json({battery,linkQuality,selected,decision,ranked:ranked.map(p=>({id:p.id,type:p.type,priority:p.priority,timestamp:p.timestamp})),policy:["Priority 1: TT&C / housekeeping","Priority 2: SSTV image","Priority 3: M17 / Codec2 voice-data"],note:"Rule-based educational scheduler inspired by the use case; not a trained AI model or live satellite controller."});
});
app.get("/api/health",(req,res)=>res.json({ok:true}));
initDb().then(()=>app.listen(PORT,()=>console.log(`SomaiyaSat Mission Control running on port ${PORT}`))).catch(err=>{console.error("Database initialization failed:",err.message);app.listen(PORT,()=>console.log(`SomaiyaSat Mission Control running on port ${PORT} (database unavailable)`));});
