import fastify from "fastify";
import sharp, { AvailableFormatInfo, FormatEnum, Sharp } from "sharp";
import fetch from "node-fetch";
import { Readable, Transform, Writable } from "stream";

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
      if (CACHE.size + buffer.byteLength > CACHE_LIMIT) {
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

    const key = genKey(url, parseInt(width), format as ImageFormat);
    if (CACHE.data.has(key)) {
      return CACHE.data.get(key);
    }

    const isGif = new URL(url).pathname.endsWith(".gif");
    const res = await fetch(url);
    if (res.body) {
      if (isGif) return res.body;
      const transformer = getTransformer(
        parseInt(width),
        format as ImageFormat
      );
      cacheStream(key, transformer);
      reply.header("Content-Type", `image/${format}`);
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
