/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

/**
 *
 * The status object says whether the user is capable of receiving payments,
 * and also whether or not there are pending onboarding operations to complete
 *
 */
export type VendingStatus = {
    status: string;
    can_take_payments: boolean;
    needs_attention: boolean;
    details_submitted: boolean;
};

