import { createServer as createHttpServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import SimulationStore from './SimulationStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDirectory = path.resolve(__dirname, '../../public');

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify(data));
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8'
  });
  response.end(message);
}

async function readJson(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function serveStaticFile(response, pathname) {
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const safePath = requestedPath.replace(/^\/+/, '');
  const filePath = path.resolve(publicDirectory, safePath);

  if (!filePath.startsWith(publicDirectory)) {
    sendText(response, 403, 'Forbidden');
    return;
  }

  try {
    const file = await readFile(filePath);
    const extension = path.extname(filePath);
    response.writeHead(200, {
      'Content-Type': contentTypes[extension] ?? 'application/octet-stream'
    });
    response.end(file);
  } catch {
    sendText(response, 404, 'Not found');
  }
}

export function createAppServer(store = new SimulationStore()) {
  const server = createHttpServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const { pathname } = url;

    try {
      if (pathname === '/api/state' && request.method === 'GET') {
        sendJson(response, 200, store.snapshot());
        return;
      }

      if (pathname === '/api/requests' && request.method === 'GET') {
        sendJson(response, 200, store.snapshot().requests);
        return;
      }

      if (pathname === '/api/requests' && request.method === 'POST') {
        const payload = await readJson(request);
        sendJson(response, 201, store.addRequest(payload));
        return;
      }

      if (pathname.startsWith('/api/requests/') && request.method === 'DELETE') {
        const id = pathname.split('/').at(-1);
        const removed = store.removeRequest(id);
        sendJson(response, removed ? 200 : 404, removed ?? { error: 'Request not found.' });
        return;
      }

      if (pathname === '/api/riders' && request.method === 'GET') {
        sendJson(response, 200, store.snapshot().riders);
        return;
      }

      if (pathname === '/api/riders' && request.method === 'POST') {
        const payload = await readJson(request);
        sendJson(response, 201, store.addRider(payload));
        return;
      }

      if (pathname.startsWith('/api/riders/') && request.method === 'DELETE') {
        const id = pathname.split('/').at(-1);
        const removed = store.removeRider(id);
        sendJson(response, removed ? 200 : 404, removed ?? { error: 'Rider not found.' });
        return;
      }

      if (pathname === '/api/dispatch' && request.method === 'POST') {
        const payload = await readJson(request);
        sendJson(response, 200, store.dispatch(payload));
        return;
      }

      if (pathname === '/api/reset' && request.method === 'POST') {
        sendJson(response, 200, store.reset());
        return;
      }

      if (pathname === '/api/strategies' && request.method === 'GET') {
        sendJson(response, 200, ['fifo', 'optimized']);
        return;
      }

      if (request.method === 'GET') {
        await serveStaticFile(response, pathname);
        return;
      }

      sendText(response, 404, 'Not found');
    } catch (error) {
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : 'Unexpected server error.'
      });
    }
  });

  return { server, store };
}
