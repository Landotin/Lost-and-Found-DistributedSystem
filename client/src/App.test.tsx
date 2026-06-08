import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App Component', () => {
  it('renders "Get started" header', () => {
    render(<App />);
    const heading = screen.getByRole('heading', { name: /get started/i });
    expect(heading).toBeInTheDocument();
  });
});
