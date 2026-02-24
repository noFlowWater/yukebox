import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { promisify } from 'node:util'

const mockExecFilePromise = vi.fn()

vi.mock('node:child_process', () => {
  const fn = vi.fn() as ReturnType<typeof vi.fn> & { [key: symbol]: unknown }
  fn[promisify.custom] = mockExecFilePromise
  return {
    execFile: fn,
    spawn: vi.fn(() => ({
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      stdin: { write: vi.fn() },
      on: vi.fn(),
      kill: vi.fn(),
    })),
  }
})

vi.mock('../../repositories/bluetooth.repository.js', () => ({
  upsert: vi.fn(() => ({ id: 1, address: 'AA:BB:CC:DD:EE:FF', name: 'Speaker', alias: null, sink_name: null, is_connected: 0, created_at: '' })),
  findByAddress: vi.fn(),
  updateSinkName: vi.fn(),
  updateConnectionStatus: vi.fn(),
  findAll: vi.fn(() => []),
  findAllWithSpeaker: vi.fn(() => []),
}))

vi.mock('../../repositories/speaker.repository.js', () => ({
  findByBtDeviceId: vi.fn(),
  insertWithBtDevice: vi.fn(() => ({ id: 1, sink_name: 'sink', display_name: 'Speaker', is_default: 0, default_volume: null, bt_device_id: 1, created_at: '' })),
  count: vi.fn(() => 1),
  setDefault: vi.fn(),
}))

vi.mock('../../services/pulse.service.js', () => ({
  invalidateCache: vi.fn(),
  listSinks: vi.fn(() => []),
}))

vi.mock('../../services/settings.service.js', () => ({
  getBtAutoRegister: vi.fn(() => true),
  getBtScanDuration: vi.fn(() => 10),
  getBtMonitoringInterval: vi.fn(() => 15),
}))

vi.mock('../../services/playback-manager.js', () => ({
  playbackManager: {
    getOrCreateEngine: vi.fn(),
    getEngine: vi.fn(),
  },
}))

function mockExecFileResult(stdout: string): void {
  mockExecFilePromise.mockResolvedValue({ stdout, stderr: '' })
}

function mockExecFileError(message: string): void {
  mockExecFilePromise.mockRejectedValue(new Error(message))
}

describe('bluetooth.service', () => {
  let btService: typeof import('../../services/bluetooth.service.js')

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()

    // Re-mock after resetModules
    vi.doMock('node:child_process', () => {
      const fn = vi.fn() as ReturnType<typeof vi.fn> & { [key: symbol]: unknown }
      fn[promisify.custom] = mockExecFilePromise
      return {
        execFile: fn,
        spawn: vi.fn(() => ({
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
          stdin: { write: vi.fn() },
          on: vi.fn(),
          kill: vi.fn(),
        })),
      }
    })

    vi.doMock('../../repositories/bluetooth.repository.js', () => ({
      upsert: vi.fn(() => ({ id: 1, address: 'AA:BB:CC:DD:EE:FF', name: 'Speaker', alias: null, sink_name: null, is_connected: 0, created_at: '' })),
      findByAddress: vi.fn(),
      updateSinkName: vi.fn(),
      updateConnectionStatus: vi.fn(),
      findAll: vi.fn(() => []),
      findAllWithSpeaker: vi.fn(() => []),
    }))

    vi.doMock('../../repositories/speaker.repository.js', () => ({
      findByBtDeviceId: vi.fn(),
      insertWithBtDevice: vi.fn(() => ({ id: 1, sink_name: 'sink', display_name: 'Speaker', is_default: 0, default_volume: null, bt_device_id: 1, created_at: '' })),
      count: vi.fn(() => 1),
      setDefault: vi.fn(),
    }))

    vi.doMock('../../services/pulse.service.js', () => ({
      invalidateCache: vi.fn(),
      listSinks: vi.fn(() => []),
    }))

    vi.doMock('../../services/settings.service.js', () => ({
      getBtAutoRegister: vi.fn(() => true),
      getBtScanDuration: vi.fn(() => 10),
      getBtMonitoringInterval: vi.fn(() => 15),
    }))

    vi.doMock('../../services/playback-manager.js', () => ({
      playbackManager: {
        getOrCreateEngine: vi.fn(),
        getEngine: vi.fn(),
      },
    }))

    btService = await import('../../services/bluetooth.service.js')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('macToUnderscore / underscoreToMac', () => {
    it('should convert MAC to underscore format', () => {
      expect(btService.macToUnderscore('AA:BB:CC:DD:EE:FF')).toBe('AA_BB_CC_DD_EE_FF')
    })

    it('should convert underscore format back to MAC', () => {
      expect(btService.underscoreToMac('AA_BB_CC_DD_EE_FF')).toBe('AA:BB:CC:DD:EE:FF')
    })
  })

  describe('getAdapterStatus', () => {
    it('should return available and powered when adapter is on', async () => {
      mockExecFileResult('Controller AA:BB:CC:DD:EE:FF MyPC\n\tPowered: yes\n\tDiscoverable: no')

      const status = await btService.getAdapterStatus()
      expect(status.available).toBe(true)
      expect(status.powered).toBe(true)
      expect(status.adapter).toBe('hci0')
    })

    it('should attempt power on when powered off', async () => {
      mockExecFilePromise
        .mockResolvedValueOnce({ stdout: 'Controller AA:BB:CC:DD:EE:FF MyPC\n\tPowered: no', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'Changing power on succeeded', stderr: '' })

      const status = await btService.getAdapterStatus()
      expect(status.available).toBe(true)
      expect(status.powered).toBe(true)
    })

    it('should return unavailable when no adapter found', async () => {
      mockExecFileError('No default controller available')

      const status = await btService.getAdapterStatus()
      expect(status.available).toBe(false)
      expect(status.powered).toBe(false)
    })
  })

  describe('getPairedDevices', () => {
    it('should parse paired-devices output', async () => {
      const btRepo = await import('../../repositories/bluetooth.repository.js')

      // paired-devices call
      mockExecFilePromise
        .mockResolvedValueOnce({
          stdout: 'Device AA:BB:CC:DD:EE:FF JBL Flip 6\nDevice 11:22:33:44:55:66 Mouse\n',
          stderr: '',
        })
        // info for first device (audio sink)
        .mockResolvedValueOnce({
          stdout: 'Device AA:BB:CC:DD:EE:FF\n\tName: JBL Flip 6\n\tPaired: yes\n\tConnected: yes\n\tUUID: Audio Sink (0000110b-0000-1000-8000-00805f9b34fb)',
          stderr: '',
        })
        // info for second device (no audio sink)
        .mockResolvedValueOnce({
          stdout: 'Device 11:22:33:44:55:66\n\tName: Mouse\n\tPaired: yes\n\tConnected: no',
          stderr: '',
        })

      await btService.getPairedDevices()
      // Only the audio sink device should be upserted
      expect(btRepo.upsert).toHaveBeenCalledWith('AA:BB:CC:DD:EE:FF', 'JBL Flip 6')
      expect(btRepo.upsert).toHaveBeenCalledTimes(1)
    })
  })

  describe('intentionalDisconnect tracking', () => {
    it('should track and clear intentional disconnects', () => {
      expect(btService.isIntentionalDisconnect('AA:BB:CC:DD:EE:FF')).toBe(false)
      // We can't directly add to the set from tests, but we test the public API
      btService.clearIntentionalDisconnect('AA:BB:CC:DD:EE:FF')
      expect(btService.isIntentionalDisconnect('AA:BB:CC:DD:EE:FF')).toBe(false)
    })
  })
})
