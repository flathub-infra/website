/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

/**
 *
 * Any redirect the vending system needs to create will be returned like this.
 *
 * Status will be "ok" otherwise you cannot rely on target_url and instead
 * something look for like error.
 *
 */
export type VendingRedirect = {
    status: string;
    target_url: string;
};

