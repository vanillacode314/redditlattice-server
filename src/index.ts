import fastify from "fastify";
import cors from "@fastify/cors";
import sharp, { AvailableFormatInfo, FormatEnum, Sharp } from "sharp";
import got from "got";
import PQueue from "p-queue";
import Keyv from "keyv";

const keyv = new Keyv();
keyv.setMaxListeners(10000);

const client = got.extend({
  cache: keyv,
});

const queueSize = 5;
const queue = new PQueue({ concurrency: queueSize });

type ImageFormat = keyof FormatEnum | AvailableFormatInfo;
const PORT = (process.env.PORT || 3000) as number;

function getTransformer(
  width: number = 300,
  format: ImageFormat = "webp"
): Sharp {
  let transformer = sharp({ failOn: "none" }).toFormat(format);
  if (width > 0) {
    transformer = transformer.resize({ width });
  }
  return transformer;
}

const app = fastify({ logger: true });
await app.register(cors, {
  origin: [
    "https://redditlattice.netlify.app",
    "https://dev--redditlattice.netlify.app",
    "https://nuxt--redditlattice.netlify.app",
    "https://solidjs--redditlattice.netlify.app",
  ],
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
    await queue.onSizeLessThan(queueSize);
    queue.add(async () => {
      return await reply;
    });
    const { format, width, url } = request.query as {
      width: string;
      format: ImageFormat;
      url: string;
    };
    reply.type(`image/${format}`);
    const isGif = new URL(url).pathname.endsWith(".gif");
    const res = client.stream(url, {
      headers: {
        "User-Agent":
          "User-Agent:Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36",
      },
    });
    if (isGif) return res;
    const transformer = getTransformer(parseInt(width), format);
    return res.pipe(transformer);
  },
});

try {
  await app.listen({ host: "0.0.0.0", port: PORT });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
