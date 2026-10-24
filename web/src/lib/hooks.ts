import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type FastingState, type GameState, type Profile } from "./api";

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => api.get<Profile>("/profile"),
    retry: false,
  });
}

export function useInvalidateDay() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["diary"] });
    void qc.invalidateQueries({ queryKey: ["missions"] });
    void qc.invalidateQueries({ queryKey: ["stats"] });
    void qc.invalidateQueries({ queryKey: ["photos"] });
    void qc.invalidateQueries({ queryKey: ["recent"] });
    void qc.invalidateQueries({ queryKey: ["game"] });
  };
}

export function useFasting() {
  return useQuery({
    queryKey: ["fasting"],
    queryFn: () => api.get<FastingState>("/fasting"),
  });
}

export function useGame() {
  return useQuery({
    queryKey: ["game"],
    queryFn: () => api.get<GameState>("/game"),
  });
}
