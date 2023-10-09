/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { LoginMethod } from '../models/LoginMethod';

import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';

export class LoginService {

    /**
     * Get Login Kinds
     * Retrieve the login methods available from the backend.
     *
     * For each method returned, flow starts with a `GET` to the endpoint
     * `.../login/{method}` and upon completion from the user-agent, with a `POST`
     * to that same endpoint name.
     *
     * Each method is also given a button icon and some text to use, though
     * frontends with localisation may choose to render other text instead.
     * @returns LoginMethod Successful Response
     * @throws ApiError
     */
    public static getLoginKindsAuthLoginGet(): CancelablePromise<Array<LoginMethod>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/auth/login',
        });
    }

}
