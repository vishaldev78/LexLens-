"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, UserRoundPlus, ShieldCheck } from "lucide-react";
import { useLang } from "@/components/lexlens/language-provider";

export default function SignupPage() {
  const { t } = useLang();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [age, setAge] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, age, password, email }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t.cm_error);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.cm_error);
      setBusy(false);
    }
  }

  const inputCls =
    "mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100";

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-gradient-to-b from-indigo-50/80 to-transparent" />
      <div className="mx-auto flex max-w-md flex-col px-4 py-14 sm:px-6 sm:py-20">
        <div className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
            <UserRoundPlus className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{t.au_signup_title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{t.au_signup_sub}</p>
        </div>

        <form onSubmit={submit} className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-100">
          <label className="block text-sm font-semibold text-slate-800" htmlFor="su-username">
            {t.au_username}
          </label>
          <input
            id="su-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t.au_username_ph}
            autoComplete="username"
            minLength={3}
            maxLength={24}
            required
            className={inputCls}
          />

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-800" htmlFor="su-age">
                {t.au_age}
              </label>
              <input
                id="su-age"
                type="number"
                min={18}
                max={120}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                required
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-800" htmlFor="su-email">
                {t.au_email}
              </label>
              <input
                id="su-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.au_email_ph}
                className={inputCls}
              />
            </div>
          </div>
          <p className="mt-1.5 text-xs text-slate-400">{t.au_age_hint}</p>

          <label className="mt-4 block text-sm font-semibold text-slate-800" htmlFor="su-password">
            {t.au_password}
          </label>
          <input
            id="su-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t.au_password_ph}
            autoComplete="new-password"
            minLength={8}
            required
            className={inputCls}
          />

          {error && (
            <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-indigo-200 transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {busy ? t.au_working : t.au_signup_cta}
          </button>

          <Link href="/login" className="mt-4 block text-center text-sm font-semibold text-indigo-600 hover:text-indigo-800">
            {t.au_have_account}
          </Link>
        </form>

        <p className="mt-5 flex items-start justify-center gap-2 text-center text-xs leading-relaxed text-slate-500">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
          {t.au_private_note}
        </p>
      </div>
    </div>
  );
}
