/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AvailableMethods } from '../models/AvailableMethods';
import type { Body_get_download_token_purchases_generate_download_token_post } from '../models/Body_get_download_token_purchases_generate_download_token_post';
import type { BuildNotificationRequest } from '../models/BuildNotificationRequest';
import type { CardInfo } from '../models/CardInfo';
import type { ConnectedAccountProvider } from '../models/ConnectedAccountProvider';
import type { DevelopersResponse } from '../models/DevelopersResponse';
import type { InviteStatus } from '../models/InviteStatus';
import type { LinkResponse } from '../models/LinkResponse';
import type { MainCategory } from '../models/MainCategory';
import type { ModerationApp } from '../models/ModerationApp';
import type { ModerationAppsResponse } from '../models/ModerationAppsResponse';
import type { NascentTransaction } from '../models/NascentTransaction';
import type { OauthLoginResponseFailure } from '../models/OauthLoginResponseFailure';
import type { OauthLoginResponseSuccess } from '../models/OauthLoginResponseSuccess';
import type { Platform } from '../models/Platform';
import type { ProposedPayment } from '../models/ProposedPayment';
import type { RedemptionResult } from '../models/RedemptionResult';
import type { Review } from '../models/Review';
import type { ReviewRequest } from '../models/ReviewRequest';
import type { ReviewRequestResponse } from '../models/ReviewRequestResponse';
import type { SearchQuery } from '../models/SearchQuery';
import type { StorefrontInfo } from '../models/StorefrontInfo';
import type { TokenCancellation } from '../models/TokenCancellation';
import type { TokenList } from '../models/TokenList';
import type { TokenModel } from '../models/TokenModel';
import type { Transaction } from '../models/Transaction';
import type { TransactionSaveCard } from '../models/TransactionSaveCard';
import type { TransactionSortOrder } from '../models/TransactionSortOrder';
import type { UpsertQualityModeration } from '../models/UpsertQualityModeration';
import type { UserDeleteRequest } from '../models/UserDeleteRequest';
import type { VendingApplicationInformation } from '../models/VendingApplicationInformation';
import type { VendingConfig } from '../models/VendingConfig';
import type { VendingOnboardingRequest } from '../models/VendingOnboardingRequest';
import type { VendingOutput } from '../models/VendingOutput';
import type { VendingRedirect } from '../models/VendingRedirect';
import type { VendingSetup } from '../models/VendingSetup';
import type { VendingStatus } from '../models/VendingStatus';
import type { VerificationStatus } from '../models/VerificationStatus';
import type { WebsiteVerificationResult } from '../models/WebsiteVerificationResult';
import type { WebsiteVerificationToken } from '../models/WebsiteVerificationToken';

import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';

export class DefaultService {

    /**
     * Build Notification
     * @param requestBody
     * @returns any Successful Response
     * @throws ApiError
     */
    public static buildNotificationEmailsBuildNotificationPost(
        requestBody: BuildNotificationRequest,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/emails/build-notification',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Preview Templates
     * @returns string Successful Response
     * @throws ApiError
     */
    public static previewTemplatesEmailsPreviewGet(): CancelablePromise<string> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/emails/preview',
        });
    }

    /**
     * Preview Template
     * @param name
     * @returns string Successful Response
     * @throws ApiError
     */
    public static previewTemplateEmailsPreviewNameGet(
        name: string,
    ): CancelablePromise<string> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/emails/preview/{name}',
            path: {
                'name': name,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Start Github Flow
     * Starts a github login flow.  This will set session cookie values and
     * will return a redirect.  The frontend is expected to save the cookie
     * for use later, and follow the redirect to Github
     *
     * Upon return from Github to the frontend, the frontend should POST to this
     * endpoint with the relevant data from Github
     *
     * If the user is already logged in, and has a valid github token stored,
     * then this will return an error instead.
     * @returns any Successful Response
     * @throws ApiError
     */
    public static startGithubFlowAuthLoginGithubGet(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/auth/login/github',
        });
    }

    /**
     * Continue Github Flow
     * Process the result of the Github oauth flow
     *
     * This expects to have some JSON posted to it which (on success) contains:
     *
     * ```
     * {
         * "state": "the state code",
         * "code": "the github oauth code",
         * }
         * ```
         *
         * On failure, the frontend should pass through the state and error so that
         * the backend can clear the flow tokens
         *
         * ```
         * {
             * "state": "the state code",
             * "error": "the error code returned from github",
             * }
             * ```
             *
             * This endpoint will either return an error, if something was wrong in the
             * backend state machines; or it will return a success code with an indication
             * of whether or not the login sequence completed OK.
             * @param requestBody
             * @returns any Successful Response
             * @throws ApiError
             */
            public static continueGithubFlowAuthLoginGithubPost(
                requestBody: (OauthLoginResponseSuccess | OauthLoginResponseFailure),
            ): CancelablePromise<any> {
                return __request(OpenAPI, {
                    method: 'POST',
                    url: '/auth/login/github',
                    body: requestBody,
                    mediaType: 'application/json',
                    errors: {
                        422: `Validation Error`,
                    },
                });
            }

            /**
             * Start Gitlab Flow
             * Starts a gitlab login flow.  This will set session cookie values and
             * will return a redirect.  The frontend is expected to save the cookie
             * for use later, and follow the redirect to Gitlab
             *
             * Upon return from Gitlab to the frontend, the frontend should POST to this
             * endpoint with the relevant data from Gitlab
             *
             * If the user is already logged in, and has a valid gitlab token stored,
             * then this will return an error instead.
             * @returns any Successful Response
             * @throws ApiError
             */
            public static startGitlabFlowAuthLoginGitlabGet(): CancelablePromise<any> {
                return __request(OpenAPI, {
                    method: 'GET',
                    url: '/auth/login/gitlab',
                });
            }

            /**
             * Continue Gitlab Flow
             * Process the result of the Gitlab oauth flow
             *
             * This expects to have some JSON posted to it which (on success) contains:
             *
             * ```
             * {
                 * "state": "the state code",
                 * "code": "the gitlab oauth code",
                 * }
                 * ```
                 *
                 * On failure, the frontend should pass through the state and error so that
                 * the backend can clear the flow tokens
                 *
                 * ```
                 * {
                     * "state": "the state code",
                     * "error": "the error code returned from gitlab",
                     * }
                     * ```
                     *
                     * This endpoint will either return an error, if something was wrong in the
                     * backend state machines; or it will return a success code with an indication
                     * of whether or not the login sequence completed OK.
                     * @param requestBody
                     * @returns any Successful Response
                     * @throws ApiError
                     */
                    public static continueGitlabFlowAuthLoginGitlabPost(
                        requestBody: (OauthLoginResponseSuccess | OauthLoginResponseFailure),
                    ): CancelablePromise<any> {
                        return __request(OpenAPI, {
                            method: 'POST',
                            url: '/auth/login/gitlab',
                            body: requestBody,
                            mediaType: 'application/json',
                            errors: {
                                422: `Validation Error`,
                            },
                        });
                    }

                    /**
                     * Start Gnome Flow
                     * Starts a GNOME login flow.  This will set session cookie values and
                     * will return a redirect.  The frontend is expected to save the cookie
                     * for use later, and follow the redirect to GNOME Gitlab
                     *
                     * Upon return from GNOME to the frontend, the frontend should POST to this
                     * endpoint with the relevant data from GNOME Gitlab
                     *
                     * If the user is already logged in, and has a valid GNOME Gitlab token stored,
                     * then this will return an error instead.
                     * @returns any Successful Response
                     * @throws ApiError
                     */
                    public static startGnomeFlowAuthLoginGnomeGet(): CancelablePromise<any> {
                        return __request(OpenAPI, {
                            method: 'GET',
                            url: '/auth/login/gnome',
                        });
                    }

                    /**
                     * Continue Gnome Flow
                     * Process the result of the GNOME oauth flow
                     *
                     * This expects to have some JSON posted to it which (on success) contains:
                     *
                     * ```
                     * {
                         * "state": "the state code",
                         * "code": "the gitlab oauth code",
                         * }
                         * ```
                         *
                         * On failure, the frontend should pass through the state and error so that
                         * the backend can clear the flow tokens
                         *
                         * ```
                         * {
                             * "state": "the state code",
                             * "error": "the error code returned from GNOME gitlab",
                             * }
                             * ```
                             *
                             * This endpoint will either return an error, if something was wrong in the
                             * backend state machines; or it will return a success code with an indication
                             * of whether or not the login sequence completed OK.
                             * @param requestBody
                             * @returns any Successful Response
                             * @throws ApiError
                             */
                            public static continueGnomeFlowAuthLoginGnomePost(
                                requestBody: (OauthLoginResponseSuccess | OauthLoginResponseFailure),
                            ): CancelablePromise<any> {
                                return __request(OpenAPI, {
                                    method: 'POST',
                                    url: '/auth/login/gnome',
                                    body: requestBody,
                                    mediaType: 'application/json',
                                    errors: {
                                        422: `Validation Error`,
                                    },
                                });
                            }

                            /**
                             * Start Kde Flow
                             * @returns any Successful Response
                             * @throws ApiError
                             */
                            public static startKdeFlowAuthLoginKdeGet(): CancelablePromise<any> {
                                return __request(OpenAPI, {
                                    method: 'GET',
                                    url: '/auth/login/kde',
                                });
                            }

                            /**
                             * Continue Kde Flow
                             * @param requestBody
                             * @returns any Successful Response
                             * @throws ApiError
                             */
                            public static continueKdeFlowAuthLoginKdePost(
                                requestBody: (OauthLoginResponseSuccess | OauthLoginResponseFailure),
                            ): CancelablePromise<any> {
                                return __request(OpenAPI, {
                                    method: 'POST',
                                    url: '/auth/login/kde',
                                    body: requestBody,
                                    mediaType: 'application/json',
                                    errors: {
                                        422: `Validation Error`,
                                    },
                                });
                            }

                            /**
                             * Continue Google Flow
                             * Process the result of the Google oauth flow
                             *
                             * This expects to have some JSON posted to it which (on success) contains:
                             *
                             * ```
                             * {
                                 * "state": "the state code",
                                 * "code": "the google oauth code",
                                 * }
                                 * ```
                                 *
                                 * On failure, the frontend should pass through the state and error so that
                                 * the backend can clear the flow tokens
                                 *
                                 * ```
                                 * {
                                     * "state": "the state code",
                                     * "error": "the error code returned from google",
                                     * }
                                     * ```
                                     *
                                     * This endpoint will either return an error, if something was wrong in the
                                     * backend state machines; or it will return a success code with an indication
                                     * of whether or not the login sequence completed OK.
                                     * @param requestBody
                                     * @returns any Successful Response
                                     * @throws ApiError
                                     */
                                    public static continueGoogleFlowAuthLoginGooglePost(
                                        requestBody: (OauthLoginResponseSuccess | OauthLoginResponseFailure),
                                    ): CancelablePromise<any> {
                                        return __request(OpenAPI, {
                                            method: 'POST',
                                            url: '/auth/login/google',
                                            body: requestBody,
                                            mediaType: 'application/json',
                                            errors: {
                                                422: `Validation Error`,
                                            },
                                        });
                                    }

                                    /**
                                     * Get Userinfo
                                     * Retrieve the current login's user information.  If the user is not logged in
                                     * you will get a `204` return.  Otherwise you will receive JSON describing the
                                     * currently logged in user, for example:
                                     *
                                     * ```
                                     * {
                                         * "displayname": "Mx Human Person",
                                         * "dev-flatpaks": [ "org.people.human.Appname" ],
                                         * "owned-flatpaks": [ "org.foo.bar.Appname" ],
                                         * "accepted-publisher-agreement-at": "2023-06-23T20:38:28.553028"
                                         * }
                                         * ```
                                         *
                                         * If the user has an active github login, you'll also get their github login
                                         * name, and avatar.  If they have some other login, details for that login
                                         * will be provided.
                                         *
                                         * dev-flatpaks is filtered against IDs available in AppStream
                                         * @returns any Successful Response
                                         * @throws ApiError
                                         */
                                        public static getUserinfoAuthUserinfoGet(): CancelablePromise<any> {
                                            return __request(OpenAPI, {
                                                method: 'GET',
                                                url: '/auth/userinfo',
                                            });
                                        }

                                        /**
                                         * Do Refresh Dev Flatpaks
                                         * @returns any Successful Response
                                         * @throws ApiError
                                         */
                                        public static doRefreshDevFlatpaksAuthRefreshDevFlatpaksPost(): CancelablePromise<any> {
                                            return __request(OpenAPI, {
                                                method: 'POST',
                                                url: '/auth/refresh-dev-flatpaks',
                                            });
                                        }

                                        /**
                                         * Do Logout
                                         * Clear the login state.  This will discard tokens which access socials,
                                         * and will clear the session cookie so that the user is not logged in.
                                         * @returns any Successful Response
                                         * @throws ApiError
                                         */
                                        public static doLogoutAuthLogoutPost(): CancelablePromise<any> {
                                            return __request(OpenAPI, {
                                                method: 'POST',
                                                url: '/auth/logout',
                                            });
                                        }

                                        /**
                                         * Get Deleteuser
                                         * Delete a user's login information.
                                         * If they're not logged in, they'll get a `403` return.
                                         * Otherwise they will get an option to delete their account
                                         * and data.
                                         * @returns any Successful Response
                                         * @throws ApiError
                                         */
                                        public static getDeleteuserAuthDeleteuserGet(): CancelablePromise<any> {
                                            return __request(OpenAPI, {
                                                method: 'GET',
                                                url: '/auth/deleteuser',
                                            });
                                        }

                                        /**
                                         * Do Deleteuser
                                         * Clear the login state. This will then delete the user's account
                                         * and associated data. Unless there is an error.
                                         *
                                         * The input to this should be of the form:
                                         *
                                         * ```json
                                         * {
                                             * "token": "...",
                                             * }
                                             * ```
                                             * @param requestBody
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static doDeleteuserAuthDeleteuserPost(
                                                requestBody: UserDeleteRequest,
                                            ): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/auth/deleteuser',
                                                    body: requestBody,
                                                    mediaType: 'application/json',
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Do Agree To Publisher Agreement
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static doAgreeToPublisherAgreementAuthAcceptPublisherAgreementPost(): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/auth/accept-publisher-agreement',
                                                });
                                            }

                                            /**
                                             * Do Change Default Account
                                             * Changes the user's default account, which determines which display name and email we use.
                                             * @param provider
                                             * @returns void
                                             * @throws ApiError
                                             */
                                            public static doChangeDefaultAccountAuthChangeDefaultAccountPost(
                                                provider: ConnectedAccountProvider,
                                            ): CancelablePromise<void> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/auth/change-default-account',
                                                    query: {
                                                        'provider': provider,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Get Moderation Apps
                                             * Get a list of apps with unhandled moderation requests.
                                             * @param newSubmissions
                                             * @param limit
                                             * @param offset
                                             * @returns ModerationAppsResponse Successful Response
                                             * @throws ApiError
                                             */
                                            public static getModerationAppsModerationAppsGet(
                                                newSubmissions?: (boolean | null),
                                                limit: number = 100,
                                                offset?: number,
                                            ): CancelablePromise<ModerationAppsResponse> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/moderation/apps',
                                                    query: {
                                                        'new_submissions': newSubmissions,
                                                        'limit': limit,
                                                        'offset': offset,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Get Moderation App
                                             * Get a list of moderation requests for an app.
                                             * @param appId
                                             * @param includeOutdated
                                             * @param includeHandled
                                             * @param limit
                                             * @param offset
                                             * @returns ModerationApp Successful Response
                                             * @throws ApiError
                                             */
                                            public static getModerationAppModerationAppsAppIdGet(
                                                appId: string,
                                                includeOutdated: boolean = false,
                                                includeHandled: boolean = false,
                                                limit: number = 100,
                                                offset?: number,
                                            ): CancelablePromise<ModerationApp> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/moderation/apps/{app_id}',
                                                    path: {
                                                        'app_id': appId,
                                                    },
                                                    query: {
                                                        'include_outdated': includeOutdated,
                                                        'include_handled': includeHandled,
                                                        'limit': limit,
                                                        'offset': offset,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Submit Review Request
                                             * @param requestBody
                                             * @returns ReviewRequestResponse Successful Response
                                             * @throws ApiError
                                             */
                                            public static submitReviewRequestModerationSubmitReviewRequestPost(
                                                requestBody: ReviewRequest,
                                            ): CancelablePromise<ReviewRequestResponse> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/moderation/submit_review_request',
                                                    body: requestBody,
                                                    mediaType: 'application/json',
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Submit Review
                                             * Approve or reject the moderation request with a comment. If all requests for a job are approved, the job is
                                             * marked as successful in flat-manager.
                                             * @param id
                                             * @param requestBody
                                             * @returns void
                                             * @throws ApiError
                                             */
                                            public static submitReviewModerationRequestsIdReviewPost(
                                                id: number,
                                                requestBody: Review,
                                            ): CancelablePromise<void> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/moderation/requests/{id}/review',
                                                    path: {
                                                        'id': id,
                                                    },
                                                    body: requestBody,
                                                    mediaType: 'application/json',
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Get Walletinfo
                                             * Retrieve the wallet for the currently logged in user.
                                             *
                                             * This will return a list of cards which the user has saved to their account.
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getWalletinfoWalletWalletinfoGet(): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/wallet/walletinfo',
                                                });
                                            }

                                            /**
                                             * Post Removecard
                                             * Remove a card from a user's wallet.
                                             *
                                             * The provided information must exactly match a card as would be returned from the
                                             * wallet info endpoint.
                                             * @param requestBody
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static postRemovecardWalletRemovecardPost(
                                                requestBody: CardInfo,
                                            ): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/wallet/removecard',
                                                    body: requestBody,
                                                    mediaType: 'application/json',
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Get Transactions
                                             * Return a list of transactions associated with this user.
                                             *
                                             * If anything goes wrong, an error will be returned, otherwise a list of transaction
                                             * summaries will be returned.
                                             * @param sort
                                             * @param since
                                             * @param limit
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getTransactionsWalletTransactionsGet(
                                                sort?: TransactionSortOrder,
                                                since?: (string | null),
                                                limit: number = 100,
                                            ): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/wallet/transactions',
                                                    query: {
                                                        'sort': sort,
                                                        'since': since,
                                                        'limit': limit,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Create Transaction
                                             * Create a new transaction, return the ID.
                                             *
                                             * If the passed in nascent transaction is valid, this will create a transaction and
                                             * return the ID of the newly created wallet, otherwise it'll return an error
                                             * @param requestBody
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static createTransactionWalletTransactionsPost(
                                                requestBody: NascentTransaction,
                                            ): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/wallet/transactions',
                                                    body: requestBody,
                                                    mediaType: 'application/json',
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Get Transaction By Id
                                             * Retrieve a transaction by its ID
                                             *
                                             * If the transaction ID is valid, and owned by the calling user, then this will
                                             * retrieve the whole transaction, including card details and disbursement information
                                             * if available.
                                             * @param txn
                                             * @returns Transaction Successful Response
                                             * @throws ApiError
                                             */
                                            public static getTransactionByIdWalletTransactionsTxnGet(
                                                txn: string,
                                            ): CancelablePromise<Transaction> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/wallet/transactions/{txn}',
                                                    path: {
                                                        'txn': txn,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Set Transaction Card
                                             * Set the card associated with a transaction.
                                             *
                                             * The posted card must exactly match one of the cards returned by the wallet
                                             * info endpoint or else the update may not succeed
                                             * @param txn
                                             * @param requestBody
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static setTransactionCardWalletTransactionsTxnSetcardPost(
                                                txn: string,
                                                requestBody: CardInfo,
                                            ): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/wallet/transactions/{txn}/setcard',
                                                    path: {
                                                        'txn': txn,
                                                    },
                                                    body: requestBody,
                                                    mediaType: 'application/json',
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Cancel Transaction
                                             * Cancel a transaction in the `new` or `retry` states.
                                             *
                                             * Note that this may actually not cancel if a webhook fires asynchronously
                                             * and updates the transaction.  This API will not attempt to prevent stripe
                                             * payments from completing.
                                             * @param txn
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static cancelTransactionWalletTransactionsTxnCancelPost(
                                                txn: string,
                                            ): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/wallet/transactions/{txn}/cancel',
                                                    path: {
                                                        'txn': txn,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Get Stripedata
                                             * Return the stripe public key to use in the frontend.  Since this is not
                                             * considered secret, we don't need a login or anything for this
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getStripedataWalletStripedataGet(): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/wallet/stripedata',
                                                });
                                            }

                                            /**
                                             * Get Txn Stripedata
                                             * Return the Stripe data associated with the given transaction.
                                             *
                                             * This is only applicable to transactions in the `new` or `retry` state and
                                             * will only work for transactions which *are* Stripe transactions.
                                             * @param txn
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getTxnStripedataWalletTransactionsTxnStripeGet(
                                                txn: string,
                                            ): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/wallet/transactions/{txn}/stripe',
                                                    path: {
                                                        'txn': txn,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Set Savecard
                                             * Set the save-card status.
                                             *
                                             * This is only applicable to transactions in the `new` or `retry` state
                                             * and will only work for transactions which are backed by stripe or similar.
                                             *
                                             * If the `save_card` parameter is null, then the card will not be saved,
                                             * otherwise it will be saved.  If it's set to `off_session` then an attempt
                                             * will be made to create a saved method which can be used without the user
                                             * re-authenticating
                                             * @param txn
                                             * @param requestBody
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static setSavecardWalletTransactionsTxnSavecardPost(
                                                txn: string,
                                                requestBody: TransactionSaveCard,
                                            ): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/wallet/transactions/{txn}/savecard',
                                                    path: {
                                                        'txn': txn,
                                                    },
                                                    body: requestBody,
                                                    mediaType: 'application/json',
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Set Pending
                                             * Set the transaction as 'pending' so that we can recover if Stripe
                                             * flows don't quite work (e.g. webhook goes missing)
                                             * @param txn
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static setPendingWalletTransactionsTxnSetpendingPost(
                                                txn: string,
                                            ): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/wallet/transactions/{txn}/setpending',
                                                    path: {
                                                        'txn': txn,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Webhook
                                             * This endpoint is intended to deal with webhooks coming back from payment
                                             * mechanisms etc.  It exists only for the deployed wallet, so its name
                                             * will vary with the deployed wallet kind.
                                             *
                                             * The exact form of the content posted to the webhook will vary from wallet
                                             * kind to wallet kind.
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static webhookWalletWebhookStripePost(): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/wallet/webhook/stripe',
                                                });
                                            }

                                            /**
                                             * Status
                                             * Retrieve the vending status of the logged in user.
                                             *
                                             * This will return `201` if the logged in user has never begun the onboarding
                                             * flow to be a vendor on Flathub.
                                             * @returns VendingStatus Successful Response
                                             * @throws ApiError
                                             */
                                            public static statusVendingStatusGet(): CancelablePromise<VendingStatus> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/vending/status',
                                                });
                                            }

                                            /**
                                             * Start Onboarding
                                             * Start or continue the onboarding process.
                                             * @param requestBody
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static startOnboardingVendingStatusOnboardingPost(
                                                requestBody: VendingOnboardingRequest,
                                            ): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/vending/status/onboarding',
                                                    body: requestBody,
                                                    mediaType: 'application/json',
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Get Dashboard Link
                                             * Retrieve a link to the logged in user's Stripe express dashboard.
                                             *
                                             * The user must be logged in and must have onboarded.
                                             * @returns VendingRedirect Successful Response
                                             * @throws ApiError
                                             */
                                            public static getDashboardLinkVendingStatusDashboardlinkGet(): CancelablePromise<VendingRedirect> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/vending/status/dashboardlink',
                                                });
                                            }

                                            /**
                                             * Get Global Vending Config
                                             * Retrieve the configuration values needed to calculate application
                                             * vending splits client-side.
                                             *
                                             * Configuration includes:
                                             * - Fee values
                                             * - Platform values
                                             * @returns VendingConfig Successful Response
                                             * @throws ApiError
                                             */
                                            public static getGlobalVendingConfigVendingConfigGet(): CancelablePromise<VendingConfig> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/vending/config',
                                                });
                                            }

                                            /**
                                             * Get App Vending Setup
                                             * Retrieve the vending status for a given application.  Returns a no
                                             * content response if the appid has no vending setup.
                                             * @param appId
                                             * @returns VendingSetup Successful Response
                                             * @throws ApiError
                                             */
                                            public static getAppVendingSetupVendingappAppIdSetupGet(
                                                appId: string,
                                            ): CancelablePromise<VendingSetup> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/vendingapp/{app_id}/setup',
                                                    path: {
                                                        'app_id': appId,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Post App Vending Setup
                                             * Create/update the vending status for a given application.  Returns an error
                                             * if the appid is not known, or if it's already set up for vending with a
                                             * user other than the one calling this API.
                                             *
                                             * If you do not have the right to set the vending status for this application
                                             * then you will also be refused.
                                             *
                                             * In addition, if any of the currency or amount values constraints are violated
                                             * then you will get an error
                                             * @param appId
                                             * @param requestBody
                                             * @returns VendingSetup Successful Response
                                             * @throws ApiError
                                             */
                                            public static postAppVendingSetupVendingappAppIdSetupPost(
                                                appId: string,
                                                requestBody: VendingSetup,
                                            ): CancelablePromise<VendingSetup> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/vendingapp/{app_id}/setup',
                                                    path: {
                                                        'app_id': appId,
                                                    },
                                                    body: requestBody,
                                                    mediaType: 'application/json',
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Post App Vending Status
                                             * Construct a transaction for the given application with the proposed payment.
                                             * If the proposed payment is unacceptable then an error will be returned.
                                             * If the user is not logged in, then an error will be returned.
                                             *
                                             * Otherwise a transaction will be created and the information about it will be
                                             * returned in the output of the call.
                                             * @param appId
                                             * @param requestBody
                                             * @returns VendingOutput Successful Response
                                             * @throws ApiError
                                             */
                                            public static postAppVendingStatusVendingappAppIdPost(
                                                appId: string,
                                                requestBody: ProposedPayment,
                                            ): CancelablePromise<VendingOutput> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/vendingapp/{app_id}',
                                                    path: {
                                                        'app_id': appId,
                                                    },
                                                    body: requestBody,
                                                    mediaType: 'application/json',
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Get Redeemable Tokens
                                             * Retrieve the redeemable tokens for the given application.
                                             *
                                             * The caller must have control of the app at some level
                                             *
                                             * For now, there is no pagination or filtering, all tokens will be returned
                                             * @param appId
                                             * @returns TokenList Successful Response
                                             * @throws ApiError
                                             */
                                            public static getRedeemableTokensVendingappAppIdTokensGet(
                                                appId: string,
                                            ): CancelablePromise<TokenList> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/vendingapp/{app_id}/tokens',
                                                    path: {
                                                        'app_id': appId,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Create Tokens
                                             * Create some tokens for the given appid.
                                             *
                                             * The calling user must own the vending config for this application
                                             * @param appId
                                             * @param requestBody
                                             * @returns TokenModel Successful Response
                                             * @throws ApiError
                                             */
                                            public static createTokensVendingappAppIdTokensPost(
                                                appId: string,
                                                requestBody: Array<string>,
                                            ): CancelablePromise<Array<TokenModel>> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/vendingapp/{app_id}/tokens',
                                                    path: {
                                                        'app_id': appId,
                                                    },
                                                    body: requestBody,
                                                    mediaType: 'application/json',
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Cancel Tokens
                                             * Cancel a set of tokens
                                             * @param appId
                                             * @param requestBody
                                             * @returns TokenCancellation Successful Response
                                             * @throws ApiError
                                             */
                                            public static cancelTokensVendingappAppIdTokensCancelPost(
                                                appId: string,
                                                requestBody: Array<string>,
                                            ): CancelablePromise<Array<TokenCancellation>> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/vendingapp/{app_id}/tokens/cancel',
                                                    path: {
                                                        'app_id': appId,
                                                    },
                                                    body: requestBody,
                                                    mediaType: 'application/json',
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Redeem Token
                                             * This redeems the given token for the logged in user.
                                             *
                                             * If the logged in user already owns the app then the token will not be redeemed
                                             * @param appId
                                             * @param token
                                             * @returns RedemptionResult Successful Response
                                             * @throws ApiError
                                             */
                                            public static redeemTokenVendingappAppIdTokensRedeemTokenPost(
                                                appId: string,
                                                token: string,
                                            ): CancelablePromise<RedemptionResult> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/vendingapp/{app_id}/tokens/redeem/{token}',
                                                    path: {
                                                        'app_id': appId,
                                                        'token': token,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * App Info
                                             * This determines the vending info for the app and returns it
                                             * @param appId
                                             * @returns VendingApplicationInformation Successful Response
                                             * @throws ApiError
                                             */
                                            public static appInfoVendingappAppIdInfoGet(
                                                appId: string,
                                            ): CancelablePromise<VendingApplicationInformation> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/vendingapp/{app_id}/info',
                                                    path: {
                                                        'app_id': appId,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Get Verification Status
                                             * Gets the verification status of the given app.
                                             * @param appId
                                             * @returns VerificationStatus Successful Response
                                             * @throws ApiError
                                             */
                                            public static getVerificationStatusVerificationAppIdStatusGet(
                                                appId: string,
                                            ): CancelablePromise<VerificationStatus> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/verification/{app_id}/status',
                                                    path: {
                                                        'app_id': appId,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Get Available Methods
                                             * Gets the ways an app may be verified.
                                             * @param appId
                                             * @param newApp
                                             * @returns AvailableMethods Successful Response
                                             * @throws ApiError
                                             */
                                            public static getAvailableMethodsVerificationAppIdAvailableMethodsGet(
                                                appId: string,
                                                newApp: boolean = false,
                                            ): CancelablePromise<AvailableMethods> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/verification/{app_id}/available-methods',
                                                    path: {
                                                        'app_id': appId,
                                                    },
                                                    query: {
                                                        'new_app': newApp,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Verify By Login Provider
                                             * If the current account is eligible to verify the given account via SSO, and the app is not already verified by
                                             * someone else, marks the app as verified.
                                             * @param appId
                                             * @param newApp
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static verifyByLoginProviderVerificationAppIdVerifyByLoginProviderPost(
                                                appId: string,
                                                newApp: boolean = false,
                                            ): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/verification/{app_id}/verify-by-login-provider',
                                                    path: {
                                                        'app_id': appId,
                                                    },
                                                    query: {
                                                        'new_app': newApp,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Request Organization Access Github
                                             * Returns the URL to request access to the organization so we can verify the user's membership.
                                             * @returns LinkResponse Successful Response
                                             * @throws ApiError
                                             */
                                            public static requestOrganizationAccessGithubVerificationRequestOrganizationAccessGithubGet(): CancelablePromise<LinkResponse> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/verification/request-organization-access/github',
                                                });
                                            }

                                            /**
                                             * Setup Website Verification
                                             * Creates a token for the user to verify the app via website.
                                             * @param appId
                                             * @param newApp
                                             * @returns WebsiteVerificationToken Successful Response
                                             * @throws ApiError
                                             */
                                            public static setupWebsiteVerificationVerificationAppIdSetupWebsiteVerificationPost(
                                                appId: string,
                                                newApp: boolean = false,
                                            ): CancelablePromise<WebsiteVerificationToken> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/verification/{app_id}/setup-website-verification',
                                                    path: {
                                                        'app_id': appId,
                                                    },
                                                    query: {
                                                        'new_app': newApp,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Confirm Website Verification
                                             * Checks website verification, and if it succeeds, marks the app as verified for the current account.
                                             * @param appId
                                             * @param newApp
                                             * @returns WebsiteVerificationResult Successful Response
                                             * @throws ApiError
                                             */
                                            public static confirmWebsiteVerificationVerificationAppIdConfirmWebsiteVerificationPost(
                                                appId: string,
                                                newApp: boolean = false,
                                            ): CancelablePromise<WebsiteVerificationResult> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/verification/{app_id}/confirm-website-verification',
                                                    path: {
                                                        'app_id': appId,
                                                    },
                                                    query: {
                                                        'new_app': newApp,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Unverify
                                             * If the current account has verified the given app, mark it as no longer verified.
                                             * @param appId
                                             * @returns void
                                             * @throws ApiError
                                             */
                                            public static unverifyVerificationAppIdUnverifyPost(
                                                appId: string,
                                            ): CancelablePromise<void> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/verification/{app_id}/unverify',
                                                    path: {
                                                        'app_id': appId,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Get Storefront Info
                                             * This endpoint is used by the flathub-hooks scripts to get information about an app to insert into the appstream
                                             * file and commit metadata.
                                             * @param appId
                                             * @returns StorefrontInfo Successful Response
                                             * @throws ApiError
                                             */
                                            public static getStorefrontInfoPurchasesStorefrontInfoGet(
                                                appId: string,
                                            ): CancelablePromise<StorefrontInfo> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/purchases/storefront-info',
                                                    query: {
                                                        'app_id': appId,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Get Is Free Software
                                             * Gets whether the app is Free Software based on the app ID and license, even if the app is not in the appstream
                                             * database yet. This is needed in flat-manager-hooks to run validations the first time an app is uploaded.
                                             * @param appId
                                             * @param license
                                             * @returns boolean Successful Response
                                             * @throws ApiError
                                             */
                                            public static getIsFreeSoftwarePurchasesStorefrontInfoIsFreeSoftwareGet(
                                                appId: string,
                                                license?: (string | null),
                                            ): CancelablePromise<boolean> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/purchases/storefront-info/is-free-software',
                                                    query: {
                                                        'app_id': appId,
                                                        'license': license,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Get Update Token
                                             * Generates an update token for a user account. This token allows the user to generate download tokens for apps they
                                             * already own, but does not grant permission to do anything else. By storing this token, flathub-authenticator is
                                             * able to update apps without user interaction.
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getUpdateTokenPurchasesGenerateUpdateTokenPost(): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/purchases/generate-update-token',
                                                });
                                            }

                                            /**
                                             * Check Purchases
                                             * Checks whether the logged in user is able to download all of the given app refs.
                                             *
                                             * App IDs can be in the form of full refs, e.g. "app/org.gnome.Maps/x86_64/stable", or just the app ID, e.g.
                                             * "org.gnome.Maps".
                                             * @param requestBody
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static checkPurchasesPurchasesCheckPurchasesPost(
                                                requestBody: Array<string>,
                                            ): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/purchases/check-purchases',
                                                    body: requestBody,
                                                    mediaType: 'application/json',
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Get Download Token
                                             * Generates a download token for the given app IDs. App IDs should be in the form of full refs, e.g.
                                             * "app/org.gnome.Maps/x86_64/stable".
                                             * @param requestBody
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getDownloadTokenPurchasesGenerateDownloadTokenPost(
                                                requestBody: Body_get_download_token_purchases_generate_download_token_post,
                                            ): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/purchases/generate-download-token',
                                                    body: requestBody,
                                                    mediaType: 'application/json',
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Get Invite Status
                                             * @param appId
                                             * @returns InviteStatus Successful Response
                                             * @throws ApiError
                                             */
                                            public static getInviteStatusInvitesAppIdGet(
                                                appId: string,
                                            ): CancelablePromise<InviteStatus> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/invites/{app_id}',
                                                    path: {
                                                        'app_id': appId,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Invite Developer
                                             * @param appId
                                             * @param inviteCode
                                             * @returns void
                                             * @throws ApiError
                                             */
                                            public static inviteDeveloperInvitesAppIdInvitePost(
                                                appId: string,
                                                inviteCode: string,
                                            ): CancelablePromise<void> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/invites/{app_id}/invite',
                                                    path: {
                                                        'app_id': appId,
                                                    },
                                                    query: {
                                                        'invite_code': inviteCode,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Accept Invite
                                             * @param appId
                                             * @returns void
                                             * @throws ApiError
                                             */
                                            public static acceptInviteInvitesAppIdAcceptPost(
                                                appId: string,
                                            ): CancelablePromise<void> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/invites/{app_id}/accept',
                                                    path: {
                                                        'app_id': appId,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Decline Invite
                                             * @param appId
                                             * @returns void
                                             * @throws ApiError
                                             */
                                            public static declineInviteInvitesAppIdDeclinePost(
                                                appId: string,
                                            ): CancelablePromise<void> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/invites/{app_id}/decline',
                                                    path: {
                                                        'app_id': appId,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Leave Team
                                             * @param appId
                                             * @returns void
                                             * @throws ApiError
                                             */
                                            public static leaveTeamInvitesAppIdLeavePost(
                                                appId: string,
                                            ): CancelablePromise<void> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/invites/{app_id}/leave',
                                                    path: {
                                                        'app_id': appId,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Get Developers
                                             * @param appId
                                             * @returns DevelopersResponse Successful Response
                                             * @throws ApiError
                                             */
                                            public static getDevelopersInvitesAppIdDevelopersGet(
                                                appId: string,
                                            ): CancelablePromise<DevelopersResponse> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/invites/{app_id}/developers',
                                                    path: {
                                                        'app_id': appId,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Remove Developer
                                             * @param appId
                                             * @param developerId
                                             * @returns void
                                             * @throws ApiError
                                             */
                                            public static removeDeveloperInvitesAppIdRemoveDeveloperPost(
                                                appId: string,
                                                developerId: number,
                                            ): CancelablePromise<void> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/invites/{app_id}/remove-developer',
                                                    path: {
                                                        'app_id': appId,
                                                    },
                                                    query: {
                                                        'developer_id': developerId,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Revoke Invite
                                             * @param appId
                                             * @param inviteId
                                             * @returns void
                                             * @throws ApiError
                                             */
                                            public static revokeInviteInvitesAppIdRevokePost(
                                                appId: string,
                                                inviteId: number,
                                            ): CancelablePromise<void> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/invites/{app_id}/revoke',
                                                    path: {
                                                        'app_id': appId,
                                                    },
                                                    query: {
                                                        'invite_id': inviteId,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Get Apps
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getAppsCompatAppsGet(): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/compat/apps',
                                                });
                                            }

                                            /**
                                             * Get Apps In Category
                                             * @param category
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getAppsInCategoryCompatAppsCategoryCategoryGet(
                                                category: string,
                                            ): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/compat/apps/category/{category}',
                                                    path: {
                                                        'category': category,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Get Recently Updated
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getRecentlyUpdatedCompatAppsCollectionRecentlyUpdated50Get(): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/compat/apps/collection/recently-updated/50',
                                                });
                                            }

                                            /**
                                             * Get Recently Updated
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getRecentlyUpdatedCompatAppsCollectionRecentlyUpdatedGet(): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/compat/apps/collection/recently-updated',
                                                });
                                            }

                                            /**
                                             * Get Recently Added
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getRecentlyAddedCompatAppsCollectionNew50Get(): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/compat/apps/collection/new/50',
                                                });
                                            }

                                            /**
                                             * Get Recently Added
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getRecentlyAddedCompatAppsCollectionNewGet(): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/compat/apps/collection/new',
                                                });
                                            }

                                            /**
                                             * Get Popular Apps
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getPopularAppsCompatAppsCollectionPopular50Get(): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/compat/apps/collection/popular/50',
                                                });
                                            }

                                            /**
                                             * Get Popular Apps
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getPopularAppsCompatAppsCollectionPopularGet(): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/compat/apps/collection/popular',
                                                });
                                            }

                                            /**
                                             * Get Search
                                             * @param query
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getSearchCompatAppsSearchQueryGet(
                                                query: string,
                                            ): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/compat/apps/search/{query}',
                                                    path: {
                                                        'query': query,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Get Single App
                                             * @param appId
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getSingleAppCompatAppsAppIdGet(
                                                appId: string,
                                            ): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/compat/apps/{app_id}',
                                                    path: {
                                                        'app_id': appId,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Get Quality Moderation Status
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getQualityModerationStatusQualityModerationStatusGet(): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/quality-moderation/status',
                                                });
                                            }

                                            /**
                                             * Get Quality Moderation For App
                                             * @param appId
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getQualityModerationForAppQualityModerationAppIdGet(
                                                appId: string,
                                            ): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/quality-moderation/{app_id}',
                                                    path: {
                                                        'app_id': appId,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Set Quality Moderation For App
                                             * @param appId
                                             * @param requestBody
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static setQualityModerationForAppQualityModerationAppIdPost(
                                                appId: string,
                                                requestBody: UpsertQualityModeration,
                                            ): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/quality-moderation/{app_id}',
                                                    path: {
                                                        'app_id': appId,
                                                    },
                                                    body: requestBody,
                                                    mediaType: 'application/json',
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Get Quality Moderation Status For App
                                             * @param appId
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getQualityModerationStatusForAppQualityModerationAppIdStatusGet(
                                                appId: string,
                                            ): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/quality-moderation/{app_id}/status',
                                                    path: {
                                                        'app_id': appId,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Update
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static updateUpdatePost(): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/update',
                                                });
                                            }

                                            /**
                                             * Update Stats
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static updateStatsUpdateStatsPost(): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/update/stats',
                                                });
                                            }

                                            /**
                                             * Process Transfers
                                             * Process any pending transfers which may be in the system
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static processTransfersUpdateProcessPendingTransfersPost(): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/update/process-pending-transfers',
                                                });
                                            }

                                            /**
                                             * Get Categories
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getCategoriesCategoriesGet(): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/categories',
                                                });
                                            }

                                            /**
                                             * Get Category
                                             * @param category
                                             * @param page
                                             * @param perPage
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getCategoryCategoryCategoryGet(
                                                category: MainCategory,
                                                page?: (number | null),
                                                perPage?: (number | null),
                                            ): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/category/{category}',
                                                    path: {
                                                        'category': category,
                                                    },
                                                    query: {
                                                        'page': page,
                                                        'per_page': perPage,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Get Subcategory
                                             * @param category
                                             * @param subcategory
                                             * @param page
                                             * @param perPage
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getSubcategoryCategoryCategorySubcategoriesSubcategoryGet(
                                                category: MainCategory,
                                                subcategory: string,
                                                page?: (number | null),
                                                perPage?: (number | null),
                                            ): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/category/{category}/subcategories/{subcategory}',
                                                    path: {
                                                        'category': category,
                                                        'subcategory': subcategory,
                                                    },
                                                    query: {
                                                        'page': page,
                                                        'per_page': perPage,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Get Developers
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getDevelopersDeveloperGet(): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/developer',
                                                });
                                            }

                                            /**
                                             * Get Developer
                                             * @param developer
                                             * @param page
                                             * @param perPage
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getDeveloperDeveloperDeveloperGet(
                                                developer: string,
                                                page?: (number | null),
                                                perPage?: (number | null),
                                            ): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/developer/{developer}',
                                                    path: {
                                                        'developer': developer,
                                                    },
                                                    query: {
                                                        'page': page,
                                                        'per_page': perPage,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Get Eol Rebase
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getEolRebaseEolRebaseGet(): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/eol/rebase',
                                                });
                                            }

                                            /**
                                             * Get Eol Rebase Appid
                                             * @param appId
                                             * @param branch
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getEolRebaseAppidEolRebaseAppIdGet(
                                                appId: string,
                                                branch: string = 'stable',
                                            ): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/eol/rebase/{app_id}',
                                                    path: {
                                                        'app_id': appId,
                                                    },
                                                    query: {
                                                        'branch': branch,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Get Eol Message
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getEolMessageEolMessageGet(): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/eol/message',
                                                });
                                            }

                                            /**
                                             * Get Eol Message Appid
                                             * @param appId
                                             * @param branch
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getEolMessageAppidEolMessageAppIdGet(
                                                appId: string,
                                                branch: string = 'stable',
                                            ): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/eol/message/{app_id}',
                                                    path: {
                                                        'app_id': appId,
                                                    },
                                                    query: {
                                                        'branch': branch,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Get Project Groups
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getProjectGroupsProjectgroupGet(): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/projectgroup',
                                                });
                                            }

                                            /**
                                             * Get Project Group
                                             * @param projectGroup
                                             * @param page
                                             * @param perPage
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getProjectGroupProjectgroupProjectGroupGet(
                                                projectGroup: string,
                                                page?: (number | null),
                                                perPage?: (number | null),
                                            ): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/projectgroup/{project_group}',
                                                    path: {
                                                        'project_group': projectGroup,
                                                    },
                                                    query: {
                                                        'page': page,
                                                        'per_page': perPage,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * List Appstream
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static listAppstreamAppstreamGet(): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/appstream',
                                                });
                                            }

                                            /**
                                             * Get Appstream
                                             * @param appId
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getAppstreamAppstreamAppIdGet(
                                                appId: string,
                                            ): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/appstream/{app_id}',
                                                    path: {
                                                        'app_id': appId,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Post Search
                                             * @param requestBody
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static postSearchSearchPost(
                                                requestBody: SearchQuery,
                                            ): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'POST',
                                                    url: '/search',
                                                    body: requestBody,
                                                    mediaType: 'application/json',
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Get Runtime List
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getRuntimeListRuntimesGet(): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/runtimes',
                                                });
                                            }

                                            /**
                                             * Get Recently Updated
                                             * @param page
                                             * @param perPage
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getRecentlyUpdatedCollectionRecentlyUpdatedGet(
                                                page?: (number | null),
                                                perPage?: (number | null),
                                            ): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/collection/recently-updated',
                                                    query: {
                                                        'page': page,
                                                        'per_page': perPage,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Get Recently Added
                                             * @param page
                                             * @param perPage
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getRecentlyAddedCollectionRecentlyAddedGet(
                                                page?: (number | null),
                                                perPage?: (number | null),
                                            ): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/collection/recently-added',
                                                    query: {
                                                        'page': page,
                                                        'per_page': perPage,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Get Verified
                                             * @param page
                                             * @param perPage
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getVerifiedCollectionVerifiedGet(
                                                page?: (number | null),
                                                perPage?: (number | null),
                                            ): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/collection/verified',
                                                    query: {
                                                        'page': page,
                                                        'per_page': perPage,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Get Popular Last Month
                                             * @param page
                                             * @param perPage
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getPopularLastMonthPopularLastMonthGet(
                                                page?: (number | null),
                                                perPage?: (number | null),
                                            ): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/popular/last-month',
                                                    query: {
                                                        'page': page,
                                                        'per_page': perPage,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Get Recently Updated Apps Feed
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getRecentlyUpdatedAppsFeedFeedRecentlyUpdatedGet(): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/feed/recently-updated',
                                                });
                                            }

                                            /**
                                             * Get New Apps Feed
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getNewAppsFeedFeedNewGet(): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/feed/new',
                                                });
                                            }

                                            /**
                                             * Healthcheck
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static healthcheckStatusGet(): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/status',
                                                });
                                            }

                                            /**
                                             * Get Stats
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getStatsStatsGet(): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/stats',
                                                });
                                            }

                                            /**
                                             * Get Stats For App
                                             * @param appId
                                             * @param all
                                             * @param days
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getStatsForAppStatsAppIdGet(
                                                appId: string,
                                                all: boolean = false,
                                                days: number = 180,
                                            ): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/stats/{app_id}',
                                                    path: {
                                                        'app_id': appId,
                                                    },
                                                    query: {
                                                        'all': all,
                                                        'days': days,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Get Summary
                                             * @param appId
                                             * @param branch
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getSummarySummaryAppIdGet(
                                                appId: string,
                                                branch?: (string | null),
                                            ): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/summary/{app_id}',
                                                    path: {
                                                        'app_id': appId,
                                                    },
                                                    query: {
                                                        'branch': branch,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Get Platforms
                                             * Return a mapping from org-name to platform aliases and dependencies which are
                                             * recognised by the backend.  These are used by things such as the transactions
                                             * and donations APIs to address amounts to the platforms.
                                             * @returns Platform Successful Response
                                             * @throws ApiError
                                             */
                                            public static getPlatformsPlatformsGet(): CancelablePromise<Record<string, Platform>> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/platforms',
                                                });
                                            }

                                            /**
                                             * Get Exceptions
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getExceptionsExceptionsGet(): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/exceptions',
                                                });
                                            }

                                            /**
                                             * Get Exceptions For App
                                             * @param appId
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getExceptionsForAppExceptionsAppIdGet(
                                                appId: string,
                                            ): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/exceptions/{app_id}',
                                                    path: {
                                                        'app_id': appId,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                            /**
                                             * Get Addons
                                             * @param appId
                                             * @returns any Successful Response
                                             * @throws ApiError
                                             */
                                            public static getAddonsAddonAppIdGet(
                                                appId: string,
                                            ): CancelablePromise<any> {
                                                return __request(OpenAPI, {
                                                    method: 'GET',
                                                    url: '/addon/{app_id}',
                                                    path: {
                                                        'app_id': appId,
                                                    },
                                                    errors: {
                                                        422: `Validation Error`,
                                                    },
                                                });
                                            }

                                        }
