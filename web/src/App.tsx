import { lazy, Suspense, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Spinner } from "./components/ui";
import { ApiError } from "./lib/api";
import { useProfile } from "./lib/hooks";
import { savePendingFriend } from "./lib/pendingFriend";
import { AuthPage } from "./pages/Auth";
import { DiaryPage } from "./pages/Diary";
import { FastingPage } from "./pages/Fasting";
import { MissionsPage } from "./pages/Missions";
import { PetHomePage } from "./pages/PetHome";
import { Onboarding } from "./pages/Onboarding";

const AddFoodPage = lazy(() =>
  import("./pages/AddFood").then((m) => ({ default: m.AddFoodPage })),
);
const CoachPage = lazy(() =>
  import("./pages/Coach").then((m) => ({ default: m.CoachPage })),
);
const RecipesPage = lazy(() =>
  import("./pages/Recipes").then((m) => ({ default: m.RecipesPage })),
);
const GamesPage = lazy(() =>
  import("./pages/Games").then((m) => ({ default: m.GamesPage })),
);
const TermoPage = lazy(() =>
  import("./pages/Games").then((m) => ({ default: m.TermoPage })),
);
const SudokuPage = lazy(() =>
  import("./pages/Games").then((m) => ({ default: m.SudokuPage })),
);
const ShopPage = lazy(() =>
  import("./pages/Shop").then((m) => ({ default: m.ShopPage })),
);
const WardrobePage = lazy(() =>
  import("./pages/Wardrobe").then((m) => ({ default: m.WardrobePage })),
);
const AchievementsPage = lazy(() =>
  import("./pages/Achievements").then((m) => ({ default: m.AchievementsPage })),
);
const BariPage = lazy(() =>
  import("./pages/Bari").then((m) => ({ default: m.BariPage })),
);
const FriendsPage = lazy(() =>
  import("./pages/Friends").then((m) => ({ default: m.FriendsPage })),
);
const ProfilePage = lazy(() =>
  import("./pages/Profile").then((m) => ({ default: m.ProfilePage })),
);

function PageLoader() {
  return (
    <div className="grid h-64 place-items-center text-mint-500">
      <Spinner />
    </div>
  );
}

export default function App() {
  const { data: profile, isLoading, error } = useProfile();
  const [onboarding, setOnboarding] = useState(false);

  if (isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-mint-100 text-mint-500">
        <Spinner className="h-10 w-10 border-4" />
      </div>
    );
  }

  if (!profile) {
    const add = new URLSearchParams(location.search).get("add");
    if (location.pathname === "/amigos" && add) savePendingFriend(add);
    if (error && !(error instanceof ApiError && error.status === 401)) {
      return (
        <div className="grid min-h-dvh place-items-center p-6 text-center">
          <div>
            <p className="mb-4 font-bold">Não consegui conectar ao servidor.</p>
            <button
              className="font-bold underline"
              onClick={() => window.location.reload()}
            >
              Tentar de novo
            </button>
          </div>
        </div>
      );
    }
    return (
      <Routes>
        <Route path="*" element={<AuthPage />} />
      </Routes>
    );
  }

  if (!profile.onboarded || onboarding) {
    return (
      <Onboarding
        profile={profile}
        onCalculated={() => setOnboarding(true)}
        onFinish={() => setOnboarding(false)}
      />
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/adicionar" element={<AddFoodPage />} />
        <Route path="/loja" element={<ShopPage />} />
        <Route path="/jogos" element={<GamesPage />} />
        <Route path="/jogos/termo" element={<TermoPage />} />
        <Route path="/jogos/sudoku" element={<SudokuPage />} />
        <Route path="/meus-itens" element={<WardrobePage />} />
        <Route element={<Layout />}>
          <Route index element={<DiaryPage />} />
          <Route path="/receitas" element={<RecipesPage />} />
          <Route path="/jejum" element={<FastingPage />} />
          <Route path="/coach" element={<CoachPage />} />
          <Route path="/missoes" element={<MissionsPage />} />
          <Route path="/bichinho" element={<PetHomePage />} />
          <Route path="/conquistas" element={<AchievementsPage />} />
          <Route path="/amigos" element={<FriendsPage />} />
          <Route path="/bari" element={<BariPage />} />
          <Route path="/perfil" element={<ProfilePage profile={profile} />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
