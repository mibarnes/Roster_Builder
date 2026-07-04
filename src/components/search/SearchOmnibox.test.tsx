/**
 * F7 search omnibox — opens on ⌘K, lazy-loads the real _searchIndex.json, filters
 * by name, and selects across teams.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchOmnibox from './SearchOmnibox.tsx'

const openWithCmdK = () => fireEvent.keyDown(window, { key: 'k', metaKey: true })

it('opens on ⌘K, searches the index, and selects a player', async () => {
  const onSelect = vi.fn()
  render(<SearchOmnibox onSelect={onSelect} />)

  // Closed initially.
  expect(screen.queryByPlaceholderText(/Search any player/)).not.toBeInTheDocument()

  openWithCmdK()
  // Input appears (placeholder flips to the ready text once the index loads).
  const input = await screen.findByRole('textbox')
  await waitFor(() => expect(input).toHaveAttribute('placeholder', expect.stringMatching(/Search any player/)))

  // A 2+ char query surfaces matching players; pick the first.
  await userEvent.type(input, 'sm')
  const first = await waitFor(() => {
    const btns = screen.getAllByRole('button')
    expect(btns.length).toBeGreaterThan(0)
    return btns[0]!
  })
  await userEvent.click(first)
  expect(onSelect).toHaveBeenCalledWith(expect.any(String), expect.any(String))
})
