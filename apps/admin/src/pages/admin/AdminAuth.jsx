// src/pages/admin/AdminAuth.jsx
export default function AdminAuth({ error: externalError }) {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 w-full max-w-sm space-y-4">
        <h1 className="text-xl font-bold text-emerald-400">Admin Login</h1>
        {externalError && (
          <p className="text-red-400 text-sm">{externalError}</p>
        )}
        <p className="text-sm text-gray-400">
          O admin agora usa a sessão principal da aplicação. Entre pelo login padrão com uma conta `admin`.
        </p>
        <button
          type="button"
          onClick={() => window.location.replace('/login')}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg px-4 py-2 text-sm"
        >
          Ir para login
        </button>
      </div>
    </div>
  );
}
