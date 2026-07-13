import { createReadStream } from 'node:fs'
import path from 'node:path'
import { sendStream, setHeader, setResponseStatus } from 'h3'
import { apiHandler } from '../../utils/api'
import { getRuntime } from '../../utils/runtime'
import { validateDownloadUuid } from '../../utils/validation.js'

export default defineEventHandler((event) =>
  apiHandler(event, async () => {
    const downloadUuid = getRouterParam(event, 'downloadUuid')
    if (!validateDownloadUuid(downloadUuid)) {
      setResponseStatus(event, 404)
      return { error: 'Download not found.' }
    }

    const { manager, config } = await getRuntime()
    const metadata = await manager.consumeDownload(downloadUuid)
    if (!metadata) {
      setResponseStatus(event, 404)
      return { error: 'The download expired or no longer exists.' }
    }

    const zipPath = path.join(config.dataDir, 'downloads', `${downloadUuid}.zip`)
    const downloadName = metadata.filename || 'certificate.zip'
    setHeader(event, 'Content-Type', 'application/zip')
    setHeader(event, 'Content-Disposition', `attachment; filename="${downloadName}"`)
    setHeader(event, 'Cache-Control', 'no-store')
    setHeader(event, 'X-Content-Type-Options', 'nosniff')

    const response = await sendStream(event, createReadStream(zipPath))

    if (metadata.remainingDownloads <= 0) {
      await manager.finalizeDownload(downloadUuid)
    } else if (new Date(metadata.expiresAt).getTime() <= Date.now()) {
      await manager.cleanupExpired()
    }

    return response
  }),
)
