import { render, screen } from '@testing-library/react'
import App from './App.tsx'

describe('App', () => {
  it('renders the default pilot team header and the team selector', () => {
    render(<App />)
    // Florida is the default pilot; its label renders synchronously from the registry.
    expect(screen.getByRole('heading', { name: /FLORIDA GATORS/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /team/i })).toBeInTheDocument()
    // Tabs are present.
    expect(screen.getByRole('tab', { name: 'OFFENSE' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'RATINGS' })).toBeInTheDocument()
  })

  it('stubs Team Comparison as disabled (coming in M5)', () => {
    render(<App />)
    const cmp = screen.getByRole('button', { name: /team comparison/i })
    expect(cmp).toBeDisabled()
  })
})
