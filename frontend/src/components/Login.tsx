import { useState } from "react";
import { Anchor } from "lucide-react";
import { api } from "../api";
import { Button } from "./ui/button";
import { resetObfuscateOnLogin } from "../lib/obfuscate";

export function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.login(email, password);
      resetObfuscateOnLogin();
      onLoggedIn();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const inputClass =
    "mb-3 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-indigo-500";

  return (
    <div
      className="flex h-full items-center justify-center bg-slate-950 px-4"
      style={{
        backgroundImage:
          "radial-gradient(circle at 50% 0%, rgba(99,102,241,0.12), transparent 60%), radial-gradient(circle at 100% 100%, rgba(99,102,241,0.06), transparent 50%)",
      }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-[20rem] animate-fade-in rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-sm"
      >
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-600 text-white shadow-lg shadow-indigo-950/50">
            <Anchor className="h-4 w-4" strokeWidth={2.25} />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-none text-slate-100">Portledger</h1>
            <p className="text-[11px] text-slate-600">centro de operaciones</p>
          </div>
        </div>

        <label className="mb-1 block text-xs font-medium text-slate-400">Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} autoFocus />

        <label className="mb-1 block text-xs font-medium text-slate-400">Contraseña</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputClass} mb-4`} />

        {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

        <Button type="submit" className="w-full">
          Entrar
        </Button>
      </form>
    </div>
  );
}
