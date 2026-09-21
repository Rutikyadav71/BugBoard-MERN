import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App.jsx';
import { ToastProvider } from './components/Toast.jsx';

export function renderApp(route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ToastProvider><App /></ToastProvider>
    </MemoryRouter>
  );
}

export const fakeUser = {
  _id: 'u1', name: 'Dana Developer', email: 'dana@test.com', role: 'Developer', createdAt: '2026-01-01T00:00:00.000Z',
};
