import { apiHandler } from '../../../../../utils/api'
import { getRuntime } from '../../../../../utils/runtime'

export default defineEventHandler((event) =>
  apiHandler(event, async () => {
    const { manager } = await getRuntime()
    return manager.verifyChallenge(
      getRouterParam(event, 'requestId'),
      getRouterParam(event, 'challengeId'),
    )
  }),
)
