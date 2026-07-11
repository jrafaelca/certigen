import { setResponseStatus } from 'h3'
import { apiHandler } from '../../utils/api'
import { getRuntime } from '../../utils/runtime'

export default defineEventHandler((event) =>
  apiHandler(event, async () => {
    const { manager } = await getRuntime()
    const body = await readBody(event)
    const created = await manager.createRequest(body || {})
    setResponseStatus(event, 201)
    return created
  }),
)
