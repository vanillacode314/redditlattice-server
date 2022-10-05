import fastify from "fastify";
import sharp from "sharp";
import fetch from "node-fetch";
const PORT = (process.env.PORT || 3000);
async function getStreamingImage(stream, width = 300, format = "webp") {
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
        const { format, width, url } = request.query;
        const isGif = new URL(url).pathname.endsWith(".gif");
        const res = await fetch(url);
        if (res.body) {
            if (isGif)
                return res.body;
            return getStreamingImage(res.body, parseInt(width), format);
        }
    },
});
try {
    await app.listen({ host: "0.0.0.0", port: PORT });
}
catch (err) {
    app.log.error(err);
    process.exit(1);
}
