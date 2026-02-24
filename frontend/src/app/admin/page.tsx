'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Shield, User as UserIcon, ArrowLeft, Loader2, Speaker, Wifi, WifiOff, Star, Plus, MoreVertical, Pencil, Volume2, Settings, Bluetooth, Search } from 'lucide-react'
import { toast } from 'sonner'
import { handleApiError } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useAuth } from '@/hooks/useAuth'
import { useSpeaker } from '@/contexts/SpeakerContext'
import * as api from '@/lib/api'
import type { User, Speaker as SpeakerType, AvailableSink, BluetoothDevice, ScanDevice } from '@/types'

const ROLE_LABELS: Record<User['role'], string> = {
  admin: 'Admin',
  user: 'User',
}

function getRoleIcon(role: User['role']) {
  switch (role) {
    case 'admin':
      return <Shield className="h-4 w-4 text-primary" />
    default:
      return <UserIcon className="h-4 w-4 text-muted-foreground" />
  }
}

function getRoleBadgeVariant(role: User['role']): 'default' | 'secondary' {
  switch (role) {
    case 'admin':
      return 'default'
    default:
      return 'secondary'
  }
}

export default function AdminPage() {
  const router = useRouter()
  const { user: currentUser, loading: authLoading } = useAuth()
  const { refreshSpeakers } = useSpeaker()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  // Speaker management state
  const [speakers, setSpeakers] = useState<SpeakerType[]>([])
  const [availableSinks, setAvailableSinks] = useState<AvailableSink[]>([])
  const [speakersLoading, setSpeakersLoading] = useState(true)
  const [newSpeakerSink, setNewSpeakerSink] = useState('')
  const [newSpeakerName, setNewSpeakerName] = useState('')
  const [renameOpen, setRenameOpen] = useState(false)
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // Global settings state
  const [globalVolume, setGlobalVolume] = useState(60)
  const [globalVolumeSaved, setGlobalVolumeSaved] = useState(60)
  const [settingsLoading, setSettingsLoading] = useState(true)

  // BT settings state
  const [btAutoRegister, setBtAutoRegister] = useState(true)
  const [btAutoRegisterSaved, setBtAutoRegisterSaved] = useState(true)
  const [btAutoReconnect, setBtAutoReconnect] = useState(true)
  const [btAutoReconnectSaved, setBtAutoReconnectSaved] = useState(true)
  const [btScanDuration, setBtScanDuration] = useState(10)
  const [btScanDurationSaved, setBtScanDurationSaved] = useState(10)
  const [btMonitoringInterval, setBtMonitoringInterval] = useState(15)
  const [btMonitoringIntervalSaved, setBtMonitoringIntervalSaved] = useState(15)

  // Speaker volume dialog state
  const [volumeOpen, setVolumeOpen] = useState(false)
  const [volumeSpeakerId, setVolumeSpeakerId] = useState<number | null>(null)
  const [volumeSpeakerName, setVolumeSpeakerName] = useState('')
  const [volumeValue, setVolumeValue] = useState(60)
  const [volumeUseGlobal, setVolumeUseGlobal] = useState(true)

  // Bluetooth state
  const [btAvailable, setBtAvailable] = useState<boolean | null>(null)
  const [btDevices, setBtDevices] = useState<BluetoothDevice[]>([])
  const [btScanning, setBtScanning] = useState(false)
  const [scanResults, setScanResults] = useState<ScanDevice[]>([])
  const [connectingAddress, setConnectingAddress] = useState<string | null>(null)
  const [disconnectingAddress, setDisconnectingAddress] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    try {
      const data = await api.getUsers()
      setUsers(data)
    } catch (err) {
      handleApiError(err, 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchSpeakers = useCallback(async () => {
    try {
      const [speakerList, sinks] = await Promise.all([
        api.getSpeakers(),
        api.getAvailableSinks(),
      ])
      setSpeakers(speakerList)
      setAvailableSinks(sinks)
    } catch (err) {
      handleApiError(err, 'Failed to load speakers')
    } finally {
      setSpeakersLoading(false)
    }
  }, [])

  const fetchSettings = useCallback(async () => {
    try {
      const data = await api.getSettings()
      setGlobalVolume(data.default_volume)
      setGlobalVolumeSaved(data.default_volume)
      setBtAutoRegister(data.bt_auto_register)
      setBtAutoRegisterSaved(data.bt_auto_register)
      setBtAutoReconnect(data.bt_auto_reconnect)
      setBtAutoReconnectSaved(data.bt_auto_reconnect)
      setBtScanDuration(data.bt_scan_duration)
      setBtScanDurationSaved(data.bt_scan_duration)
      setBtMonitoringInterval(data.bt_monitoring_interval)
      setBtMonitoringIntervalSaved(data.bt_monitoring_interval)
    } catch (err) {
      handleApiError(err, 'Failed to load settings')
    } finally {
      setSettingsLoading(false)
    }
  }, [])

  const fetchBluetoothStatus = useCallback(async () => {
    try {
      const status = await api.getBluetoothStatus()
      setBtAvailable(status.available && status.powered)
    } catch {
      setBtAvailable(false)
    }
  }, [])

  const fetchBluetoothDevices = useCallback(async () => {
    try {
      const devices = await api.getBluetoothDevices()
      setBtDevices(devices)
    } catch (err) {
      handleApiError(err, 'Failed to load BT devices')
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!currentUser || currentUser.role !== 'admin') {
      router.push('/')
      return
    }
    fetchUsers()
    fetchSpeakers()
    fetchSettings()
    fetchBluetoothStatus()
    fetchBluetoothDevices()
  }, [authLoading, currentUser, router, fetchUsers, fetchSpeakers, fetchSettings, fetchBluetoothStatus, fetchBluetoothDevices])

  async function handleDelete(userId: number, username: string) {
    if (!confirm(`Delete user "${username}"?`)) return
    try {
      await api.deleteUser(userId)
      setUsers((prev) => prev.filter((u) => u.id !== userId))
      toast.success(`Deleted user: ${username}`)
    } catch (err) {
      handleApiError(err, 'Failed to delete user')
    }
  }

  async function handleRoleChange(userId: number, newRole: User['role']) {
    try {
      const updated = await api.updateUserRole(userId, newRole)
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)))
      toast.success(`Role updated to ${ROLE_LABELS[newRole]}`)
    } catch (err) {
      handleApiError(err, 'Failed to update role')
    }
  }

  async function handleAddSpeaker() {
    if (!newSpeakerSink || !newSpeakerName.trim()) return
    try {
      await api.registerSpeaker(newSpeakerSink, newSpeakerName.trim())
      setNewSpeakerSink('')
      setNewSpeakerName('')
      toast.success('Speaker registered')
      await fetchSpeakers()
      await refreshSpeakers()
    } catch (err) {
      handleApiError(err, 'Failed to register speaker')
    }
  }

  async function handleRemoveSpeaker(id: number, name: string) {
    if (!confirm(`Remove speaker "${name}"?`)) return
    try {
      await api.removeSpeaker(id)
      toast.success(`Removed: ${name}`)
      await fetchSpeakers()
      await refreshSpeakers()
    } catch (err) {
      handleApiError(err, 'Failed to remove speaker')
    }
  }

  async function handleSetDefault(id: number) {
    try {
      await api.setSpeakerDefault(id)
      toast.success('Default speaker updated')
      await fetchSpeakers()
      await refreshSpeakers()
    } catch (err) {
      handleApiError(err, 'Failed to set default')
    }
  }

  function startRename(speaker: SpeakerType) {
    setRenamingId(speaker.id)
    setRenameValue(speaker.display_name)
    setRenameOpen(true)
  }

  async function submitRename() {
    if (renamingId === null) return
    const trimmed = renameValue.trim()
    if (!trimmed) return
    try {
      await api.renameSpeaker(renamingId, trimmed)
      toast.success('Speaker renamed')
      setRenameOpen(false)
      await fetchSpeakers()
      await refreshSpeakers()
    } catch (err) {
      handleApiError(err, 'Failed to rename speaker')
    }
  }

  const settingsDirty =
    globalVolume !== globalVolumeSaved ||
    btAutoRegister !== btAutoRegisterSaved ||
    btAutoReconnect !== btAutoReconnectSaved ||
    btScanDuration !== btScanDurationSaved ||
    btMonitoringInterval !== btMonitoringIntervalSaved

  async function handleSaveSettings() {
    try {
      const body: Record<string, unknown> = {}
      if (globalVolume !== globalVolumeSaved) body.default_volume = globalVolume
      if (btAutoRegister !== btAutoRegisterSaved) body.bt_auto_register = btAutoRegister
      if (btAutoReconnect !== btAutoReconnectSaved) body.bt_auto_reconnect = btAutoReconnect
      if (btScanDuration !== btScanDurationSaved) body.bt_scan_duration = btScanDuration
      if (btMonitoringInterval !== btMonitoringIntervalSaved) body.bt_monitoring_interval = btMonitoringInterval

      await api.updateSettings(body)
      setGlobalVolumeSaved(globalVolume)
      setBtAutoRegisterSaved(btAutoRegister)
      setBtAutoReconnectSaved(btAutoReconnect)
      setBtScanDurationSaved(btScanDuration)
      setBtMonitoringIntervalSaved(btMonitoringInterval)
      toast.success('Settings saved')
    } catch (err) {
      handleApiError(err, 'Failed to save settings')
    }
  }

  function startVolumeEdit(speaker: SpeakerType) {
    setVolumeSpeakerId(speaker.id)
    setVolumeSpeakerName(speaker.display_name)
    const useGlobal = speaker.default_volume === null
    setVolumeUseGlobal(useGlobal)
    setVolumeValue(speaker.default_volume ?? globalVolumeSaved)
    setVolumeOpen(true)
  }

  async function submitVolume() {
    if (volumeSpeakerId === null) return
    try {
      const newVolume = volumeUseGlobal ? null : volumeValue
      await api.updateSpeakerVolume(volumeSpeakerId, newVolume)
      toast.success('Speaker volume updated')
      setVolumeOpen(false)
      await fetchSpeakers()
      await refreshSpeakers()
    } catch (err) {
      handleApiError(err, 'Failed to update speaker volume')
    }
  }

  // Bluetooth handlers
  function handleScan() {
    if (btScanning) return
    setBtScanning(true)
    setScanResults([])

    const es = new EventSource(api.getBluetoothScanStreamUrl())

    es.addEventListener('device', (e) => {
      try {
        const device: ScanDevice = JSON.parse(e.data)
        setScanResults((prev) => {
          if (prev.some((d) => d.address === device.address)) return prev
          return [...prev, device]
        })
      } catch {
        // invalid data
      }
    })

    es.addEventListener('done', () => {
      es.close()
      setBtScanning(false)
      fetchBluetoothDevices()
    })

    es.addEventListener('error', (e) => {
      es.close()
      setBtScanning(false)
      try {
        const evt = e as MessageEvent
        if (evt.data) {
          const err = JSON.parse(evt.data)
          toast.error(err.message || 'Scan failed')
        }
      } catch {
        // SSE connection error
      }
    })

    es.onerror = () => {
      es.close()
      setBtScanning(false)
    }
  }

  async function handleBtConnect(address: string) {
    setConnectingAddress(address)
    try {
      const result = await api.connectBluetoothDevice(address)
      if (result.auto_registered) {
        toast.success(`Connected & registered: ${result.name}`)
      } else {
        toast.success(`Connected: ${result.name}`)
      }
      await fetchBluetoothDevices()
      await fetchSpeakers()
      await refreshSpeakers()
    } catch (err) {
      handleApiError(err, 'Failed to connect')
    } finally {
      setConnectingAddress(null)
    }
  }

  async function handleBtDisconnect(address: string) {
    setDisconnectingAddress(address)
    try {
      await api.disconnectBluetoothDevice(address)
      toast.success('Disconnected')
      await fetchBluetoothDevices()
      await fetchSpeakers()
      await refreshSpeakers()
    } catch (err) {
      handleApiError(err, 'Failed to disconnect')
    } finally {
      setDisconnectingAddress(null)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const hasUserCapability = true

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-6 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          {hasUserCapability && (
            <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <h1 className="text-2xl font-semibold">Administration</h1>
        </div>

        {/* Global Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Global Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {settingsLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Default Volume</span>
                    <span className="text-sm text-muted-foreground">{globalVolume}</span>
                  </div>
                  <Slider
                    value={[globalVolume]}
                    onValueChange={([v]) => setGlobalVolume(v)}
                    min={0}
                    max={100}
                    step={1}
                  />
                </div>

                {btAvailable && (
                  <>
                    <Separator />
                    <p className="text-sm font-medium">Bluetooth Settings</p>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="bt-auto-register"
                        checked={btAutoRegister}
                        onCheckedChange={(checked) => setBtAutoRegister(checked === true)}
                      />
                      <label htmlFor="bt-auto-register" className="text-sm cursor-pointer">
                        Auto Register (register speaker on connect)
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="bt-auto-reconnect"
                        checked={btAutoReconnect}
                        onCheckedChange={(checked) => setBtAutoReconnect(checked === true)}
                      />
                      <label htmlFor="bt-auto-reconnect" className="text-sm cursor-pointer">
                        Auto Reconnect (reconnect on disconnect)
                      </label>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Scan Duration</span>
                        <span className="text-sm text-muted-foreground">{btScanDuration}s</span>
                      </div>
                      <Slider
                        value={[btScanDuration]}
                        onValueChange={([v]) => setBtScanDuration(v)}
                        min={5}
                        max={30}
                        step={1}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Monitoring Interval</span>
                        <span className="text-sm text-muted-foreground">{btMonitoringInterval}s</span>
                      </div>
                      <Slider
                        value={[btMonitoringInterval]}
                        onValueChange={([v]) => setBtMonitoringInterval(v)}
                        min={5}
                        max={60}
                        step={1}
                      />
                    </div>
                  </>
                )}

                <Button
                  onClick={handleSaveSettings}
                  disabled={!settingsDirty}
                  className="self-end"
                  size="sm"
                >
                  Save
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Users ({users.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {getRoleIcon(u.role)}
                  <span className="text-sm font-medium truncate">{u.username}</span>
                  <Badge variant={getRoleBadgeVariant(u.role)} className="shrink-0">
                    {ROLE_LABELS[u.role]}
                  </Badge>
                </div>
                {u.id !== currentUser?.id && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleRoleChange(u.id, u.role === 'admin' ? 'user' : 'admin')}
                      >
                        {u.role === 'admin' ? (
                          <><UserIcon className="h-4 w-4 mr-2" />Demote to User</>
                        ) : (
                          <><Shield className="h-4 w-4 mr-2" />Promote to Admin</>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleDelete(u.id, u.username)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Speaker Management */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Speaker className="h-5 w-5" />
              Speakers ({speakers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {speakersLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : speakers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No speakers registered
              </p>
            ) : (
              speakers.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-col gap-2 rounded-lg border border-border p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium truncate">{s.display_name}</span>
                      {s.active && (
                        <span className="inline-block w-2 h-2 rounded-full bg-success animate-pulse shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={s.online ? 'default' : 'secondary'}>
                        {s.online ? (
                          <><Wifi className="h-3 w-3 mr-1" />Online</>
                        ) : (
                          <><WifiOff className="h-3 w-3 mr-1" />Offline</>
                        )}
                      </Badge>
                      {s.is_default && (
                        <Badge variant="outline">
                          <Star className="h-3 w-3 mr-1" />Default
                        </Badge>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => startRename(s)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => startVolumeEdit(s)}>
                            <Volume2 className="h-4 w-4 mr-2" />
                            Set Volume
                          </DropdownMenuItem>
                          {!s.is_default && (
                            <DropdownMenuItem onClick={() => handleSetDefault(s.id)}>
                              <Star className="h-4 w-4 mr-2" />
                              Set Default
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleRemoveSpeaker(s.id, s.display_name)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground truncate">{s.sink_name}</span>
                </div>
              ))
            )}

            {/* Add Speaker */}
            <Separator />
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Add Speaker</p>
              {availableSinks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No available PulseAudio sinks found.
                </p>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <Select
                    value={newSpeakerSink}
                    onValueChange={setNewSpeakerSink}
                  >
                    <SelectTrigger className="flex-1 h-9 text-sm">
                      <SelectValue placeholder="Select sink" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSinks.map((sink) => (
                        <SelectItem key={sink.sink_name} value={sink.sink_name}>
                          {sink.description} ({sink.sink_name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="text"
                    placeholder="Display name"
                    value={newSpeakerName}
                    onChange={(e) => setNewSpeakerName(e.target.value)}
                    className="sm:w-40"
                  />
                  <Button
                    onClick={handleAddSpeaker}
                    disabled={!newSpeakerSink || !newSpeakerName.trim()}
                    className="shrink-0"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bluetooth Devices */}
        {btAvailable && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bluetooth className="h-5 w-5" />
                Bluetooth Devices ({btDevices.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {btDevices.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2 text-center">
                  No paired BT audio devices
                </p>
              ) : (
                btDevices.map((d) => (
                  <div
                    key={d.id}
                    className="flex flex-col gap-1 rounded-lg border border-border p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium truncate">{d.alias || d.name || d.address}</span>
                        <Badge variant={d.is_connected ? 'default' : 'secondary'}>
                          {d.is_connected ? 'Connected' : 'Disconnected'}
                        </Badge>
                      </div>
                      <div className="shrink-0">
                        {d.is_connected ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleBtDisconnect(d.address)}
                            disabled={disconnectingAddress === d.address}
                          >
                            {disconnectingAddress === d.address ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <WifiOff className="h-3 w-3 mr-1" />
                            )}
                            Disconnect
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleBtConnect(d.address)}
                            disabled={connectingAddress === d.address}
                          >
                            {connectingAddress === d.address ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <Wifi className="h-3 w-3 mr-1" />
                            )}
                            Connect
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{d.address}</span>
                      {d.speaker_name && (
                        <>
                          <span>·</span>
                          <span>Speaker: {d.speaker_name}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}

              <Separator />

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Scan for New Devices</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleScan}
                    disabled={btScanning}
                  >
                    {btScanning ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Search className="h-3 w-3 mr-1" />
                    )}
                    {btScanning ? 'Scanning...' : 'Scan'}
                  </Button>
                </div>

                {scanResults.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {scanResults.map((d) => (
                      <div
                        key={d.address}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border p-3"
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium truncate">{d.name || d.address}</span>
                          <span className="text-xs text-muted-foreground">{d.address}</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleBtConnect(d.address)}
                          disabled={connectingAddress === d.address}
                          className="shrink-0"
                        >
                          {connectingAddress === d.address ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <Plus className="h-3 w-3 mr-1" />
                          )}
                          Pair & Connect
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rename Speaker Dialog */}
        <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename Speaker</DialogTitle>
            </DialogHeader>
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitRename()
              }}
              placeholder="Display name"
              autoFocus
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRenameOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submitRename} disabled={!renameValue.trim()}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Speaker Volume Dialog */}
        <Dialog open={volumeOpen} onOpenChange={setVolumeOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set Volume — {volumeSpeakerName}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="use-global"
                  checked={volumeUseGlobal}
                  onCheckedChange={(checked) => {
                    setVolumeUseGlobal(checked === true)
                    if (checked) setVolumeValue(globalVolumeSaved)
                  }}
                />
                <label htmlFor="use-global" className="text-sm cursor-pointer">
                  Use global default ({globalVolumeSaved})
                </label>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Volume</span>
                  <span className="text-sm text-muted-foreground">{volumeUseGlobal ? globalVolumeSaved : volumeValue}</span>
                </div>
                <Slider
                  value={[volumeUseGlobal ? globalVolumeSaved : volumeValue]}
                  onValueChange={([v]) => {
                    if (!volumeUseGlobal) setVolumeValue(v)
                  }}
                  min={0}
                  max={100}
                  step={1}
                  disabled={volumeUseGlobal}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setVolumeOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submitVolume}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
