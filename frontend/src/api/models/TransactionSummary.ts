/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type TransactionSummary = {
    id: string;
    value: number;
    currency: string;
    kind: TransactionSummary.kind;
    status: string;
    reason: (string | null);
    created: (number | null);
    updated: (number | null);
};

export namespace TransactionSummary {

    export enum kind {
        DONATION = 'donation',
        PURCHASE = 'purchase',
    }


}

