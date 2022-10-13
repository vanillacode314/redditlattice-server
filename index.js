import fastify from "fastify";
import cors from "@fastify/cors";
import sharp from "sharp";
import got from "got-fetch";
import PQueue from "p-queue";
const queueSize = 10;
const queue = new PQueue({ concurrency: queueSize });
const PORT = (process.env.PORT || 3000);
function getTransformer(width = 300, format = "webp") {
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
        const { format, width, url } = request.query;
        reply.type(`image/${format}`);
        const isGif = new URL(url).pathname.endsWith(".gif");
        const res = await got(url, {
            headers: {
                "User-Agent": "User-Agent:Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36",
            },
        });
        if (!res.ok) {
            reply.status(res.status);
            return;
        }
        if (res.body) {
            if (isGif)
                return res.body;
            const transformer = getTransformer(parseInt(width), format);
            const stream = res.body.pipe(transformer);
            return stream;
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
