const $ = (id) => document.getElementById(id);
let toastTimer;
async function api(url, options = {}) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data;
}
function toast(message) {
  const el = $("toast"); el.textContent = message; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])); }
function payloadClass(type) { return type === "TT&C" ? "critical" : type === "SSTV" ? "image" : "voice"; }
function packetRows(rows) {
  if (!rows.length) return '<div class="notice">No packets found.</div>';
  return `<table><thead><tr><th>Packet ID</th><th>Timestamp</th><th>Priority</th><th>Payload type</th><th>Status</th></tr></thead><tbody>${rows.map(p => `<tr><td><b>${p.id}</b></td><td>${p.timestamp}</td><td>P${p.priority}</td><td><span class="payload-tag ${payloadClass(p.type)}">${esc(p.type)}</span></td><td>${esc(p.status || "Received")}</td></tr>`).join("")}</tbody></table>`;
}
async function refreshStatus() {
  const s = await api("/api/status");
  $("battery").innerHTML = `${s.battery}<span>%</span>`;
  $("packetCount").textContent = String(s.packetCount).padStart(2, "0");
  $("queueCount").textContent = String(s.queueCount).padStart(2, "0");
  $("bufferMetric").textContent = String(s.queueCount).padStart(2, "0");
  $("queueMeter").style.width = `${s.queueCount * 10}%`;
  $("capacityPill").textContent = `${s.queueCount} / 10 slots`;
}
async function refreshPackets() {
  const packets = await api("/api/packets");
  $("packetTable").innerHTML = packetRows(packets);
  $("recentPackets").innerHTML = packetRows(packets.slice(0, 4));
  $("queuePacket").innerHTML = packets.map(p => `<option value="${p.id}">${p.id} · ${esc(p.type)}</option>`).join("");
  $("sortedTable").innerHTML = packetRows([...packets].sort((a,b) => a.timestamp-b.timestamp));
  renderReport(packets);
}
function renderReport(packets) {
  const counts = { "TT&C": 0, "SSTV": 0, "M17 / Codec2": 0 };
  packets.forEach(p => { if (p.type === "TT&C") counts["TT&C"]++; else if (p.type === "SSTV") counts.SSTV++; else counts["M17 / Codec2"]++; });
  $("reportTotal").textContent = packets.length;
  $("reportCritical").textContent = counts["TT&C"];
  $("reportImages").textContent = counts.SSTV;
  $("reportVoice").textContent = counts["M17 / Codec2"];
  const max = Math.max(1, ...Object.values(counts));
  const colors = { "TT&C": "#477b65", "SSTV": "#d39a45", "M17 / Codec2": "#8a9a78" };
  $("payloadChart").innerHTML = Object.entries(counts).map(([label, value]) => `<div class="bar-row"><div class="bar-label"><span>${esc(label)}</span><b>${value}</b></div><div class="bar-track"><i style="width:${value / max * 100}%;background:${colors[label]}"></i></div><small>${packets.length ? Math.round(value / packets.length * 100) : 0}% of registered packets</small></div>`).join("") || '<div class="notice">No packet data available.</div>';
  if (!packets.length) { $("timelineChart").innerHTML = '<div class="empty-chart">Register packets to populate the activity timeline.</div>'; return; }
  const sorted = [...packets].sort((a,b) => a.timestamp-b.timestamp).slice(-10);
  const w = 720, h = 170, pad = 28;
  const minT = Math.min(...sorted.map(p => p.timestamp)), maxT = Math.max(...sorted.map(p => p.timestamp));
  const points = sorted.map((p,i) => ({ p, x: sorted.length === 1 ? w/2 : pad + i * (w-2*pad)/(sorted.length-1), y: h-38 - (maxT === minT ? 0.5 : (p.timestamp-minT)/(maxT-minT))*92 }));
  const poly = points.map(pt => `${pt.x},${pt.y}`).join(" ");
  $("timelineChart").innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Chronological telemetry packet timeline"><line x1="${pad}" y1="${h-38}" x2="${w-pad}" y2="${h-38}" class="chart-axis"/><polyline points="${poly}" class="chart-line"/>${points.map(({p,x,y}) => `<circle cx="${x}" cy="${y}" r="5" class="chart-point"><title>Packet ${p.id} · ${p.type}</title></circle><text x="${x}" y="${h-15}" text-anchor="middle" class="chart-label">${esc(String(p.id))}</text>`).join("")}</svg><div class="timeline-caption"><span>Earlier timestamp</span><span>Latest timestamp</span></div>`;
}
async function refreshQueue() {
  const q = await api("/api/queue");
  $("queueVisual").innerHTML = Array.from({length:10}, (_,i) => q.items[i] === undefined
    ? `<div class="queue-slot"><span>SLOT ${String(i+1).padStart(2,"0")}</span><strong>—</strong></div>`
    : `<div class="queue-slot filled"><span>SLOT ${String(i+1).padStart(2,"0")}</span><strong>${q.items[i]}</strong></div>`).join("");
  refreshStatus();
}
async function refreshHistory() {
  const h = await api("/api/history");
  $("historyList").innerHTML = h.length ? h.map(x => `<div class="history-item"><span class="history-id">#${x.id}</span><span>${esc(x.action)}</span><small>${x.at ? new Date(x.at).toLocaleTimeString() : "demo"}</small></div>`).join("") : '<div class="notice">No history yet.</div>';
  const c = await api("/api/commands");
  $("commandList").innerHTML = c.length ? c.map((x,i) => `<div class="history-item"><span class="history-id">${String(c.length-i).padStart(2,"0")}</span><span>${esc(x.text)}</span><small>${new Date(x.at).toLocaleTimeString()}</small></div>`).join("") : '<div class="notice">No operations recorded yet.</div>';
}
async function refreshEvents() {
  const events = await api("/api/events");
  $("eventList").innerHTML = events.length ? events.map(id => `<span class="event-chip">EVENT ${id}</span>`).join("") : '<span class="footnote">No event IDs added.</span>';
}
async function refreshAll() {
  try { await Promise.all([refreshStatus(), refreshPackets(), refreshQueue(), refreshHistory(), refreshEvents()]); }
  catch (e) { toast(e.message); }
}
function showSection(id) {
  document.querySelectorAll(".section").forEach(s => s.classList.toggle("active-section", s.id === id));
  document.querySelectorAll(".nav").forEach(n => n.classList.toggle("active", n.dataset.section === id));
  const titles = { overview:"Mission overview", telemetry:"Telemetry packets", buffer:"Packet buffer", network:"Network explorer", analysis:"Data analysis" };
  $("pageTitle").textContent = titles[id] || "Mission overview";
  if (id === "telemetry") { refreshPackets(); refreshHistory(); }
  if (id === "buffer") { refreshQueue(); refreshHistory(); }
  if (id === "network") refreshEvents();
  if (id === "analysis") refreshPackets();
}
document.querySelectorAll(".nav").forEach(b => b.addEventListener("click", () => showSection(b.dataset.section)));
document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => showSection(b.dataset.go)));
$("showAdd").addEventListener("click", () => { $("addForm").hidden = false; $("packetTimestamp").value = Date.now(); $("packetId").focus(); });
$("hideAdd").addEventListener("click", () => $("addForm").hidden = true);
$("packetForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    const p = await api("/api/packets", { method:"POST", body:JSON.stringify({ id:Number($("packetId").value), timestamp:Number($("packetTimestamp").value), priority:Number($("packetPriority").value) }) });
    $("packetForm").reset(); $("addForm").hidden = true; toast(`Packet ${p.id} registered.`); await refreshAll();
  } catch(err) { toast(err.message); }
});
$("searchPacket").addEventListener("click", async () => {
  const id = $("packetSearch").value.trim();
  if (!id) { refreshPackets(); return; }
  try { const p = await api(`/api/packets/${encodeURIComponent(id)}`); $("packetTable").innerHTML = packetRows([p]); $("packetNotice").hidden = true; }
  catch(e) { $("packetNotice").hidden = false; $("packetNotice").textContent = e.message; }
});
$("packetSearch").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); $("searchPacket").click(); } });
$("enqueue").addEventListener("click", async () => {
  if (!$("queuePacket").value) return toast("Register a packet first.");
  try { const r = await api("/api/queue", {method:"POST", body:JSON.stringify({id:Number($("queuePacket").value)})}); toast(r.message); await refreshQueue(); await refreshHistory(); }
  catch(e) { toast(e.message); }
});
$("transmit").addEventListener("click", async () => {
  try { const r = await api("/api/queue/transmit", {method:"POST", body:"{}"}); toast(r.message); await refreshQueue(); await refreshHistory(); }
  catch(e) { toast(e.message); }
});
async function traverse(method) {
  try { const r = await api(`/api/graph/traverse/${method}`); $("traversalResult").innerHTML = `<b>${r.method} traversal order</b><br><br>${r.order.map((n,i)=>`${i+1}. ${esc(n)}`).join("<br>")}`; await refreshHistory(); }
  catch(e) { toast(e.message); }
}
$("runBfs").addEventListener("click", () => traverse("bfs"));
$("runDfs").addEventListener("click", () => traverse("dfs"));
$("eventForm").addEventListener("submit", async e => {
  e.preventDefault();
  try { await api("/api/events", {method:"POST", body:JSON.stringify({id:Number($("eventId").value)})}); $("eventForm").reset(); await refreshEvents(); await refreshHistory(); toast("Mission event added."); }
  catch(err) { toast(err.message); }
});
$("schedulerForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    const r = await api("/api/scheduler", { method:"POST", body:JSON.stringify({battery:Number($("schedulerBattery").value),linkQuality:Number($("schedulerLink").value)}) });
    const chosen = r.selected ? `<p><b>Selected packet:</b> #${r.selected.id} · ${esc(r.selected.type)} · Priority ${r.selected.priority}</p>` : "";
    const ranked = r.ranked.length ? `<div class="scheduler-ranked"><b>Priority-ordered candidates</b>${r.ranked.map(p=>`<span>#${p.id} · P${p.priority} · ${esc(p.type)}</span>`).join("")}</div>` : "<p>No packets are available to schedule.</p>";
    $("schedulerResult").innerHTML = `<b>${esc(r.decision)}</b>${chosen}${ranked}<small class="scheduler-note">${esc(r.note)}</small>`;
    await refreshHistory();
  } catch(err) { $("schedulerResult").textContent = err.message; }
});
$("sortPackets").addEventListener("click", async () => {
  const r = await api("/api/sort-search"); $("sortedTable").innerHTML = packetRows(r.sorted); toast("Packets sorted by timestamp.");
});
$("timestampForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    const t = Number($("timestampSearch").value);
    const r = await api(`/api/sort-search?timestamp=${encodeURIComponent(t)}`);
    $("timestampResult").innerHTML = r.found ? `Timestamp found.<br><br>Packet ID: <b>${r.found.id}</b><br>Payload: ${esc(r.found.type)}<br>Priority: P${r.found.priority}` : "Timestamp not found in the packet registry.";
  } catch(err) { toast(err.message); }
});
$("hashForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    const r = await api(`/api/hash/${encodeURIComponent($("hashId").value)}`);
    $("hashResult").innerHTML = `Packet ID <b>${r.id}</b> found.<br><br>Hash bucket: <b>${r.bucket}</b><br>Payload: ${esc(r.packet.type)}<br>Method: ${esc(r.method)}`;
    await refreshHistory();
  } catch(err) { $("hashResult").textContent = err.message; }
});
refreshAll();
