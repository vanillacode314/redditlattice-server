import fastify from "fastify";
import cors from "@fastify/cors";
import sharp, { AvailableFormatInfo, FormatEnum, Sharp } from "sharp";
import fetch from "node-fetch";

type ImageFormat = keyof FormatEnum | AvailableFormatInfo;
const PORT = (process.env.PORT || 3000) as number;
const CACHE_LIMIT: number = 256 * 1024 * 1024; // in bytes
const CACHE: {
  size: number;
  data: Map<string, Buffer>;
  keys: string[];
} = {
  size: 0,
  data: new Map(),
  keys: [],
};

function genKey(url: string, width: number, format: ImageFormat) {
  return `${url}-${width}-${format}`;
}

function cacheStream(key: string, transformer: Sharp) {
  transformer
    .clone()
    .toBuffer()
    .then((buffer) => {
      while (CACHE.size + buffer.byteLength > CACHE_LIMIT) {
        const key = CACHE.keys.shift();
        if (key) CACHE.data.delete(key);
      }
      CACHE.size += buffer.byteLength;
      CACHE.data.set(key, buffer);
      CACHE.keys.push(key);
    });
}
function getTransformer(width: number = 300, format: ImageFormat = "webp") {
  let transformer;

  if (width > 0) {
    transformer = sharp()
      .toFormat(format === "gif" ? "gif" : format)
      .resize({ width });
  }

  transformer = sharp().toFormat(format === "gif" ? "gif" : format);

  return transformer;
}

const app = fastify({ logger: true });
await app.register(cors, {
  origin: "https://redditlattice.netlify.app",
  credentials: true,
  methods: ["GET"],
});

app.route({
  method: "GET",
  url: "/",
  schema: {
    querystring: {
      width: { type: "number" },
      format: { type: "string" },
      url: { type: "string" },
    },
  },
  handler: async (request, reply) => {
    const { format, width, url } = request.query as {
      width: string;
      format: string;
      url: string;
    };

    reply.type(`image/${format}`);
    const key = genKey(url, parseInt(width), format as ImageFormat);
    if (CACHE.data.has(key)) {
      request.log.info("Returned data from cache");
      return CACHE.data.get(key);
    }

    request.log.info("Fetching data from server");
    const isGif = new URL(url).pathname.endsWith(".gif");
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "User-Agent:Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) {
      reply.status(res.status);
      return;
    }
    if (res.body) {
      if (isGif) return res.body;
      const transformer = getTransformer(
        parseInt(width),
        format as ImageFormat
      );
      cacheStream(key, transformer);
      return res.body.pipe(transformer);
    }
  },
});

try {
  await app.listen({ host: "0.0.0.0", port: PORT });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
