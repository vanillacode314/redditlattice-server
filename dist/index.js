"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const sharp_1 = __importDefault(require("sharp"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const node_stream_1 = require("node:stream");
const node_util_1 = require("node:util");
const url = "https://i.redd.it/3iy7t232iik91.png";
function getStreamingImage(stream, width, format) {
    return __awaiter(this, void 0, void 0, function* () {
        const transformer = (0, sharp_1.default)().toFormat("webp").resize({ width });
        const { readable, writable } = new TransformStream();
        return stream;
    });
}
const app = (0, fastify_1.default)({ logger: true });
app.get("/", (request, reply) => __awaiter(void 0, void 0, void 0, function* () {
    const streamPipeline = (0, node_util_1.promisify)(node_stream_1.pipeline);
    const res = yield (0, node_fetch_1.default)(url);
    /* if (res.ok) { */
    /*   const imageBuffer = Buffer.from(await res.arrayBuffer()); */
    /* } */
    return { hello: "world" };
}));
try {
    await app.listen({ port: 3000 });
}
catch (err) {
    app.log.error(err);
    process.exit(1);
}
