import { setResponseStatus } from 'h3'

export async function apiHandler(event, handler) {
  try {
    return await handler()
  } catch (error) {
    const statusCode = error?.statusCode || 500
    const message = error?.message || 'Unexpected error.'
    setResponseStatus(event, statusCode)
    return { error: message }
  }
}
