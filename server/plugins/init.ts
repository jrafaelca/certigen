import { getRuntime } from '../utils/runtime'

export default defineNitroPlugin(async () => {
  await getRuntime()
})
