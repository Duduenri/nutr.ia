const KEY = "nutri.pendingFriendCode";

export function savePendingFriend(code: string) {
  try {
    sessionStorage.setItem(KEY, code.toUpperCase());
  } catch {
    /* storage indisponível */
  }
}

export function pendingFriend(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearPendingFriend() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* storage indisponível */
  }
}

export function homeAfterLogin(): string {
  return pendingFriend() ? "/amigos" : "/";
}
