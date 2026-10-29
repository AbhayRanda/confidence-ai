import { render, screen, act } from '@testing-library/react';
import { toast } from 'react-toastify';
import App from './App';

test('renders ConfidenceAI authentication screen by default when not logged in', () => {
  render(<App />);
  expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
});

test('renders toast notification with visible message text', () => {
  render(<App />);
  act(() => {
    toast.success('Selected: test_video.mp4');
  });
  expect(screen.getByText('Selected: test_video.mp4')).toBeInTheDocument();
});


