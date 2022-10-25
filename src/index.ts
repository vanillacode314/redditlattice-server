import fastify from 'fastify'
import cors from '@fastify/cors'
import sharp, { AvailableFormatInfo, FormatEnum, OutputInfo } from 'sharp'
import { request as client } from 'undici'
import PQueue from 'p-queue'
import { Readable } from 'stream'

const queue = new PQueue({ concurrency: 2 })

sharp.cache(false)
sharp.concurrency(4)

type ImageFormat = keyof FormatEnum | AvailableFormatInfo
const PORT = +(process.env.PORT || 3000)

type Options = { width?: number; format?: ImageFormat }
async function transformImage(
  body: Readable,
  { width = 300, format }: Options = {}
): Promise<{ data: Buffer; info: OutputInfo }> {
  let transformer = sharp({ sequentialRead: true })
  if (format)
    transformer = transformer.toFormat(format, {
      lossless: true,
    })
  if (width > 0)
    transformer = transformer.resize({ width, withoutEnlargement: true })
  return await body.pipe(transformer).toBuffer({ resolveWithObject: true })
}

const app = fastify({ logger: true })
app.route<{
  Querystring: {
    url: string
    width: number
    format: ImageFormat
    passthrough: boolean
  }
}>({
  method: 'GET',
  url: '/',
  schema: {
    querystring: {
      url: { type: 'string' },
      width: { type: 'number' },
      format: { type: 'string' },
      passthrough: { type: 'boolean' },
    },
  },
  handler: async (request, reply) => {
    await queue.onEmpty()
    queue.add(async () => {
      await reply
    })
    const { url, passthrough, format, width } = request.query
    reply.type(`image/${format}`)
    const { statusCode, body, headers } = await client(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36',
      },
      maxRedirections: 1,
    })
    if (statusCode >= 400) {
      reply.status(statusCode)
      return `${statusCode}`
    }
    const isGif = new URL(url).pathname.endsWith('.gif')
    if (passthrough || isGif) {
      reply.header('Content-Length', headers['content-length'])
      return body
    }
    const { data, info } = await transformImage(body, {
      width: Math.floor(+width),
      format,
    })
    reply.header('Content-Length', info.size)
    return data
  },
})
;(async () => {
  try {
    await app.register(cors, {
      origin: [
        'https://redditlattice.netlify.app',
        'https://dev--redditlattice.netlify.app',
        'https://nuxt--redditlattice.netlify.app',
        'https://solidjs--redditlattice.netlify.app',
        'https://monorepo--redditlattice.netlify.app',
      ],
      credentials: true,
      methods: ['GET'],
    })

    await app.listen({ host: '0.0.0.0', port: PORT })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
})()
