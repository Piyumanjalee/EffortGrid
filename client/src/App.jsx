import { useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Header from "./components/Header";
import LoginForm from "./components/LoginForm";
import RegisterForm from "./components/RegisterForm";
import Dashboard from "./components/Dashboard";

const USERS_STORAGE_KEY = "effortgrid-users";
const SESSION_STORAGE_KEY = "effortgrid-session-user";

const readUsers = () => {
  try {
    const raw = window.localStorage.getItem(USERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeUsers = (users) => {
  window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
};

const readSessionUser = () => {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

function ProtectedRoute({ isAuthenticated, children }) {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AuthShell({ children, authMessage, authError }) {
  return (
    <section className="relative z-10 mx-auto mt-10 grid w-full max-w-6xl items-start gap-8 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
      <div className="rounded-3xl border border-white/50 bg-white/35 p-7 shadow-2xl shadow-slate-900/10 backdrop-blur-xl sm:p-10">
        <p className="inline-flex rounded-full bg-blue-100/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
          Authentication Flow
        </p>
        <h1 className="mt-5 text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl">
          Secure access.
          <br />
          Frictionless experience.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
          A polished, responsive entry point for your users with crystal-clear visual hierarchy and smooth transitions.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/60 bg-white/60 p-4">
            <p className="text-sm font-semibold text-slate-800">Premium Glass Layers</p>
            <p className="mt-1 text-sm text-slate-600">Soft blur, subtle borders, and depth-focused shadows.</p>
          </div>
          <div className="rounded-2xl border border-white/60 bg-white/60 p-4">
            <p className="text-sm font-semibold text-slate-800">Blue-Neutral Palette</p>
            <p className="mt-1 text-sm text-slate-600">Balanced tones designed for trust and legibility.</p>
          </div>
        </div>
      </div>

      <div className="animate-rise space-y-4">
        {authMessage ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{authMessage}</p>
        ) : null}
        {authError ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{authError}</p>
        ) : null}
        {children}
      </div>
    </section>
  );
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(() => readSessionUser());
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");

  const isAuthenticated = Boolean(currentUser);

  const clearAuthAlerts = () => {
    setAuthMessage("");
    setAuthError("");
  };

  const handleNavigate = (path) => {
    clearAuthAlerts();
    navigate(path);
  };

  const handleRegister = ({ fullName, email, password, confirmPassword }) => {
    clearAuthAlerts();

    const normalizedEmail = email.trim().toLowerCase();

    if (password.length < 6) {
      setAuthError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setAuthError("Passwords do not match.");
      return;
    }

    const users = readUsers();
    const exists = users.some((user) => user.email === normalizedEmail);

    if (exists) {
      setAuthError("An account with this email already exists.");
      return;
    }

    writeUsers([
      ...users,
      {
        fullName: fullName.trim(),
        email: normalizedEmail,
        password,
      },
    ]);

    setAuthMessage("Registration successful. Please log in with your new account.");
    navigate("/login");
  };

  const handleLogin = ({ email }) => {
    clearAuthAlerts();

    const normalizedEmail = email.trim().toLowerCase();
    const users = readUsers();
    const account = users.find((user) => user.email === normalizedEmail);

    const sessionUser = {
      fullName: account?.fullName || "User",
      email: normalizedEmail || "user@effortgrid.local",
    };

    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionUser));
    setCurrentUser(sessionUser);
    navigate("/dashboard", { replace: true });
  };

  const handleLogout = () => {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    setCurrentUser(null);
    clearAuthAlerts();
    navigate("/login", { replace: true });
  };

  return (
    <main className="relative min-h-screen overflow-hidden pb-10">
      <div className="pointer-events-none absolute -left-16 top-24 h-72 w-72 rounded-full bg-sky-300/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-10 top-12 h-72 w-72 rounded-full bg-blue-400/35 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-200/50 blur-3xl" />

      <Header
        isAuthenticated={isAuthenticated}
        currentPath={location.pathname}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      />

      <Routes>
        <Route
          path="/"
          element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />}
        />
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <AuthShell authMessage={authMessage} authError={authError}>
                <LoginForm onSubmit={handleLogin} />
              </AuthShell>
            )
          }
        />
        <Route
          path="/register"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <AuthShell authMessage={authMessage} authError={authError}>
                <RegisterForm onSubmit={handleRegister} />
              </AuthShell>
            )
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="*"
          element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />}
        />
      </Routes>
    </main>
  );
}

export default App;
