import { lazy } from 'react';

export const WorkloadChart = lazy(() => import('./WorkloadChart'));
export const RoleDistributionPieChart = lazy(() => import('./RoleDistributionPieChart'));
export const SeriesWorkloadChart = lazy(() => import('./SeriesWorkloadChart'));

export type { WorkloadDatum } from './WorkloadChart';
export type { RoleDatum } from './RoleDistributionPieChart';
export type { SeriesWorkloadDatum } from './SeriesWorkloadChart';
