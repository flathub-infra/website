/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { AvailableLoginMethodStatus } from './AvailableLoginMethodStatus';
import type { AvailableMethodType } from './AvailableMethodType';
import type { LoginProvider } from './LoginProvider';

export type AvailableMethod = {
    method: AvailableMethodType;
    website: (string | null);
    website_token: (string | null);
    login_provider: (LoginProvider | null);
    login_name: (string | null);
    login_is_organization: (boolean | null);
    login_status: (AvailableLoginMethodStatus | null);
};

