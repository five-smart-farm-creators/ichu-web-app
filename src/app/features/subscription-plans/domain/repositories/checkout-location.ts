/** Sends the browser to a hosted payment page; a port so that tests can observe the redirect without leaving the test run. */
export abstract class CheckoutLocation {
  abstract assign(url: string): void;
}
