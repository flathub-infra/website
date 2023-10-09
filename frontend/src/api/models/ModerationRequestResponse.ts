/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { ModerationRequestType } from './ModerationRequestType';

export type ModerationRequestResponse = {
    id: number;
    app_id: string;
    created_at: number;
    build_id: number;
    job_id: number;
    is_outdated: boolean;
    request_type: ModerationRequestType;
    request_data: null;
    is_new_submission: boolean;
    handled_by: (string | null);
    handled_at: (number | null);
    is_approved: (boolean | null);
    comment: (string | null);
};

