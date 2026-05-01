"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

export default function AdminLoginPage() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/admin";

  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Forkert adgangskode");
      window.location.href = data.next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fejl");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-bold">Dataadministration</h1>
        <p className="mb-6 text-sm text-gray-500">Angiv adgangskoden for at fortsætte.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            placeholder="Adgangskode"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <Button type="submit" disabled={isLoading || !password}>
            {isLoading ? <><Spinner className="mr-2" />Logger ind…</> : "Log ind"}
          </Button>
        </form>
      </div>
    </main>
  );
}
