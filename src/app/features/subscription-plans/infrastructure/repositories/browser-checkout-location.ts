import { Injectable } from '@angular/core';
import { CheckoutLocation } from '../../domain/repositories/checkout-location';

/** Leaves the application for the hosted payment page, which returns the visitor to the success or cancel route. */
@Injectable()
export class BrowserCheckoutLocation extends CheckoutLocation {
  override assign(url: string): void {
    window.location.assign(url);
  }
}
