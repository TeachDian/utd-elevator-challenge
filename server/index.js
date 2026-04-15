import { createAppServer } from '../src/server/createServer.js';

const port = Number(process.env.PORT) || 3000;
const { server } = createAppServer();

server.listen(port, () => {
  console.log(`Elevator challenge app running at http://localhost:${port}`);
});
