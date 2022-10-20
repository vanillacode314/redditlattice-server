import fastify from 'fastify'
import cors from '@fastify/cors'
import sharp, { AvailableFormatInfo, FormatEnum, Sharp } from 'sharp'
import PQueue from 'p-queue'
import { request as client } from 'undici'

const queue = new PQueue({ concurrency: 5 })

sharp.cache(false)

type ImageFormat = keyof FormatEnum | AvailableFormatInfo
const PORT = +(process.env.PORT || 3000)

function getTransformer(
  width: number = 300,
  format: ImageFormat = 'webp'
): Sharp {
  let transformer = sharp({ sequentialRead: true }).toFormat(format, {
    lossless: true,
    quality: 85,
  })
  if (width > 0) {
    transformer = transformer.resize({ width, withoutEnlargement: true })
  }
  return transformer
}

const app = fastify({ logger: true })
app.route({
  method: 'GET',
  url: '/',
  schema: {
    querystring: {
      width: { type: 'number' },
      format: { type: 'string' },
      url: { type: 'string' },
    },
  },
  handler: async (request, reply) => {
    await queue.onEmpty()
    queue.add(async () => {
      await reply
    })
    const { format, width, url } = request.query as {
      width: string
      format: ImageFormat
      url: string
    }
    reply.type(`image/${format}`)
    const isGif = new URL(url).pathname.endsWith('.gif')
    const { statusCode, body } = await client(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36',
      },
      maxRedirections: 1,
      bodyTimeout: 10 * 1000,
      headersTimeout: 10 * 1000,
    })
    if (statusCode >= 400) {
      reply.status(statusCode)
      return `${statusCode}`
    }
    if (isGif) return body
    const transformer = getTransformer(parseInt(width), format)
    return body.pipe(transformer)
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
