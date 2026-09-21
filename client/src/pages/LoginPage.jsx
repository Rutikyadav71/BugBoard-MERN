import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import AuthCard from '../components/AuthCard.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getErrorMessage } from '../api/client.js';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { email: '', password: '' } });

  // Only follow same-app relative paths (guards against open-redirect via crafted state).
  const rawFrom = location.state?.from;
  const from = typeof rawFrom === 'string' && rawFrom.startsWith('/') && !rawFrom.startsWith('//') ? rawFrom : '/dashboard';

  const onSubmit = async (values) => {
    setServerError('');
    try {
      await login(values);
      navigate(from, { replace: true });
    } catch (err) {
      setServerError(getErrorMessage(err, 'Login failed'));
    }
  };

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to your BugBoard account"
      footer={<>New here? <Link to="/register" className="font-medium text-white underline">Create an account</Link></>}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <ErrorMessage message={serverError} />
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="input"
            placeholder="you@company.com"
            aria-invalid={Boolean(errors.email)}
            {...register('email', {
              required: 'Email is required',
              pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email address' },
            })}
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="input"
            placeholder="••••••••"
            aria-invalid={Boolean(errors.password)}
            {...register('password', { required: 'Password is required' })}
          />
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        </div>
        <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 size={16} className="animate-spin" />} Sign in
        </button>
      </form>
    </AuthCard>
  );
}
