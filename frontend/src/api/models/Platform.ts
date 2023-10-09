/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

/**
 *
 * A platform is an expression of dependencies which an application may have.
 * Applications nominally express a single platform key for themselves, or
 * none at all if they do not need one.  But platforms may depend on one another.
 *
 * If no platform is specified for an application, it's worth getting the default
 * platform and using that.
 *
 */
export type Platform = {
    depends: (string | null);
    aliases: Array<string>;
    keep: number;
    stripe_account: (string | null);
};

