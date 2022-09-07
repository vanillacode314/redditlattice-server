import fastify from "fastify";
import sharp, { AvailableFormatInfo, FormatEnum } from "sharp";
import fetch from "node-fetch";
import { Stream } from "stream";

const PORT = (process.env.PORT || 3000) as number;

async function getStreamingImage(
  stream: Stream,
  width: number = 300,
  format: keyof FormatEnum | AvailableFormatInfo = "webp"
) {
  if (width > 0) {
    const transformer = sharp()
      .toFormat(format === "gif" ? "gif" : format)
      .resize({ width });

    return stream.pipe(transformer);
  }
  const transformer = sharp().toFormat(format === "gif" ? "gif" : format);

  return stream.pipe(transformer);
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
      width: number;
      format: string;
      url: string;
    };
    const res = await fetch(url);
    if (res.body) {
      return getStreamingImage(
        res.body,
        width,
        format as keyof FormatEnum | AvailableFormatInfo
      );
    }
  },
});

try {
  await app.listen({ port: PORT });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
