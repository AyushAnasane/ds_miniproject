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
  const titles = { overview:"Mission overview", telemetry:"Telemetry packets", buffer:"Packet buffer", network:"Network explorer", analysis:"Data analysis", pass:"Ground-pass simulator" };
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

// Ground-pass simulator: deterministic, rule-based demonstration with real-time playback.
let passRun = null;
let passSpeed = 1;
let passTimer = null;
let simulatedBattery = 87;
function updateBattery(value, state) {
  simulatedBattery = Math.max(0, Math.min(100, value));
  $('battery').innerHTML = `${Math.round(simulatedBattery)}<span>%</span>`;
  $('batteryMeter').style.width = `${simulatedBattery}%`;
  $('batteryState').textContent = state || (simulatedBattery < 30 ? 'Power conservation mode' : 'Nominal power state');
  $('batteryState').className = simulatedBattery < 30 ? 'status-warn' : 'positive';
  $('batteryMeter').style.background = simulatedBattery < 30 ? '#c96b58' : '';
}
function stopPassTimer() { if (passTimer) clearTimeout(passTimer); passTimer = null; }
function passPreset(name) {
  const presets = {
    easy: { packets: 20, time: 180, power: 300, link: 'good' },
    busy: { packets: 80, time: 90, power: 150, link: 'medium' },
    worst: { packets: 100, time: 20, power: 5, link: 'poor' }
  };
  const p = presets[name]; if (!p) return;
  $('passPackets').value = p.packets; $('passTime').value = p.time; $('passPower').value = p.power; $('passLink').value = p.link;
  document.querySelectorAll('.preset-card').forEach(b => b.classList.toggle('selected', b.dataset.preset === name));
}
function simulatePass(config) {
  const linkPct = { good: 1, medium: .6, poor: .2 }[config.link];
  const capacity = Math.max(0, Math.floor(config.time * 1.2 * linkPct));
  const generated = Array.from({length: config.packets}, (_, i) => {
    const roll = (i * 37 + config.packets * 13 + config.time) % 10;
    const type = roll < 3 ? 'TT&C' : roll < 6 ? 'SSTV' : 'M17 / Codec2';
    return { id: 1001 + i, type, priority: type === 'TT&C' ? 1 : type === 'SSTV' ? 2 : 3, energy: type === 'TT&C' ? 1 : type === 'SSTV' ? 4 : 2, status: 'Waiting' };
  });
  const ordered = [...generated].sort((a,b) => a.priority - b.priority || a.id - b.id);
  let usedPower = 0, sent = 0;
  const log = [`Ground pass opened: ${config.time}s window, ${config.power} energy units, ${config.link} link (${Math.round(linkPct*100)}%).`, `Estimated link capacity: ${capacity} packets.`, 'Playback started. Packets will be processed in priority order.'];
  const schedule = ordered.map((packet, index) => {
    let status = 'Waiting';
    if (index >= capacity) status = 'Waiting';
    else if (usedPower + packet.energy > config.power) status = 'Dropped';
    else { status = 'Sent'; usedPower += packet.energy; sent++; }
    return {...packet, plannedStatus: status};
  });
  return { packets: generated.map(p => ({...p, status:'Queued'})), schedule, cursor:0, sent:0, dropped:0, waiting:0, usedPower:0, plannedPower:usedPower, capacity, log, config, paused:false, complete:false, batteryStart:87 };
}
function renderPass() {
  if (!passRun) return;
  $('passStats').innerHTML = `<div><small>Sent</small><b>${passRun.sent}</b></div><div><small>Dropped / deferred</small><b>${passRun.dropped}</b></div><div><small>Waiting</small><b>${passRun.waiting}</b></div><div><small>Power used</small><b>${passRun.usedPower}/${passRun.config.power}</b></div>`;
  $('passPacketGrid').innerHTML = passRun.packets.map(p => `<button class="pass-packet ${p.status.toLowerCase().replace(/[^a-z]/g,'')} ${p.type === 'TT&C' ? 'ttc' : p.type === 'SSTV' ? 'sstv' : 'voice'}" title="Packet #${p.id} · ${esc(p.type)} · ${p.status}" data-pass-packet="${p.id}">#${p.id}</button>`).join('');
  $('passLog').innerHTML = passRun.log.slice(-80).map((line,i) => `<div class="history-item"><span class="history-id">${String(i+1).padStart(2,'0')}</span><span>${esc(line)}</span></div>`).join('');
  const state = passRun.complete ? 'Pass complete' : passRun.paused ? 'Playback paused' : 'Playback running';
  $('passDecision').innerHTML = `<b>${state}</b><p>${passRun.sent} packets transmitted so far. TT&amp;C is prioritised before SSTV, then M17 / Codec2, subject to link capacity and available power.</p><small class="scheduler-note">Battery and packet statuses update during playback. This is an educational simulation, not a live satellite link.</small>`;
}
function finishPass() {
  if (!passRun) return;
  passRun.complete = true; passRun.paused = false; stopPassTimer();
  passRun.log.push(`Pass complete: ${passRun.sent} sent, ${passRun.dropped} power-limited, ${passRun.waiting} waiting. Power used ${passRun.usedPower}/${passRun.config.power}. Battery ${Math.round(simulatedBattery)}%.`);
  renderPass(); updateBattery(simulatedBattery, simulatedBattery < 30 ? 'Power conservation mode · pass complete' : 'Pass complete · simulated energy consumed');
  toast('Ground pass playback complete.');
}
function passTick() {
  if (!passRun || passRun.paused || passRun.complete) return;
  if (passRun.cursor >= passRun.schedule.length) return finishPass();
  const planned = passRun.schedule[passRun.cursor++];
  const packet = passRun.packets.find(p => p.id === planned.id);
  if (packet) {
    packet.status = planned.plannedStatus;
    if (packet.status === 'Sent') {
      passRun.sent++;
      passRun.usedPower += packet.energy;
      // Each transmitted packet consumes a visible amount of simulated battery.
      const drain = packet.energy * 0.55;
      updateBattery(simulatedBattery - drain, simulatedBattery - drain < 30 ? 'Power conservation mode · ordinary packets may be deferred' : `-${drain.toFixed(2)}% simulated energy · transmitting`);
      passRun.log.push(`TX packet #${packet.id} · ${packet.type} · priority ${packet.priority} · energy ${packet.energy} · battery ${Math.round(simulatedBattery)}%.`);
    } else if (packet.status === 'Dropped') {
      passRun.dropped++;
      passRun.log.push(`DEFER packet #${packet.id} · ${packet.type} · power budget would be exceeded.`);
    } else {
      passRun.waiting++;
      passRun.log.push(`WAIT packet #${packet.id} · ${packet.type} · pass capacity reached.`);
    }
  }
  renderPass();
  if (passRun.cursor >= passRun.schedule.length) finishPass();
  else passTimer = setTimeout(passTick, Math.max(180, 700 / passSpeed));
}
document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => passPreset(b.dataset.preset)));
$('passForm').addEventListener('submit', e => {
  e.preventDefault(); stopPassTimer();
  const config = { packets: Number($('passPackets').value), time: Number($('passTime').value), power: Number($('passPower').value), link: $('passLink').value };
  if (config.packets < 1 || config.packets > 100 || config.time < 1 || config.power < 0) return toast('Check the pass values and try again.');
  simulatedBattery = 87; updateBattery(87, 'Pass started · battery at 87%');
  passRun = simulatePass(config); renderPass(); toast('Ground pass started. Watch the battery and packet tiles update.');
  passTimer = setTimeout(passTick, Math.max(180, 700 / passSpeed));
});
$('passSlow').addEventListener('click', () => { passSpeed = .5; toast('Playback speed: slow'); });
$('passNormal').addEventListener('click', () => { passSpeed = 1; toast('Playback speed: normal'); });
$('passFast').addEventListener('click', () => { passSpeed = 2; toast('Playback speed: fast'); });
$('passPause').addEventListener('click', () => { if (!passRun || passRun.complete) return; passRun.paused = true; stopPassTimer(); renderPass(); updateBattery(simulatedBattery, 'Playback paused · battery stable'); toast('Pass paused.'); });
$('passResume').addEventListener('click', () => { if (!passRun || passRun.complete || !passRun.paused) return; passRun.paused = false; renderPass(); toast('Pass resumed.'); passTimer = setTimeout(passTick, Math.max(180, 700 / passSpeed)); });
$('passReset').addEventListener('click', () => {
  stopPassTimer(); passRun = null; updateBattery(87, 'Nominal power state · simulation reset');
  $('passStats').innerHTML = '<div><small>Sent</small><b>—</b></div><div><small>Dropped / deferred</small><b>—</b></div><div><small>Waiting</small><b>—</b></div><div><small>Power used</small><b>—</b></div>';
  $('passPacketGrid').innerHTML = '<div class="empty-chart">Choose a preset or run a pass to generate packets.</div>';
  $('passLog').innerHTML = '<div class="notice">No pass has been run yet.</div>'; $('passDecision').textContent = 'The pass report will appear here.';
});
$('passPacketGrid').addEventListener('click', e => { const b = e.target.closest('[data-pass-packet]'); if (!b || !passRun) return; const p = passRun.packets.find(x => x.id === Number(b.dataset.passPacket)); if (p) $('passDecision').innerHTML = `<b>Packet #${p.id}</b><p>Payload: ${esc(p.type)} · Priority: ${p.priority} · Energy cost: ${p.energy} · Status: <b>${esc(p.status)}</b></p>`; });
