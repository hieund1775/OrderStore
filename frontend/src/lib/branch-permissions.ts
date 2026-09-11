/** Store deletion is a Super-only destructive operation. UI visibility is not authorization. */
export function canDeleteBranch(role: string | null | undefined): boolean {
  return role === 'super';
}
