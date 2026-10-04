import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, THEMES } from '../context/ThemeContext';
import ThemeSwitcher from './ThemeSwitcher';

describe('ThemeSwitcher Component', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  test('renders current theme button and opens theme list on click', () => {
    render(
      <ThemeProvider>
        <ThemeSwitcher />
      </ThemeProvider>
    );

    // Initial state: data-theme should be cyber-violet
    expect(document.documentElement.getAttribute('data-theme')).toBe('cyber-violet');

    // Trigger button should be present
    const trigger = screen.getByRole('button', { name: /switch theme/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent('Cyber Violet');

    // Click to open dropdown
    fireEvent.click(trigger);

    // All 5 themes should be in the menu options
    THEMES.forEach((t) => {
      const options = screen.getAllByText(t.name);
      expect(options.length).toBeGreaterThanOrEqual(1);
    });

    // Click on Peak Emerald
    const emeraldOption = screen.getByRole('menuitem', { name: /peak emerald/i });
    fireEvent.click(emeraldOption);

    // Document attribute and localStorage should update
    expect(document.documentElement.getAttribute('data-theme')).toBe('peak-emerald');
    expect(localStorage.getItem('confidence-theme')).toBe('peak-emerald');
  });
});
