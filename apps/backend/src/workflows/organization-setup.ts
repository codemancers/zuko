import {
  markRunning,
  provisionCrm,
  markReady,
  markFailed,
  closeProgress,
} from './organization-setup.steps';

/** Append future required setup steps before markReady. Admin reruns use this same workflow. */
export async function organizationSetup(organizationId: string) {
  'use workflow';
  let step: 'prepare' | 'crm' | 'finish' = 'prepare';
  try {
    await markRunning(organizationId);
    step = 'crm';
    await provisionCrm(organizationId);
    step = 'finish';
    await markReady(organizationId);
  } catch (error) {
    const detail = (error as { message?: unknown } | null)?.message;
    const message =
      typeof detail === 'string' && detail.startsWith('The object key ')
        ? detail
        : 'Organization setup could not finish. Please contact your administrator.';
    await markFailed(organizationId, message, step);
    throw error;
  } finally {
    await closeProgress();
  }
}
