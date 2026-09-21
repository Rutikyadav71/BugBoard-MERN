import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotFoundPage from './NotFoundPage.jsx';

describe('NotFoundPage', () => {
  it('renders a 404 message and a link home', () => {
    render(<MemoryRouter><NotFoundPage /></MemoryRouter>);
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go home/i })).toHaveAttribute('href', '/');
  });
});
