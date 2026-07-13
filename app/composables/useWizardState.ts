export function useWizardState() {
  function createSessionId() {
    if (globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID()
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
      const random = Math.floor(Math.random() * 16)
      const value = character === 'x' ? random : (random & 0x3) | 0x8
      return value.toString(16)
    })
  }

  function isValidSessionId(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim())
  }

  const sessionId = useState('wizard-session-id', () => createSessionId())
  if (!isValidSessionId(sessionId.value)) {
    sessionId.value = createSessionId()
  }

  const requestId = useState('wizard-request-id', () => '')
  const email = useState('wizard-email', () => '')
  const request = useState('wizard-request', () => null)
  const submitting = useState('wizard-submitting', () => false)
  const banner = useState('wizard-banner', () => ({
    kind: 'info',
    message: '',
  }))
  const domains = useState('wizard-domains', () => [])
  const wildcard = useState('wizard-wildcard', () => false)
  const certificateAuthority = useState('wizard-certificate-authority', () => 'letsencrypt')
  const resolvers = useState('wizard-resolvers', () => 'system')
  const activeExample = useState('wizard-active-example', () => 'nginx')
  const dnsVerificationAttempted = useState('wizard-dns-verification-attempted', () => false)

  function resetWizardUiState() {
    email.value = ''
    request.value = null
    submitting.value = false
    banner.value = {
      kind: 'info',
      message: '',
    }
    domains.value = []
    wildcard.value = false
    certificateAuthority.value = 'letsencrypt'
    resolvers.value = 'system'
    activeExample.value = 'nginx'
    dnsVerificationAttempted.value = false
  }

  function resetWizardState() {
    requestId.value = ''
    resetWizardUiState()
  }

  return {
    sessionId,
    requestId,
    email,
    request,
    submitting,
    banner,
    domains,
    wildcard,
    certificateAuthority,
    resolvers,
    activeExample,
    dnsVerificationAttempted,
    resetWizardUiState,
    resetWizardState,
  }
}
