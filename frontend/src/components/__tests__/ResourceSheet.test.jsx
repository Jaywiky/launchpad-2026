import { vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}))

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, style, className, onClick, onTouchStart, onTouchMove, onTouchEnd }) => (
      <div style={style} className={className} onClick={onClick} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }) => <>{children}</>,
  useMotionValue: (initial) => ({ get: () => initial, set: vi.fn() }),
  animate: vi.fn(),
}))

vi.mock('@/services/storage/fileSystem', () => ({
  emptyStorage: vi.fn().mockResolvedValue(undefined),
  writeJsonFile: vi.fn().mockResolvedValue(true),
}))

import ResourceSheet from '@/components/ResourceSheet'

const FOOD_BANK = { id: 'fb1', name: 'Food Bank A', type: 'food_bank', lat: 52.483, lng: -1.913, address: '1 Main St', notes: null, opening_hours: null, extended: {} }
const TOILET = { id: 'tl1', name: 'Public Toilet', type: 'toilet', lat: 52.484, lng: -1.914, address: '2 High St', notes: null, opening_hours: null, extended: {} }
const LIBRARY = { id: 'lib1', name: 'City Library', type: 'library', lat: 52.485, lng: -1.915, address: '3 Library Rd', notes: null, opening_hours: null, extended: {} }

const BASE_PROPS = {
  resources: [FOOD_BANK, TOILET, LIBRARY],
  isLoading: false,
  activeCategory: ['All'],
  setActiveCategory: vi.fn(),
  userPos: [52.483, -1.913],
  onCardClick: vi.fn(),
}

beforeEach(() => vi.clearAllMocks())

describe('ResourceSheet — loading state', () => {
  test('shows loading text when isLoading is true', () => {
    render(<ResourceSheet {...BASE_PROPS} isLoading={true} />)
    expect(screen.getByText('loading_local_data')).toBeInTheDocument()
  })

  test('does not show loading text when isLoading is false', () => {
    render(<ResourceSheet {...BASE_PROPS} isLoading={false} />)
    expect(screen.queryByText('loading_local_data')).not.toBeInTheDocument()
  })
})

describe('ResourceSheet — empty state', () => {
  test('shows no-resources message when list is empty and not loading', () => {
    render(<ResourceSheet {...BASE_PROPS} resources={[]} />)
    expect(screen.getByText('no_resources_found')).toBeInTheDocument()
  })

  test('does not show no-resources message when there are resources', () => {
    render(<ResourceSheet {...BASE_PROPS} />)
    expect(screen.queryByText('no_resources_found')).not.toBeInTheDocument()
  })
})

describe('ResourceSheet — filtering', () => {
  test('shows all resources when activeCategory is ["All"]', () => {
    render(<ResourceSheet {...BASE_PROPS} activeCategory={['All']} />)
    expect(screen.getByText('Food Bank A')).toBeInTheDocument()
    expect(screen.getByText('Public Toilet')).toBeInTheDocument()
    expect(screen.getByText('City Library')).toBeInTheDocument()
  })

  test('shows only matching resources for a specific category', () => {
    render(<ResourceSheet {...BASE_PROPS} activeCategory={['toilet']} />)
    expect(screen.queryByText('Food Bank A')).not.toBeInTheDocument()
    expect(screen.getByText('Public Toilet')).toBeInTheDocument()
    expect(screen.queryByText('City Library')).not.toBeInTheDocument()
  })

  test('shows resources for multiple selected categories', () => {
    render(<ResourceSheet {...BASE_PROPS} activeCategory={['toilet', 'library']} />)
    expect(screen.queryByText('Food Bank A')).not.toBeInTheDocument()
    expect(screen.getByText('Public Toilet')).toBeInTheDocument()
    expect(screen.getByText('City Library')).toBeInTheDocument()
  })
})

describe('ResourceSheet — filter click logic', () => {
  test('clicking All resets category to ["All"]', () => {
    const setActiveCategory = vi.fn()
    render(<ResourceSheet {...BASE_PROPS} activeCategory={['toilet']} setActiveCategory={setActiveCategory} />)
    fireEvent.click(screen.getByText('all'))
    expect(setActiveCategory).toHaveBeenCalledWith(['All'])
  })

  test('clicking a category that is not active adds it', () => {
    const setActiveCategory = vi.fn()
    render(<ResourceSheet {...BASE_PROPS} activeCategory={['toilet']} setActiveCategory={setActiveCategory} />)
    fireEvent.click(screen.getByText('library'))
    expect(setActiveCategory).toHaveBeenCalledWith(expect.arrayContaining(['toilet', 'library']))
  })

  test('clicking an active category removes it', () => {
    const setActiveCategory = vi.fn()
    render(<ResourceSheet {...BASE_PROPS} activeCategory={['toilet', 'library']} setActiveCategory={setActiveCategory} />)
    fireEvent.click(screen.getByRole('button', { name: 'toilet' }))
    const call = setActiveCategory.mock.calls[0][0]
    expect(call).not.toContain('toilet')
    expect(call).toContain('library')
  })

  test('deselecting last category resets to ["All"]', () => {
    const setActiveCategory = vi.fn()
    render(<ResourceSheet {...BASE_PROPS} activeCategory={['toilet']} setActiveCategory={setActiveCategory} />)
    fireEvent.click(screen.getByRole('button', { name: 'toilet' }))
    expect(setActiveCategory).toHaveBeenCalledWith(['All'])
  })
})
