import { useQuery } from "@tanstack/react-query";
import { api, type Routine, type Weekday } from "./api";

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  MON: "Seg",
  TUE: "Ter",
  WED: "Qua",
  THU: "Qui",
  FRI: "Sex",
  SAT: "Sáb",
  SUN: "Dom",
};

export function useRoutines(enabled = true) {
  return useQuery({
    queryKey: ["routines"],
    queryFn: () => api.get<Routine[]>("/routines"),
    enabled,
  });
}
