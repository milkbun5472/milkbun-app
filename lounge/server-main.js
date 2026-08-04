'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { openDb } = require('./db');
const { Orchestrator } = require('./orchestrator');
const { FakeAdapter } = require('./adapters/fake');
const { createLoungeServer } = require('./server');
const { LandlordController } = require('./landlord-controller');

const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = openDb(path.join(dataDir, 'lounge-preview.db'));
const cc = new FakeAdapter('cc');
const codex = new FakeAdapter('codex');
const orch = new Orchestrator({ db, cc, codex, pollInterval: 80 });
let built;
const landlord = new LandlordController({ db, orch, onChange: (roomId) => built && built.snapshot(roomId) });
built = createLoungeServer({
  orch,
  landlord,
  runtime: { mode: 'preview', cc: 'fake', codex: 'fake' },
  roomDefaults: { max_auto_turns: 2, daily_call_cap: 20, daily_char_cap: 16000 },
});
const { server } = built;

const port = Number(process.env.PORT || 8092);
server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`三方会客厅本地预览：http://127.0.0.1:${port}\n`);
});
