import { vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key, fallback) => fallback || key }),
}))

vi.mock('@/i18n', () => ({
  default: {
    language: 'en',
    changeLanguage: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/hooks/useBleSync', () => ({
  useBleSync: vi.fn().mockReturnValue({ isActive: false, toggleSync: vi.fn() }),
}))

import Settings from '@/components/Settings'
import i18n from '@/i18n'

const BASE_PROPS = {
  onClose: vi.fn(),
  isActive: false,
  toggleSync: vi.fn(),
  colorBlind: false,
  setColorBlind: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('Settings — rendering', () => {
  test('renders the back button', () => {
    render(<Settings {...BASE_PROPS} />)
    expect(screen.getByText('back')).toBeInTheDocument()
  })

  test('renders language buttons', () => {
    render(<Settings {...BASE_PROPS} />)
    expect(screen.getByText('English')).toBeInTheDocument()
    expect(screen.getByText('Polski')).toBeInTheDocument()
    expect(screen.getByText('اردو')).toBeInTheDocument()
  })

  test('renders P2P toggle button showing "Start P2P" when isActive=false', () => {
    render(<Settings {...BASE_PROPS} isActive={false} />)
    expect(screen.getByText('Start P2P')).toBeInTheDocument()
  })

  test('renders P2P toggle button showing "Stop P2P" when isActive=true', () => {
    render(<Settings {...BASE_PROPS} isActive={true} />)
    expect(screen.getByText('Stop P2P')).toBeInTheDocument()
  })

  test('renders colorblind toggle showing "High Contrast: OFF" when disabled', () => {
    render(<Settings {...BASE_PROPS} colorBlind={false} />)
    expect(screen.getByText('High Contrast: OFF')).toBeInTheDocument()
  })

  test('renders colorblind toggle showing "High Contrast: ON" when enabled', () => {
    render(<Settings {...BASE_PROPS} colorBlind={true} />)
    expect(screen.getByText('High Contrast: ON')).toBeInTheDocument()
  })
})

describe('Settings — interactions', () => {
  test('clicking back button calls onClose', () => {
    const onClose = vi.fn()
    render(<Settings {...BASE_PROPS} onClose={onClose} />)
    fireEvent.click(screen.getByText('back'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('clicking P2P toggle calls toggleSync', () => {
    const toggleSync = vi.fn()
    render(<Settings {...BASE_PROPS} toggleSync={toggleSync} />)
    fireEvent.click(screen.getByText('Start P2P'))
    expect(toggleSync).toHaveBeenCalledTimes(1)
  })

  test('clicking colorblind toggle calls setColorBlind with flipped value', () => {
    const setColorBlind = vi.fn()
    render(<Settings {...BASE_PROPS} colorBlind={false} setColorBlind={setColorBlind} />)
    fireEvent.click(screen.getByText('High Contrast: OFF'))
    expect(setColorBlind).toHaveBeenCalledWith(true)
  })

  test('clicking English sets language in localStorage and calls i18n.changeLanguage', () => {
    render(<Settings {...BASE_PROPS} />)
    fireEvent.click(screen.getByText('English'))
    expect(localStorage.getItem('user-language')).toBe('en')
    expect(i18n.changeLanguage).toHaveBeenCalledWith('en')
  })

  test('clicking Urdu sets document direction to rtl', () => {
    render(<Settings {...BASE_PROPS} />)
    fireEvent.click(screen.getByText('اردو'))
    expect(document.body.dir).toBe('rtl')
  })

  test('clicking Polski sets document direction to ltr', () => {
    document.body.dir = 'rtl'
    render(<Settings {...BASE_PROPS} />)
    fireEvent.click(screen.getByText('Polski'))
    expect(document.body.dir).toBe('ltr')
  })

  test('toggling background permission persists to localStorage', () => {
    render(<Settings {...BASE_PROPS} />)
    fireEvent.click(screen.getByText('Denied'))
    expect(localStorage.getItem('allow-background-p2p')).toBe('true')
  })
})
