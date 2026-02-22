import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { promisify } from 'node:util'

// Create the promisified mock that returns { stdout, stderr }
const mockExecFilePromise = vi.fn()

vi.mock('node:child_process', () => {
  const fn = vi.fn() as ReturnType<typeof vi.fn> & { [key: symbol]: unknown }
  fn[promisify.custom] = mockExecFilePromise
  return { execFile: fn }
})

function mockExecFileResult(stdout: string): void {
  mockExecFilePromise.mockResolvedValue({ stdout, stderr: '' })
}

function mockExecFileError(message: string): void {
  mockExecFilePromise.mockRejectedValue(new Error(message))
}

describe('pulse.service', () => {
  let pulseService: typeof import('../../services/pulse.service.js')

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    pulseService = await import('../../services/pulse.service.js')
    pulseService.invalidateCache()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('listSinks', () => {
    it('should parse multi-line pactl output', async () => {
      const output = [
        '0\talsa_output.pci-0000_00_1f.3.analog-stereo\tmodule-alsa-card.c\ts16le 2ch 44100Hz\tRUNNING',
        '1\tbluez_sink.AA_BB_CC_DD_EE_FF.a2dp_sink\tmodule-bluez5-device.c\ts16le 2ch 44100Hz\tIDLE',
      ].join('\n')

      mockExecFileResult(output)

      const sinks = await pulseService.listSinks()
      expect(sinks).toHaveLength(2)
      expect(sinks[0]).toEqual({
        name: 'alsa_output.pci-0000_00_1f.3.analog-stereo',
        state: 'RUNNING',
      })
      expect(sinks[1]).toEqual({
        name: 'bluez_sink.AA_BB_CC_DD_EE_FF.a2dp_sink',
        state: 'IDLE',
      })
    })

    it('should return empty array for empty output', async () => {
      mockExecFileResult('')

      const sinks = await pulseService.listSinks()
      expect(sinks).toHaveLength(0)
    })

    it('should handle various sink states', async () => {
      const output = [
        '0\tsink1\tdriver\tformat\tRUNNING',
        '1\tsink2\tdriver\tformat\tIDLE',
        '2\tsink3\tdriver\tformat\tSUSPENDED',
      ].join('\n')

      mockExecFileResult(output)

      const sinks = await pulseService.listSinks()
      expect(sinks).toHaveLength(3)
      expect(sinks[0].state).toBe('RUNNING')
      expect(sinks[1].state).toBe('IDLE')
      expect(sinks[2].state).toBe('SUSPENDED')
    })

    it('should use 5s TTL cache', async () => {
      const output = '0\tsink1\tdriver\tformat\tRUNNING\n'
      mockExecFileResult(output)

      const first = await pulseService.listSinks()
      const second = await pulseService.listSinks()

      expect(first).toEqual(second)
      // execFilePromise should only be called once due to cache
      expect(mockExecFilePromise).toHaveBeenCalledTimes(1)
    })

    it('should refresh after invalidateCache', async () => {
      const output = '0\tsink1\tdriver\tformat\tRUNNING\n'
      mockExecFileResult(output)

      await pulseService.listSinks()
      pulseService.invalidateCache()
      await pulseService.listSinks()

      expect(mockExecFilePromise).toHaveBeenCalledTimes(2)
    })

    it('should throw on exec error', async () => {
      mockExecFileError('Command failed')

      await expect(pulseService.listSinks()).rejects.toThrow('Failed to list PulseAudio sinks')
    })

    it('should pass PULSE_SERVER env to execFile', async () => {
      mockExecFileResult('')

      await pulseService.listSinks()

      expect(mockExecFilePromise).toHaveBeenCalledWith(
        'pactl',
        ['list', 'sinks', 'short'],
        expect.objectContaining({
          env: expect.objectContaining({
            PULSE_SERVER: expect.any(String),
          }),
          timeout: 5000,
        }),
      )
    })
  })

  describe('getSinkDetails', () => {
    const verboseOutput = `Sink #0
	State: RUNNING
	Name: alsa_output.pci-0000_00_1f.3.analog-stereo
	Description: Built-in Audio Analog Stereo
	Driver: module-alsa-card.c
	Properties:
		device.string = "front:0"
		device.description = "Built-in Audio"

Sink #1
	State: IDLE
	Name: bluez_sink.AA_BB_CC_DD_EE_FF.a2dp_sink
	Description: WH-1000XM4
	Driver: module-bluez5-device.c
	Properties:
		device.string = "AA:BB:CC:DD:EE:FF"
		device.description = "WH-1000XM4"
`

    it('should parse description and device.string for matching sink', async () => {
      mockExecFileResult(verboseOutput)

      const detail = await pulseService.getSinkDetails('bluez_sink.AA_BB_CC_DD_EE_FF.a2dp_sink')
      expect(detail).toBeDefined()
      expect(detail!.name).toBe('bluez_sink.AA_BB_CC_DD_EE_FF.a2dp_sink')
      expect(detail!.description).toBe('WH-1000XM4')
      expect(detail!.deviceString).toBe('AA:BB:CC:DD:EE:FF')
      expect(detail!.state).toBe('IDLE')
    })

    it('should return first sink details', async () => {
      mockExecFileResult(verboseOutput)

      const detail = await pulseService.getSinkDetails('alsa_output.pci-0000_00_1f.3.analog-stereo')
      expect(detail).toBeDefined()
      expect(detail!.description).toBe('Built-in Audio Analog Stereo')
      expect(detail!.deviceString).toBe('front:0')
      expect(detail!.state).toBe('RUNNING')
    })

    it('should return undefined for non-existent sink', async () => {
      mockExecFileResult(verboseOutput)

      const detail = await pulseService.getSinkDetails('nonexistent_sink')
      expect(detail).toBeUndefined()
    })

    it('should throw on exec error', async () => {
      mockExecFileError('Command failed')

      await expect(pulseService.getSinkDetails('any_sink')).rejects.toThrow('Failed to get sink details')
    })
  })
})
