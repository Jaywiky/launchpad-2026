import { vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}))

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}))

import ResourceCard from '@/components/ResourceCard'

const BASE_PROPS = {
  id: 'overpass_1',
  name: 'Test Toilet',
  type: 'toilet',
  address: '10 High St, Birmingham',
  opening_hours: 'Mo-Su 08:00-20:00',
  notes: 'Free to use',
  extended: { accessible: true, baby_change: true },
  distance: 1.23,
  isExpanded: false,
  onToggle: vi.fn(),
  onMapClick: vi.fn(),
}

beforeEach(() => vi.clearAllMocks())

describe('ResourceCard', () => {
  test('renders the resource name', () => {
    render(<ResourceCard {...BASE_PROPS} />)
    expect(screen.getByText('Test Toilet')).toBeInTheDocument()
  })

  test('renders the type label via t()', () => {
    render(<ResourceCard {...BASE_PROPS} />)
    expect(screen.getByText('toilet')).toBeInTheDocument()
  })

  test('renders notes text', () => {
    render(<ResourceCard {...BASE_PROPS} />)
    expect(screen.getByText('Free to use')).toBeInTheDocument()
  })

  test('shows distance badge when distance is provided', () => {
    render(<ResourceCard {...BASE_PROPS} distance={1.23} />)
    expect(screen.getByText('1.2 km')).toBeInTheDocument()
  })

  test('hides distance badge when distance is null', () => {
    render(<ResourceCard {...BASE_PROPS} distance={null} />)
    expect(screen.queryByText(/km/)).not.toBeInTheDocument()
  })

  test('calls onToggle when card is clicked', () => {
    const onToggle = vi.fn()
    render(<ResourceCard {...BASE_PROPS} onToggle={onToggle} />)
    fireEvent.click(screen.getByText('Test Toilet'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  test('calls onMapClick when clicked and not yet expanded', () => {
    const onMapClick = vi.fn()
    render(<ResourceCard {...BASE_PROPS} isExpanded={false} onMapClick={onMapClick} />)
    fireEvent.click(screen.getByText('Test Toilet'))
    expect(onMapClick).toHaveBeenCalledTimes(1)
  })

  test('does not call onMapClick when card is already expanded', () => {
    const onMapClick = vi.fn()
    render(<ResourceCard {...BASE_PROPS} isExpanded={true} onMapClick={onMapClick} />)
    fireEvent.click(screen.getByText('Test Toilet'))
    expect(onMapClick).not.toHaveBeenCalled()
  })

  test('shows address and opening hours when expanded', () => {
    render(<ResourceCard {...BASE_PROPS} isExpanded={true} />)
    expect(screen.getByText('10 High St, Birmingham')).toBeInTheDocument()
    expect(screen.getByText('Mo-Su 08:00-20:00')).toBeInTheDocument()
  })

  test('hides address and opening hours when collapsed', () => {
    render(<ResourceCard {...BASE_PROPS} isExpanded={false} />)
    expect(screen.queryByText('10 High St, Birmingham')).not.toBeInTheDocument()
    expect(screen.queryByText('Mo-Su 08:00-20:00')).not.toBeInTheDocument()
  })

  test('renders unknown extended keys as formatted labels', () => {
    const extended = { radar_key: true }
    render(<ResourceCard {...BASE_PROPS} isExpanded={true} extended={extended} />)
    expect(screen.getByText('Radar Key')).toBeInTheDocument()
  })

  test('does not render extended keys with false value', () => {
    const extended = { accessible: false }
    render(<ResourceCard {...BASE_PROPS} isExpanded={true} extended={extended} />)
    expect(screen.queryByText('Accessible')).not.toBeInTheDocument()
  })
})
