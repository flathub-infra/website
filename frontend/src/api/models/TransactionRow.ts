/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type TransactionRow = {
    recipient: string;
    amount: number;
    currency: string;
    kind: TransactionRow.kind;
};

export namespace TransactionRow {

    export enum kind {
        DONATION = 'donation',
        PURCHASE = 'purchase',
    }


}

