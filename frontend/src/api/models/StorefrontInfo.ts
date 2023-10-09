/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { PricingInfo } from './PricingInfo';
import type { VerificationStatus } from './VerificationStatus';

export type StorefrontInfo = {
    verification: (VerificationStatus | null);
    pricing: (PricingInfo | null);
    is_free_software: boolean;
};

