/* tslint:disable */
/* eslint-disable */
/**
 * Flathub API
 * No description provided (generated by Openapi Generator https://github.com/openapitools/openapi-generator)
 *
 * The version of the OpenAPI document: 0.1.0
 *
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */

// May contain unused imports in some cases
// @ts-ignore
import { CheckPurchasesResponse } from "./check-purchases-response"
// May contain unused imports in some cases
// @ts-ignore
import { CheckPurchasesResponseSuccess } from "./check-purchases-response-success"

/**
 *
 * @export
 * @interface ResponseCheckPurchasesPurchasesCheckPurchasesPost
 */
export interface ResponseCheckPurchasesPurchasesCheckPurchasesPost {
  /**
   *
   * @type {string}
   * @memberof ResponseCheckPurchasesPurchasesCheckPurchasesPost
   */
  detail: string
  /**
   *
   * @type {}
   * @memberof ResponseCheckPurchasesPurchasesCheckPurchasesPost
   */
  missing_appids?: null
  /**
   *
   * @type {string}
   * @memberof ResponseCheckPurchasesPurchasesCheckPurchasesPost
   */
  status?: string
}
