function Header({ isAuthenticated, currentPath, onNavigate, onLogout }) {
  return (
    <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 pt-6 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-sm font-bold text-white shadow-lg shadow-blue-500/30">
          EG
        </span>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">EffortGrid</p>
          <p className="text-lg font-semibold text-slate-800">Secure Workspace</p>
        </div>
      </div>

      <div className="rounded-full border border-white/50 bg-white/50 p-1 shadow-lg shadow-slate-900/10 backdrop-blur-xl">
        {isAuthenticated ? (
          <>
            <button
              type="button"
              onClick={() => onNavigate("/dashboard")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                currentPath === "/dashboard" ? "bg-blue-600 text-white shadow" : "text-slate-700 hover:text-slate-900"
              }`}
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition hover:text-slate-900"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onNavigate("/login")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                currentPath === "/login" ? "bg-blue-600 text-white shadow" : "text-slate-700 hover:text-slate-900"
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => onNavigate("/register")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                currentPath === "/register" ? "bg-blue-600 text-white shadow" : "text-slate-700 hover:text-slate-900"
              }`}
            >
              Register
            </button>
          </>
        )}
      </div>
    </header>
  );
}

export default Header;