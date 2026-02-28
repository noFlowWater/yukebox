'use client'

import { Loader2, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'
import type { useAdminSettings } from '../_hooks/useAdminSettings'

interface SettingsSectionProps {
  settings: ReturnType<typeof useAdminSettings>
  btAvailable: boolean | null
}

export function SettingsSection({ settings, btAvailable }: SettingsSectionProps) {
  const {
    globalVolume, setGlobalVolume,
    settingsLoading,
    btAutoRegister, setBtAutoRegister,
    btAutoReconnect, setBtAutoReconnect,
    btScanDuration, setBtScanDuration,
    btMonitoringInterval, setBtMonitoringInterval,
    settingsDirty,
    handleSaveSettings,
  } = settings

  return (
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

            <Separator />
            <p className="text-sm font-medium">Bluetooth Settings</p>
            {btAvailable === null ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking adapter...
              </div>
            ) : btAvailable === false ? (
              <p className="text-sm text-muted-foreground">
                Bluetooth adapter not available. Settings disabled.
              </p>
            ) : (
              <>
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
  )
}
