import { NavLink, Outlet, useLocation } from "react-router-dom";
import { AchievementPopup } from "./AchievementPopup";

const PET_ROUTES = ["/bichinho", "/missoes", "/conquistas", "/amigos"];

const TABS = [
  { to: "/", label: "Diário", icon: DiaryIcon },
  { to: "/receitas", label: "Receitas", icon: BowlIcon },
  { to: "/coach", label: "Coach", icon: CoachIcon },
  { to: "/bichinho", label: "Bichinho", icon: SproutIcon },
  { to: "/perfil", label: "Perfil", icon: UserIcon },
];

export function Layout() {
  const { pathname } = useLocation();
  return (
    <div className="mx-auto min-h-dvh max-w-lg pb-24">
      <Outlet />
      <AchievementPopup />
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-slate-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg">
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 pt-2 text-xs font-semibold ${
                  isActive ||
                  (to === "/bichinho" && PET_ROUTES.includes(pathname))
                    ? "text-ink"
                    : "text-ink/40"
                }`
              }
            >
              {({ isActive }) => {
                const active =
                  isActive ||
                  (to === "/bichinho" && PET_ROUTES.includes(pathname));
                return (
                  <>
                    <Icon active={active} />
                    {label}
                  </>
                );
              }}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

type IconProps = { active: boolean };

function DiaryIcon({ active }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="5" y="4" width="14" height="17" rx="3" />
      <path d="M9 4V3h6v1" strokeLinecap="round" />
      <path
        d="M9 11h6M9 15h4"
        stroke={active ? "white" : "currentColor"}
        strokeLinecap="round"
      />
    </svg>
  );
}

function BowlIcon({ active }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M3 11h18a9 9 0 0 1-18 0z" strokeLinejoin="round" />
      <path
        d="M9 7c0-1.5 1-2 1-3.5M13 7c0-1.5 1-2 1-3.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CoachIcon({ active }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="M4 6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-6l-5 4v-4a3 3 0 0 1-2-3z"
        strokeLinejoin="round"
      />
      <path
        d="M9 9.5h.01M12 9.5h.01M15 9.5h.01"
        stroke={active ? "white" : "currentColor"}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SproutIcon({ active }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <ellipse cx="12" cy="17.5" rx="7" ry="4.5" />
      <path d="M12 13V8" strokeLinecap="round" fill="none" />
      <path
        d="M12 9C10 6 7 6 5.5 7.5 7 10 10 10 12 9z"
        strokeLinejoin="round"
      />
      <path
        d="M12 8c2-3.5 5.5-4 7-2.5C17.5 8.5 14.5 9.5 12 8z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UserIcon({ active }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6z" strokeLinejoin="round" />
    </svg>
  );
}
