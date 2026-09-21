import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import AuthCard from '../components/AuthCard.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getErrorMessage } from '../api/client.js';

export default function RegisterPage() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { name: '', email: '', password: '', confirmPassword: '', accountType: 'Tester' } });

  const onSubmit = async ({ confirmPassword: _c, ...payload }) => {
    setServerError('');
    try {
      await registerUser(payload);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setServerError(getErrorMessage(err, 'Registration failed'));
    }
  };

  return (
    <AuthCard
      title="Create your account"
      subtitle="Start tracking bugs with your team"
      footer={<>Already registered? <Link to="/login" className="font-medium text-white underline">Sign in</Link></>}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <ErrorMessage message={serverError} />
        <div>
          <label htmlFor="name" className="label">Full name</label>
          <input id="name" className="input" autoComplete="name" aria-invalid={Boolean(errors.name)}
            {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'Name must be at least 2 characters' } })} />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
        </div>
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" type="email" className="input" autoComplete="email" aria-invalid={Boolean(errors.email)}
            {...register('email', { required: 'Email is required', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email address' } })} />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>
        <div>
          <label htmlFor="accountType" className="label">I am a</label>
          <select id="accountType" className="input" {...register('accountType')}>
            <option value="Tester">Tester (report and verify bugs)</option>
            <option value="Developer">Developer (fix bugs)</option>
          </select>
          <p className="mt-1 text-xs text-slate-500">Admin accounts are created by an administrator.</p>
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input id="password" type="password" className="input" autoComplete="new-password" aria-invalid={Boolean(errors.password)}
            {...register('password', {
              required: 'Password is required',
              minLength: { value: 8, message: 'Password must be at least 8 characters' },
              validate: (v) => (/[A-Za-z]/.test(v) && /[0-9]/.test(v)) || 'Password must contain a letter and a number',
            })} />
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        </div>
        <div>
          <label htmlFor="confirmPassword" className="label">Confirm password</label>
          <input id="confirmPassword" type="password" className="input" autoComplete="new-password" aria-invalid={Boolean(errors.confirmPassword)}
            {...register('confirmPassword', {
              required: 'Please confirm your password',
              validate: (v) => v === watch('password') || 'Passwords do not match',
            })} />
          {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>}
        </div>
        <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 size={16} className="animate-spin" />} Create account
        </button>
      </form>
    </AuthCard>
  );
}
