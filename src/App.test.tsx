import { render, screen } from '@testing-library/react'
import App from './App.tsx'

describe('App (scaffold placeholder)', () => {
  it('renders the portal heading', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /CFB Roster Portal/i })).toBeInTheDocument()
  })
})
