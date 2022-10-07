import fastify from "fastify";
import cors from "@fastify/cors";
import sharp from "sharp";
import fetch from "node-fetch";
const PORT = (process.env.PORT || 3000);
const CACHE_LIMIT = 256 * 1024 * 1024; // in bytes
const CACHE = {
    size: 0,
    data: new Map(),
    keys: [],
};
function genKey(url, width, format) {
    return `${url}-${width}-${format}`;
}
function cacheStream(key, transformer) {
    transformer
        .clone()
        .toBuffer()
        .then((buffer) => {
        while (CACHE.size + buffer.byteLength > CACHE_LIMIT) {
            const key = CACHE.keys.shift();
            if (key)
                CACHE.data.delete(key);
        }
        CACHE.size += buffer.byteLength;
        CACHE.data.set(key, buffer);
        CACHE.keys.push(key);
    });
}
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
        const { format, width, url } = request.query;
        reply.type(`image/${format}`);
        const key = genKey(url, parseInt(width), format);
        if (CACHE.data.has(key)) {
            request.log.info("Returned data from cache");
            return CACHE.data.get(key);
        }
        request.log.info("Fetching data from server");
        const isGif = new URL(url).pathname.endsWith(".gif");
        const res = await fetch(url, {
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
            cacheStream(key, transformer);
            return res.body.pipe(transformer);
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
