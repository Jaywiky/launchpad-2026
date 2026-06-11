import { vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('@/services/sync/bleManager', () => ({
  initializeBleHardware: vi.fn().mockResolvedValue(true),
  startP2PNetwork: vi.fn().mockResolvedValue(undefined),
  stopP2PNetwork: vi.fn().mockResolvedValue(undefined),
}))

import * as BleManager from '@/services/sync/bleManager'
import { useBleSync } from '@/hooks/useBleSync'

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('useBleSync', () => {
  test('defaults isActive to true when nothing is in localStorage and autoStart=true', () => {
    const { result } = renderHook(() => useBleSync(true))
    expect(result.current.isActive).toBe(true)
  })

  test('defaults isActive to false when autoStart=false and nothing is in localStorage', () => {
    const { result } = renderHook(() => useBleSync(false))
    expect(result.current.isActive).toBe(false)
  })

  test('reads initial state from localStorage', () => {
    localStorage.setItem('p2p_active', 'false')
    const { result } = renderHook(() => useBleSync(true))
    expect(result.current.isActive).toBe(false)
  })

  test('toggleSync flips isActive from true to false', () => {
    localStorage.setItem('p2p_active', 'true')
    const { result } = renderHook(() => useBleSync())
    act(() => result.current.toggleSync())
    expect(result.current.isActive).toBe(false)
  })

  test('toggleSync flips isActive from false to true', () => {
    localStorage.setItem('p2p_active', 'false')
    const { result } = renderHook(() => useBleSync())
    act(() => result.current.toggleSync())
    expect(result.current.isActive).toBe(true)
  })

  test('toggleSync persists new state to localStorage', () => {
    localStorage.setItem('p2p_active', 'true')
    const { result } = renderHook(() => useBleSync())
    act(() => result.current.toggleSync())
    expect(localStorage.getItem('p2p_active')).toBe('false')
  })

  test('toggleSync calls startP2PNetwork when toggling on', () => {
    localStorage.setItem('p2p_active', 'false')
    const { result } = renderHook(() => useBleSync())
    act(() => result.current.toggleSync())
    expect(BleManager.startP2PNetwork).toHaveBeenCalled()
  })

  test('toggleSync calls stopP2PNetwork when toggling off', () => {
    localStorage.setItem('p2p_active', 'true')
    const { result } = renderHook(() => useBleSync())
    act(() => result.current.toggleSync())
    expect(BleManager.stopP2PNetwork).toHaveBeenCalled()
  })
})
