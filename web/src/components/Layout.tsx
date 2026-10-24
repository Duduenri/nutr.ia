import { NavLink, Outlet } from "react-router-dom";

const TABS = [
  { to: "/", label: "Diário", icon: DiaryIcon },
  { to: "/receitas", label: "Receitas", icon: BowlIcon },
  { to: "/coach", label: "Coach", icon: CoachIcon },
  { to: "/missoes", label: "Missões", icon: ChestIcon },
  { to: "/perfil", label: "Perfil", icon: UserIcon },
];

export function Layout() {
  return (
    <div className="mx-auto min-h-dvh max-w-lg pb-24">
      <Outlet />
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-slate-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg">
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 pt-2 text-xs font-semibold ${
                  isActive ? "text-ink" : "text-ink/40"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon active={isActive} />
                  {label}
                </>
              )}
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

function ChestIcon({ active }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="3" y="6" width="18" height="14" rx="3" />
      <path d="M3 11h18" stroke={active ? "white" : "currentColor"} />
      <rect
        x="10"
        y="9.5"
        width="4"
        height="4"
        rx="1"
        fill={active ? "white" : "none"}
        stroke={active ? "white" : "currentColor"}
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
