/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type NascentTransactionSummary = {
    value: number;
    currency: string;
    kind: NascentTransactionSummary.kind;
};

export namespace NascentTransactionSummary {

    export enum kind {
        DONATION = 'donation',
        PURCHASE = 'purchase',
    }


}

