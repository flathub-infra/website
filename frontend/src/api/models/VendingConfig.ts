/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Platform } from './Platform';

/**
 *
 * Global vending environment configuration values
 *
 */
export type VendingConfig = {
    status: string;
    platforms: Record<string, Platform>;
    fee_fixed_cost: number;
    fee_cost_percent: number;
    fee_prefer_percent: number;
};

