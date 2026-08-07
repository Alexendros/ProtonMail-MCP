import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../../src/bridge/bridge-client.js', () => {
  return {
    BridgeClient: vi.fn().mockImplementation(() => ({
      health: vi.fn().mockResolvedValue({
        ok: true,
        processRunning: true,
        imapListening: true,
        smtpListening: true,
        authOk: true,
      }),
      status: vi.fn().mockResolvedValue({
        user: 'u@proton.me',
        version: '3.15',
        processRunning: true,
        imapListening: true,
        smtpListening: true,
        authOk: true,
      }),
      info: vi.fn().mockResolvedValue({
        user: 'u@proton.me',
        version: '3.15',
        bridgePassword: '***',
      }),
      login: vi.fn().mockResolvedValue({ ok: true, message: 'logged in' }),
      logout: vi.fn().mockResolvedValue({ ok: true }),
      listAccounts: vi.fn().mockResolvedValue([]),
      spawn: vi.fn(),
      shutdown: vi.fn(),
      isRunning: vi.fn().mockReturnValue(true),
    })),
  }
})

import { BridgeClient } from '../../src/bridge/bridge-client.js'
import { registerBridgeTools } from '../../src/server/bridge.js'

const capturedTools = new Map<
  string,
  { config: unknown; handler: (...args: unknown[]) => unknown }
>()

function mockRegister(
  name: string,
  config: unknown,
  handler: (...args: unknown[]) => unknown,
) {
  capturedTools.set(name, { config, handler })
}

const silentLog = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

beforeEach(() => {
  capturedTools.clear()
})

describe('registerBridgeTools — 6 MCP tools', () => {
  it('registra proton_bridge_health', () => {
    const client = new BridgeClient('/bin/fake', silentLog)
    registerBridgeTools(mockRegister, client, silentLog)

    expect(capturedTools.has('proton_bridge_health')).toBe(true)
    const tool = capturedTools.get('proton_bridge_health')!
    expect(tool.config.annotations.readOnlyHint).toBe(true)
    expect(tool.config.annotations.idempotentHint).toBe(true)
  })

  it('registra proton_bridge_status', () => {
    const client = new BridgeClient('/bin/fake', silentLog)
    registerBridgeTools(mockRegister, client, silentLog)

    expect(capturedTools.has('proton_bridge_status')).toBe(true)
    const tool = capturedTools.get('proton_bridge_status')!
    expect(tool.config.annotations.readOnlyHint).toBe(true)
  })

  it('registra proton_bridge_info', () => {
    const client = new BridgeClient('/bin/fake', silentLog)
    registerBridgeTools(mockRegister, client, silentLog)

    expect(capturedTools.has('proton_bridge_info')).toBe(true)
    const tool = capturedTools.get('proton_bridge_info')!
    expect(tool.config.annotations.readOnlyHint).toBe(true)
  })

  it('registra proton_bridge_login', () => {
    const client = new BridgeClient('/bin/fake', silentLog)
    registerBridgeTools(mockRegister, client, silentLog)

    expect(capturedTools.has('proton_bridge_login')).toBe(true)
    const tool = capturedTools.get('proton_bridge_login')!
    expect(tool.config.annotations.readOnlyHint).toBe(false)
    expect(tool.config.annotations.destructiveHint).toBe(true)
  })

  it('registra proton_bridge_logout', () => {
    const client = new BridgeClient('/bin/fake', silentLog)
    registerBridgeTools(mockRegister, client, silentLog)

    expect(capturedTools.has('proton_bridge_logout')).toBe(true)
    const tool = capturedTools.get('proton_bridge_logout')!
    expect(tool.config.annotations.destructiveHint).toBe(true)
  })

  it('registra proton_bridge_accounts', () => {
    const client = new BridgeClient('/bin/fake', silentLog)
    registerBridgeTools(mockRegister, client, silentLog)

    expect(capturedTools.has('proton_bridge_accounts')).toBe(true)
    const tool = capturedTools.get('proton_bridge_accounts')!
    expect(tool.config.annotations.readOnlyHint).toBe(true)
  })

  it('registra exactamente 6 tools', () => {
    const client = new BridgeClient('/bin/fake', silentLog)
    registerBridgeTools(mockRegister, client, silentLog)

    const bridgeTools = Array.from(capturedTools.keys()).filter((n) =>
      n.startsWith('proton_bridge_'),
    )
    expect(bridgeTools).toHaveLength(6)
  })

  it('health handler llama client.health()', async () => {
    const client = new BridgeClient('/bin/fake', silentLog)
    registerBridgeTools(mockRegister, client, silentLog)

    const healthTool = capturedTools.get('proton_bridge_health')!
    const result = await healthTool.handler({ response_format: 'json' })

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(client.health).toHaveBeenCalled()
    expect(result).toBeDefined()
  })

  it('login handler llama client.login() con credenciales', async () => {
    const client = new BridgeClient('/bin/fake', silentLog)
    registerBridgeTools(mockRegister, client, silentLog)

    const loginTool = capturedTools.get('proton_bridge_login')!
    await loginTool.handler({
      user: 'u@proton.me',
      password: 'secret',
      totp: '123456',
    })

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(client.login).toHaveBeenCalledWith('u@proton.me', 'secret', '123456')
  })

  it('logout handler llama client.logout()', async () => {
    const client = new BridgeClient('/bin/fake', silentLog)
    registerBridgeTools(mockRegister, client, silentLog)

    const logoutTool = capturedTools.get('proton_bridge_logout')!
    await logoutTool.handler({})

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(client.logout).toHaveBeenCalled()
  })

  it('accounts handler llama client.listAccounts()', async () => {
    const client = new BridgeClient('/bin/fake', silentLog)
    registerBridgeTools(mockRegister, client, silentLog)

    const accountsTool = capturedTools.get('proton_bridge_accounts')!
    await accountsTool.handler({ response_format: 'markdown' })

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(client.listAccounts).toHaveBeenCalled()
  })
})
