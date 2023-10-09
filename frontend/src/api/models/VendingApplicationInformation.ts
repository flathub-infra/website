/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

/**
 *
 * Information about an app, including tax code etc
 *
 */
export type VendingApplicationInformation = {
    app_id: string;
    kind: VendingApplicationInformation.kind;
    kind_reason: string;
    foss: boolean;
    foss_reason: string;
};

export namespace VendingApplicationInformation {

    export enum kind {
        GAME = 'GAME',
        PRODUCTIVITY = 'PRODUCTIVITY',
        GENERIC = 'GENERIC',
    }


}

