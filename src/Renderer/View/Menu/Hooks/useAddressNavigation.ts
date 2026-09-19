import {
  type FormEvent
} from 'react';
import { AddressSuggestion } from '../Logic/AddressSuggestions';
import { type useMenuState } from './useMenuState';

/** Inputs used by useAddressNavigation. */
type AddressNavigationOptions = Pick<ReturnType<typeof useMenuState>,
  | 'addressLoading'
  | 'setAddressLoading'
  | 'setAddressError'
  | 'setAddressSuggestionsDismissed'
  | 'setAddressFailureKey'
  | 'addressInputRef'
  | 'setError'
  | 'address'
  | 'setAddressCopied'
  | 'addressCopiedTimer'
  | 'navigationLoading'
  | 'setNavigationLoading'
  | 'setAddress'
  | 'setNavigationState'
  | 'setActiveAddressSuggestion'
>;

/** Coordinates address navigation behavior for this View. */
export function useAddressNavigation({
  addressLoading,
  setAddressLoading,
  setAddressError,
  setAddressSuggestionsDismissed,
  setAddressFailureKey,
  addressInputRef,
  setError,
  address,
  setAddressCopied,
  addressCopiedTimer,
  navigationLoading,
  setNavigationLoading,
  setAddress,
  setNavigationState,
  setActiveAddressSuggestion,
}: AddressNavigationOptions) {
  /** Opens the address value. */
  const openAddressValue = async (value: string) => {
    if (addressLoading) return;
    setAddressLoading(true);
    setAddressError(false);
    setAddressSuggestionsDismissed(true);
    try {
      const result = await window.kawaikara.sites.openAddress(value);
      if (result.status === 'unsupported') {
        setAddressError(true);
        setAddressFailureKey((current) => current + 1);
        window.requestAnimationFrame(() => addressInputRef.current?.focus());
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setAddressLoading(false);
    }
  };

  /** Opens the address. */
  const openAddress = async (event: FormEvent) => {
    event.preventDefault();
    await openAddressValue(address);
  };

  /** Copies the address. */
  const copyAddress = async () => {
    const value = address.trim();
    if (!value) return;
    try {
      await window.kawaikara.application.copyText(value);
      setAddressCopied(true);
      if (addressCopiedTimer.current !== undefined) {
        window.clearTimeout(addressCopiedTimer.current);
      }
      addressCopiedTimer.current = window.setTimeout(() => {
        addressCopiedTimer.current = undefined;
        setAddressCopied(false);
      }, 1_400);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  /** Performs the navigate address history operation. */
  const navigateAddressHistory = async (direction: 'back' | 'forward') => {
    if (navigationLoading) return;
    setNavigationLoading(true);
    try {
      const moved = direction === 'back'
        ? await window.kawaikara.sites.goBack()
        : await window.kawaikara.sites.goForward();
      if (moved) setAddressSuggestionsDismissed(true);
      // NavigationHistory changes synchronously, while the committed URL
      // follows asynchronously. Refresh both values after the next turn so
      // the address and the disabled buttons describe the same entry.
      window.setTimeout(() => {
        void Promise.all([
          window.kawaikara.sites.currentAddress(),
          window.kawaikara.sites.navigationState(),
        ])
          .then(([nextAddress, nextNavigationState]) => {
            setAddress(nextAddress);
            setNavigationState(nextNavigationState);
          })
          .catch((reason: unknown) => {
            setError(reason instanceof Error ? reason.message : String(reason));
          })
          .finally(() => setNavigationLoading(false));
      }, moved ? 120 : 0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setNavigationLoading(false);
    }
  };

  /** Performs the choose address suggestion operation. */
  const chooseAddressSuggestion = (suggestion: AddressSuggestion) => {
    setAddress(suggestion.host);
    setAddressError(false);
    setAddressSuggestionsDismissed(true);
    setActiveAddressSuggestion(0);
    addressInputRef.current?.focus();
  };

  return {
    /** The openAddressValue value. */
    openAddressValue,
    /** The openAddress value. */
    openAddress,
    /** The copyAddress value. */
    copyAddress,
    /** The navigateAddressHistory value. */
    navigateAddressHistory,
    /** The chooseAddressSuggestion value. */
    chooseAddressSuggestion,
  };
}
