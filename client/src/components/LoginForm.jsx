import { useState } from "react";

function LoginForm({ onSubmit }) {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit?.(formData);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full rounded-3xl border border-white/50 bg-white/45 p-6 shadow-2xl shadow-slate-900/15 backdrop-blur-xl sm:p-8"
    >
      <h2 className="text-2xl font-semibold text-slate-900">Welcome Back</h2>
      <p className="mt-2 text-sm text-slate-600">Sign in to continue to your dashboard.</p>

      <div className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">Email</span>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="you@company.com"
            className="w-full rounded-xl border border-white/70 bg-white/75 px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            required
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">Password</span>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Enter your password"
            className="w-full rounded-xl border border-white/70 bg-white/75 px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            required
          />
        </label>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <label className="flex items-center gap-2 text-slate-600">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
          Remember me
        </label>
        <button type="button" className="font-medium text-blue-700 transition hover:text-blue-900">
          Forgot password?
        </button>
      </div>

      <button
        type="submit"
        className="mt-6 w-full rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:from-blue-700 hover:to-sky-600"
      >
        Login
      </button>
    </form>
  );
}

export default LoginForm;