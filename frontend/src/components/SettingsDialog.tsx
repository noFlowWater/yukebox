'use client'

import { useMemo } from 'react'
import { Settings } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { useAccessibility } from '@/contexts/AccessibilityContext'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { theme, textScale, reduceMotion, highContrast, textWrap, timezone, searchResultCount, updateSettings } = useAccessibility()

  const timezoneGroups = useMemo(() => {
    const allTimezones = Intl.supportedValuesOf('timeZone')
    const groups: Record<string, string[]> = {}
    for (const tz of allTimezones) {
      const region = tz.split('/')[0]
      if (!groups[region]) groups[region] = []
      groups[region].push(tz)
    }
    return groups
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <Separator />

        <div className="flex flex-col gap-5">
          {/* Theme */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Theme</label>
            <Select value={theme} onValueChange={(v) => updateSettings({ theme: v as 'dark' | 'light' | 'system' })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Timezone */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Timezone</label>
            <Select value={timezone} onValueChange={(v) => updateSettings({ timezone: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {Object.entries(timezoneGroups).map(([region, zones]) => (
                  <SelectGroup key={region}>
                    <SelectLabel>{region}</SelectLabel>
                    {zones.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search results count */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Search results</label>
            <Select value={String(searchResultCount)} onValueChange={(v) => updateSettings({ searchResultCount: Number(v) })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[3, 5, 10, 15, 20].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Text size */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Text size</label>
            <Select value={textScale} onValueChange={(v) => updateSettings({ textScale: v as 'default' | 'large' | 'x-large' })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="large">Large</SelectItem>
                <SelectItem value="x-large">X-Large</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reduced motion */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="reduce-motion"
              checked={reduceMotion}
              onCheckedChange={(checked) => updateSettings({ reduceMotion: checked === true })}
              className="mt-0.5"
            />
            <div className="flex flex-col gap-0.5">
              <label htmlFor="reduce-motion" className="text-sm font-medium cursor-pointer">
                Reduced motion
              </label>
              <span className="text-xs text-muted-foreground">Disable animations</span>
            </div>
          </div>

          {/* High contrast */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="high-contrast"
              checked={highContrast}
              onCheckedChange={(checked) => updateSettings({ highContrast: checked === true })}
              className="mt-0.5"
            />
            <div className="flex flex-col gap-0.5">
              <label htmlFor="high-contrast" className="text-sm font-medium cursor-pointer">
                High contrast
              </label>
              <span className="text-xs text-muted-foreground">Increase text contrast</span>
            </div>
          </div>

          {/* Text wrap */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="text-wrap"
              checked={textWrap}
              onCheckedChange={(checked) => updateSettings({ textWrap: checked === true })}
              className="mt-0.5"
            />
            <div className="flex flex-col gap-0.5">
              <label htmlFor="text-wrap" className="text-sm font-medium cursor-pointer">
                Full text display
              </label>
              <span className="text-xs text-muted-foreground">Wrap text instead of truncating with ...</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
