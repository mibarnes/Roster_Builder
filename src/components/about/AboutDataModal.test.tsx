/** F8 About-the-data modal renders provenance + methodology, closes on ✕. */
import { render, screen, fireEvent } from '@testing-library/react'
import AboutDataModal from './AboutDataModal.tsx'

it('renders sources + rating methodology + team vintage, and closes', () => {
  const onClose = vi.fn()
  render(
    <AboutDataModal
      vintage={{ collectedAt: '2026-07-04T00:00:00.000Z', rosterSeason: 2026, productionSeason: 2025 }}
      onClose={onClose}
    />,
  )
  expect(screen.getByText('About the data')).toBeInTheDocument()
  expect(screen.getByText(/Where it comes from/)).toBeInTheDocument()
  expect(screen.getByText(/How OVR is computed/)).toBeInTheDocument()
  expect(screen.getByText(/2026 roster · 2025 stats/)).toBeInTheDocument()
  fireEvent.click(screen.getByLabelText('Close'))
  expect(onClose).toHaveBeenCalled()
})
