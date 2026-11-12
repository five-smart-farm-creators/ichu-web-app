import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { API_REQUEST_TIMEOUT_MS, apiEndpoint } from '../../../../shared/infrastructure/http/api-endpoint';
import { ApiError } from '../../../../shared/infrastructure/http/api-error';
import type { CheckoutSession, RequestSubscription, Subscription } from '../../domain/model/subscription.model';
import { SubscriptionRepository } from '../../domain/repositories/subscription.repository';
import { firstSubscriptionPlansResponse } from '../http/subscription-plans-http';

/** Calls the subscription endpoints of one ranch; the API checks the ranch permission on every call. */
@Injectable()
export class RestSubscriptionRepository extends SubscriptionRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  override async current(ranchId: string): Promise<Subscription | null> {
    try {
      return await firstSubscriptionPlansResponse(this.http.get<Subscription>(this.subscriptionsUrl(ranchId), {
        timeout: API_REQUEST_TIMEOUT_MS,
      }));
    } catch (error) {
      // A 404 means the ranch has no pending or active subscription, which is a state rather than a failure.
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }

  override request(ranchId: string, request: RequestSubscription): Promise<Subscription> {
    return firstSubscriptionPlansResponse(this.http.post<Subscription>(this.subscriptionsUrl(ranchId), request, {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  override startCheckout(ranchId: string, subscriptionId: string): Promise<CheckoutSession> {
    return firstSubscriptionPlansResponse(this.http.post<CheckoutSession>(
      `${this.subscriptionUrl(ranchId, subscriptionId)}/checkout-sessions`,
      null,
      { timeout: API_REQUEST_TIMEOUT_MS },
    ));
  }

  override cancel(ranchId: string, subscriptionId: string, reason: string): Promise<Subscription> {
    return firstSubscriptionPlansResponse(this.http.post<Subscription>(
      `${this.subscriptionUrl(ranchId, subscriptionId)}/cancellations`,
      { reason },
      { timeout: API_REQUEST_TIMEOUT_MS },
    ));
  }

  private subscriptionsUrl(ranchId: string): string {
    return apiEndpoint(this.config.apiBaseUrl, `ranches/${encodeURIComponent(ranchId)}/subscriptions`);
  }

  private subscriptionUrl(ranchId: string, subscriptionId: string): string {
    return `${this.subscriptionsUrl(ranchId)}/${encodeURIComponent(subscriptionId)}`;
  }
}
