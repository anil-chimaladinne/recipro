/**
 * UI Badge & Color Helper for Skill Verification Status (Client Safe)
 */
export function getSkillStatusDisplay(status?: string): {
  badgeColor: string;
  textColor: string;
  dotColor: string;
  label: string;
  icon: string;
} {
  switch (status) {
    case 'PLATFORM_VERIFIED':
      return {
        badgeColor: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
        textColor: 'text-emerald-400',
        dotColor: 'bg-emerald-400',
        label: 'Platform Verified',
        icon: '🟢',
      };
    case 'ASSESSMENT_VERIFIED':
      return {
        badgeColor: 'bg-sky-500/15 border-sky-500/30 text-sky-400',
        textColor: 'text-sky-400',
        dotColor: 'bg-sky-400',
        label: 'Assessment Verified',
        icon: '🔵',
      };
    case 'VERIFICATION_FAILED':
      return {
        badgeColor: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
        textColor: 'text-rose-400',
        dotColor: 'bg-rose-400',
        label: 'Reassessment Required',
        icon: '🔴',
      };
    case 'SELF_DECLARED':
    case 'CLAIMED':
    default:
      return {
        badgeColor: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
        textColor: 'text-amber-300',
        dotColor: 'bg-amber-400',
        label: 'Verification Pending',
        icon: '🟠',
      };
  }
}
