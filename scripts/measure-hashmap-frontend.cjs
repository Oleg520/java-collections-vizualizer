const fs = require("fs");
const dir = process.argv[2];
const { decodeHashMapTrace } = require(`${dir}/js/api/trace/hashmap.js`);
const { layoutSnapshot } = require(`${dir}/js/features/hashmap/layout.js`);
global.gc();
const base = process.memoryUsage().heapUsed;
let encoded = JSON.parse(fs.readFileSync(`${dir}/history.json`));
let start = performance.now();
const history = encoded.map(decodeHashMapTrace);
const decodeMs = performance.now() - start;
encoded = null;
global.gc();
const retained = process.memoryUsage().heapUsed - base;
let frames = 0,
  nodes = 0;
start = performance.now();
for (const { trace } of history)
  for (const s of trace.steps) {
    const d = layoutSnapshot(s.snapshot);
    frames++;
    nodes += d.nodes.length;
  }
const result = {
  history: history.length,
  frames,
  nodes,
  decodeMs,
  layoutAllFramesMs: performance.now() - start,
  retainedHistoryHeapBytes: retained,
};
fs.writeFileSync(
  `${dir}/frontend-metrics.json`,
  JSON.stringify(result, null, 2),
);
console.log(result);
