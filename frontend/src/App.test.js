import { render, screen } from '@testing-library/react';
import App from './App';

test('renders ConfidenceAI authentication screen by default when not logged in', () => {
  render(<App />);
  expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
});

