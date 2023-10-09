/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

/**
 *
 * A request to begin/continue the onboarding process for a user.
 *
 * Any onboarding operation request a 'return' URL which we will tell Stripe
 * to send us back to.
 *
 */
export type VendingOnboardingRequest = {
    return_url: string;
};

