/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { LoginProvider } from './LoginProvider';
import type { VerificationMethod } from './VerificationMethod';

export type VerificationStatus = {
    verified: boolean;
    timestamp: (string | null);
    method: (VerificationMethod | null);
    website: (string | null);
    login_provider: (LoginProvider | null);
    login_name: (string | null);
    login_is_organization: (boolean | null);
    detail: (string | null);
};

