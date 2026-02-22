'use client'

import { Checkbox } from '@/components/ui/checkbox'

interface SelectableCheckboxProps {
  checked: boolean
  selectionIndex: number
  onCheckedChange: () => void
  ariaLabel: string
}

export function SelectableCheckbox({
  checked,
  selectionIndex,
  onCheckedChange,
  ariaLabel,
}: SelectableCheckboxProps) {
  return (
    <div className="relative shrink-0">
      <Checkbox
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={ariaLabel}
      />
      {selectionIndex >= 0 && (
        <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
          {selectionIndex + 1}
        </span>
      )}
    </div>
  )
}
