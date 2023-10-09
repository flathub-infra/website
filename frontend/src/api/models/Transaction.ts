/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { CardInfo } from './CardInfo';
import type { TransactionRow } from './TransactionRow';
import type { TransactionSummary } from './TransactionSummary';

export type Transaction = {
    summary: TransactionSummary;
    card: (CardInfo | null);
    details: Array<TransactionRow>;
    receipt: (string | null);
};

