import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { createAppServer } from '../src/server/createServer.js';

let server;
let baseUrl;

before(async () => {
  const app = createAppServer();
  server = app.server;

  await new Promise((resolve) => {
    server.listen(0, () => resolve());
  });

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
});

describe('API server', () => {
  it('serves the browser app shell', async () => {
    const response = await fetch(baseUrl);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /Levels 1 to 9 in one runnable app/);
  });

  it('creates a request and dispatches it through the API', async () => {
    const requestResponse = await fetch(`${baseUrl}/api/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Kai',
        currentFloor: 2,
        dropOffFloor: 6
      })
    });

    const requestBody = await requestResponse.json();
    assert.equal(requestResponse.status, 201);
    assert.equal(requestBody.name, 'Kai');

    const dispatchResponse = await fetch(`${baseUrl}/api/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        strategy: 'fifo',
        hour: 13
      })
    });

    const dispatchBody = await dispatchResponse.json();

    assert.equal(dispatchResponse.status, 200);
    assert.equal(dispatchBody.after.requests.length, 0);
    assert.equal(dispatchBody.after.riders.length, 0);
    assert.equal(dispatchBody.after.completedRides.length, 1);
    assert.equal(dispatchBody.after.currentFloor, 6);
  });
});
