# SomaiyaSat Mission Report — Data Structures Mini-project

An educational mission simulation for **KJS-SRS-01: SomaiyaSat & SomaiyaPod**, built with Node.js, Express, plain HTML/CSS/JavaScript, and optional PostgreSQL persistence. The light-mode interface includes mission stats, payload charts, a packet timeline, and an interactive routing-decision report.

## What makes this a data-structures project?

| Syllabus topic | Actual implementation | Mission use-case problem it solves |
|---|---|---|
| Arrays + structures | Array of packet objects | Stores packet ID, timestamp, priority, payload type, and status |
| Singly linked list | `SinglyLinkedList` with nodes and `next` pointers | Keeps recent telemetry actions in newest-first order |
| Stack | Custom `Stack` with `push` / `pop` | Keeps recent operations in LIFO order for quick inspection |
| Circular queue | Fixed-capacity `CircularQueue` with front/size and modulo rear calculation | Buffers packets FIFO and reuses freed slots without shifting the array |
| Binary search tree | `BinarySearchTree` with insert, search, and inorder traversal | Indexes mission event IDs and returns them in sorted order |
| Graph + BFS/DFS | Adjacency list, BFS uses queue, DFS uses stack | Explores satellite, ground-station, and relay connectivity |
| Sorting + binary search | Merge sort and binary search | Orders telemetry by timestamp and finds an exact timestamp efficiently |
| Hash table | Custom modulo hash with separate chaining | Looks up a packet by ID using a bucket rather than scanning all packets |
| Algorithmic decision | Rule-based priority scheduler | Applies the use-case order TT&C/housekeeping → SSTV → M17/Codec2, while checking battery and link constraints |

## Run locally

Requires Node.js 18 or newer.

```bash
npm install
npm start
```

Open http://localhost:3000

## Try this demo during evaluation

1. Open **Mission report** and run the routing algorithm with battery `87` and link `82`. It should choose the highest-priority pending packet.
2. Change battery to `20`; the scheduler should enter power-conservation mode.
3. Set battery to `80` and link quality to `35`; it should defer transmission due to the weak link.
4. Register a packet with priority 1, 2, or 3 and run the scheduler again.
5. Add event IDs out of order (for example `205`, `102`, `180`) and show the BST's inorder output.
6. Queue packets, transmit one, and enqueue another to demonstrate the circular queue reusing slots.
7. Run BFS and DFS and compare traversal orders.
8. Sort by timestamp, search an exact timestamp, and try hash lookups for packet IDs.

## API routes

- `GET/POST /api/packets` — list and register packet records
- `GET /api/packets/:id` — indexed packet lookup
- `GET/POST /api/queue` and `POST /api/queue/transmit` — circular buffer operations
- `GET/POST /api/events` — BST event index
- `GET /api/graph/traverse/bfs` or `/dfs` — graph traversal
- `GET /api/sort-search?timestamp=...` — merge sort and binary search
- `GET /api/hash/:id` — custom hash-table lookup
- `POST /api/scheduler` — rule-based mission routing decision

## Optional PostgreSQL

Set `DATABASE_URL` to a PostgreSQL connection string before starting the server. The app creates `telemetry_packets` if needed and persists telemetry packet records. Without it, the app runs in local demo mode and records reset when the server restarts.

## Deployment on Render

1. Push this folder to a GitHub repository.
2. Create a Render Web Service connected to that repository.
3. Build command: `npm install`
4. Start command: `npm start`
5. Optionally add `DATABASE_URL` from a Render PostgreSQL database.

## Important scope note

This is a **simulation**, not a real satellite controller, live radio interface, or trained AI model. The scheduler is a transparent rule-based algorithm inspired by the priority and resource constraints in the use case. It is written in JavaScript because this web project uses Node.js; it does not replace any separate C-language practical submissions if those are required by the course.
