import assert from 'node:assert/strict';
import test from 'node:test';
import { POST } from '../app/api/cinematraj/route';

const base = { positions: Array.from({ length: 121 }, () => [0, 1, 0]), obstacles: [[[-1, -1, -1], [1, 0, 1]]] };
function request(region: unknown) { return new Request('http://localhost:3000/api/cinematraj', { method: 'POST', headers: { host: 'localhost:3000', origin: 'http://localhost:3000', 'content-type': 'application/json' }, body: JSON.stringify({ ...base, region }) }); }
test('CinemaTraj rejects malformed coverage before starting the optional worker', async () => {
  for (const region of [null, [], [[0,0,0]], [[0,0,0],[0,1,1]], [[1,0,0],[0,1,1]], [['x',0,0],[1,1,1]], [[0,0,0],[1001,1,1]]]) {
    const response = await POST(request(region));
    assert.equal(response.status, 400); assert.match((await response.json()).error, /reviewed area/);
  }
});
