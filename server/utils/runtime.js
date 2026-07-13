import { useRuntimeConfig } from '#imports'
import { config as legacyConfig } from './config.js'
import { RequestManager } from '../services/requests.js'
import { toPositiveInt } from './utils.js'

const runtimeKey = Symbol.for('certigen.runtime')

function getState() {
  if (!globalThis[runtimeKey]) {
    globalThis[runtimeKey] = {
      runtime: null,
      initPromise: null,
    }
  }

  return globalThis[runtimeKey]
}

function buildConfig() {
  const runtimeConfig = useRuntimeConfig()

  return {
    dataDir: legacyConfig.dataDir,
    requestTtlMinutes: toPositiveInt(runtimeConfig.requestTtlMinutes, legacyConfig.requestTtlMinutes),
    downloadTtlMinutes: toPositiveInt(runtimeConfig.downloadTtlMinutes, legacyConfig.downloadTtlMinutes),
    downloadMaxCount: toPositiveInt(runtimeConfig.downloadMaxCount, legacyConfig.downloadMaxCount),
    cleanupIntervalMinutes: toPositiveInt(runtimeConfig.cleanupIntervalMinutes, legacyConfig.cleanupIntervalMinutes),
    maxConcurrentRequests: toPositiveInt(runtimeConfig.maxConcurrentRequests, legacyConfig.maxConcurrentRequests),
    host: legacyConfig.host,
    port: legacyConfig.port,
  }
}

function createLogger() {
  const write = (level, payload, message) => {
    const entry = typeof payload === 'object' && payload !== null ? payload : undefined
    const text = message || (typeof payload === 'string' ? payload : '')
    const line = entry ? { level, ...entry, msg: text } : { level, msg: text }

    if (level === 'error') {
      console.error(line)
      return
    }

    if (level === 'warn') {
      console.warn(line)
      return
    }

    console.info(line)
  }

  return {
    info: (payload, message) => write('info', payload, message),
    warn: (payload, message) => write('warn', payload, message),
    error: (payload, message) => write('error', payload, message),
    debug: (payload, message) => write('debug', payload, message),
  }
}

async function createRuntime() {
  const config = buildConfig()
  const logger = createLogger()

  const manager = new RequestManager({ dataDir: config.dataDir, logger, config })
  await manager.init()

  const interval = setInterval(() => {
    manager.cleanupExpired().catch((error) => {
      logger.error({ event: 'cleanup.failed', error: error.message }, 'cleanup failed')
    })
  }, config.cleanupIntervalMinutes * 60_000)
  interval.unref()

  return { config, logger, manager, interval }
}

export async function getRuntime() {
  const state = getState()
  if (state.runtime) {
    return state.runtime
  }

  if (!state.initPromise) {
    state.initPromise = createRuntime().then((runtime) => {
      state.runtime = runtime
      return runtime
    })
  }

  return state.initPromise
}
