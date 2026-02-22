'use client'

import { useState, useMemo, useCallback } from 'react'

interface UseMultiSelectResult<T extends { url: string }> {
  selectedOrder: string[]
  selectedSet: Set<string>
  selectedItems: T[]
  totalDuration: number
  toggleSelect: (url: string) => void
  toggleAll: () => void
  clearSelection: () => void
  resetOnChange: (items: T[]) => void
}

export function useMultiSelect<T extends { url: string; duration?: number }>(
  items: T[]
): UseMultiSelectResult<T> {
  const [selectedOrder, setSelectedOrder] = useState<string[]>([])

  const selectedSet = useMemo(() => new Set(selectedOrder), [selectedOrder])

  const selectedItems = useMemo(() => {
    const urlToItem = new Map(items.map((item) => [item.url, item]))
    return selectedOrder.map((url) => urlToItem.get(url)).filter(Boolean) as T[]
  }, [items, selectedOrder])

  const totalDuration = useMemo(
    () => selectedItems.reduce((sum, item) => sum + (item.duration || 0), 0),
    [selectedItems]
  )

  const toggleSelect = useCallback((url: string) => {
    setSelectedOrder((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]
    )
  }, [])

  const toggleAll = useCallback(() => {
    if (selectedOrder.length === items.length) {
      setSelectedOrder([])
    } else {
      setSelectedOrder(items.map((item) => item.url))
    }
  }, [selectedOrder.length, items])

  const clearSelection = useCallback(() => {
    setSelectedOrder([])
  }, [])

  const resetOnChange = useCallback((_items: T[]) => {
    setSelectedOrder([])
  }, [])

  return {
    selectedOrder,
    selectedSet,
    selectedItems,
    totalDuration,
    toggleSelect,
    toggleAll,
    clearSelection,
    resetOnChange,
  }
}
