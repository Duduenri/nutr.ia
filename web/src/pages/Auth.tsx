import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button, ErrorText, Field, inputClass } from "../components/ui";
import { api } from "../lib/api";

export function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    inviteCode: "",
  });
  const qc = useQueryClient();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: () =>
      mode === "login"
        ? api.post("/auth/login", {
            email: form.email,
            password: form.password,
          })
        : api.post("/auth/register", form),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["profile"] });
      navigate("/", { replace: true });
    },
  });

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <div className="pt-safe mx-auto flex min-h-dvh max-w-lg flex-col bg-mint-100 px-6">
      <div className="flex flex-1 flex-col items-center justify-center py-10">
        <img src="/icon.svg" alt="" className="mb-4 h-24 w-24" />
        <h1 className="text-4xl font-extrabold">
          nutri<span className="text-mint-500">.ia</span>
        </h1>
        <p className="mt-1 text-ink/60">Seu diário de alimentação com IA</p>
      </div>
      <form
        onSubmit={submit}
        className="pb-safe -mx-6 space-y-4 rounded-t-[2rem] bg-white px-6 pt-6"
      >
        <h2 className="text-2xl font-extrabold">
          {mode === "login" ? "Entrar" : "Criar conta"}
        </h2>
        {mode === "register" && (
          <Field label="Seu nome">
            <input
              className={inputClass}
              value={form.name}
              onChange={set("name")}
              autoComplete="given-name"
              required
            />
          </Field>
        )}
        <Field label="E-mail">
          <input
            className={inputClass}
            type="email"
            value={form.email}
            onChange={set("email")}
            autoComplete="email"
            required
          />
        </Field>
        <Field label="Senha">
          <input
            className={inputClass}
            type="password"
            value={form.password}
            onChange={set("password")}
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            minLength={mode === "register" ? 6 : undefined}
            required
          />
        </Field>
        {mode === "register" && (
          <Field label="Código de convite">
            <input
              className={inputClass}
              value={form.inviteCode}
              onChange={set("inviteCode")}
              required
            />
          </Field>
        )}
        <ErrorText error={mutation.error} />
        <Button className="w-full" loading={mutation.isPending}>
          {mode === "login" ? "Entrar" : "Criar conta"}
        </Button>
        <button
          type="button"
          className="w-full py-3 text-sm font-semibold text-ink/60"
          onClick={() => {
            mutation.reset();
            setMode(mode === "login" ? "register" : "login");
          }}
        >
          {mode === "login"
            ? "Primeira vez? Criar conta"
            : "Já tenho conta. Entrar"}
        </button>
      </form>
    </div>
  );
}
