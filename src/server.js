import { createServer } from "./api/createServer.js";
import { getThreadById, listEvents, listThreads } from "./data/inMemoryStore.js";

const port = Number(process.env.PORT ?? 3000);

const server = createServer({
  getThreadById,
  listThreads,
  listEvents,
});

server.listen(port, () => {
  console.log(`Living Campaign Engine MVP API listening on http://localhost:${port}`);
});
