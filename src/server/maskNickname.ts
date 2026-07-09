export function maskNickname(nickname: string): string {
  if (nickname.length === 0) return nickname;
  const mid = Math.floor(nickname.length / 2);
  return nickname.slice(0, mid) + '*' + nickname.slice(mid + 1);
}
