import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ProfileForm } from "../components/ProfileForm";
import { Button, Card, fmt } from "../components/ui";
import type { Profile } from "../lib/api";

export function Onboarding({
  profile,
  onCalculated,
  onFinish,
}: {
  profile: Profile;
  onCalculated: () => void;
  onFinish: () => void;
}) {
  const [result, setResult] = useState<Profile | null>(null);
  const navigate = useNavigate();

  if (result) {
    return (
      <div className="pt-safe mx-auto min-h-dvh max-w-lg space-y-4 px-5 pb-10">
        <h1 className="pt-6 text-3xl font-extrabold">
          Prontinho, {result.name}! 🎉
        </h1>
        <p className="text-ink/70">
          Calculei suas metas diárias com base no seu perfil. Você pode ajustar
          tudo depois no Perfil.
        </p>
        <Card className="grid grid-cols-2 gap-4 text-center">
          <Stat label="Calorias" value={`${fmt(result.kcalTarget)} kcal`} />
          <Stat label="Proteínas" value={`${fmt(result.proteinTarget)} g`} />
          <Stat label="Carboidratos" value={`${fmt(result.carbsTarget)} g`} />
          <Stat label="Gorduras" value={`${fmt(result.fatTarget)} g`} />
          <Stat
            label="Água"
            value={`${fmt((result.waterTargetMl ?? 0) / 1000, 2)} L`}
          />
          <Stat label="Fibras" value={`${fmt(result.fiberTarget)} g`} />
        </Card>
        <Button
          className="w-full"
          onClick={() => {
            onFinish();
            navigate("/", { replace: true });
          }}
        >
          Começar
        </Button>
      </div>
    );
  }

  return (
    <div className="pt-safe mx-auto min-h-dvh max-w-lg px-5 pb-10">
      <h1 className="pt-6 text-3xl font-extrabold">Vamos te conhecer</h1>
      <p className="mb-6 mt-1 text-ink/70">
        Com isso eu calculo suas calorias, proteínas e quanta água beber por
        dia.
      </p>
      <ProfileForm
        profile={profile}
        submitLabel="Calcular minhas metas"
        onDone={(p) => {
          onCalculated();
          setResult(p);
        }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xl font-extrabold">{value}</div>
      <div className="text-sm text-ink/60">{label}</div>
    </div>
  );
}
