export function useWizardState() {
  const sessionId = useState('wizard-session-id', () =>
    globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  )
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
