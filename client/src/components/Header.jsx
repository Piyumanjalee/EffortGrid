function Header({ isAuthenticated, currentPath, onNavigate, onLogout }) {
  return (
    <header className="relative z-10 border-b border-white/20 bg-white/70 shadow-xl backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-md bg-blue-600 text-sm font-bold text-white">
          EG
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">EffortGrid</p>
          <p className="text-lg font-semibold text-slate-800">Time Tracker</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isAuthenticated ? (
          <>
            <button
              type="button"
              onClick={() => onNavigate("/dashboard")}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                currentPath === "/dashboard" ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-white/70"
              }`}
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-md border border-white/30 bg-white/60 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onNavigate("/login")}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                currentPath === "/login" ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-white/70"
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => onNavigate("/register")}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                currentPath === "/register" ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-white/70"
              }`}
            >
              Register
            </button>
          </>
        )}
      </div>
      </div>
    </header>
  );
}

export default Header;