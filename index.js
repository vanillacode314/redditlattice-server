import fastify from "fastify";
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
        if (CACHE.size + buffer.byteLength > CACHE_LIMIT) {
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
        const key = genKey(url, parseInt(width), format);
        if (CACHE.data.has(key)) {
            return CACHE.data.get(key);
        }
        const isGif = new URL(url).pathname.endsWith(".gif");
        const res = await fetch(url);
        if (res.body) {
            if (isGif)
                return res.body;
            const transformer = getTransformer(parseInt(width), format);
            cacheStream(key, transformer);
            reply.header("Content-Type", `image/${format}`);
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
