import { createServer } from "http";
import { parse } from "url";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

let serverEntryPromise: Promise<any> | undefined;

async function getServerEntry() {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => m.default ?? m
    );
  }
  return serverEntryPromise;
}

const port = process.env.PORT || 3000;

const server = createServer(async (req, res) => {
  try {
    const handler = await getServerEntry();

    const request = new Request(`http://${req.headers.host}${req.url}`, {
      method: req.method,
      headers: req.headers as any,
    });

    const response = await handler.fetch(request, {}, {});

    const text = await response.text();

    res.writeHead(response.status, {
      "content-type": response.headers.get("content-type") || "text/html",
    });

    res.end(text);
  } catch (err) {
    console.error(err);

    const error = consumeLastCapturedError() ?? err;

    res.writeHead(500, { "content-type": "text/html" });
    res.end(renderErrorPage());
  }
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});