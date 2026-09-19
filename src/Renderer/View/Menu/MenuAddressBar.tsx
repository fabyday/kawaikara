import type {
  AppMessages
} from '../../../Common/IPC';
import { RightArrowIcon } from '../../Component/RightArrowIcon';
import { SiteIcon } from '../../Component/SiteIcon';
import { type useAddressNavigation } from './Hooks/useAddressNavigation';
import { type useMenuState } from './Hooks/useMenuState';
import { AddressSuggestion, formatAddressForDisplay } from './Logic/AddressSuggestions';
import { CheckIcon, CopyIcon } from './MenuIcons';

/** Inputs for the MenuAddressBar section. */
type MenuAddressBarProps = Pick<ReturnType<typeof useMenuState>,
  | 'addressError'
  | 'addressFailureKey'
  | 'navigationLoading'
  | 'navigationState'
  | 'activeAddressSuggestion'
  | 'addressLoading'
  | 'addressInputRef'
  | 'addressFocused'
  | 'address'
  | 'setAddress'
  | 'setAddressError'
  | 'setAddressCopied'
  | 'setAddressSuggestionsDismissed'
  | 'setActiveAddressSuggestion'
  | 'setAddressFocused'
  | 'addressCopied'
> & Pick<ReturnType<typeof useAddressNavigation>,
  | 'openAddress'
  | 'navigateAddressHistory'
  | 'openAddressValue'
  | 'copyAddress'
  | 'chooseAddressSuggestion'
> & {
  /** The messages value for this section. */
  readonly messages: AppMessages;
  /** The addressSuggestionsVisible value for this section. */
  readonly addressSuggestionsVisible: boolean;
  /** The addressSuggestions value for this section. */
  readonly addressSuggestions: AddressSuggestion[];
  /** The addressHelp value for this section. */
  readonly addressHelp: string;
};

/** Renders the MenuAddressBar section of this View. */
export function MenuAddressBar({
  addressError,
  addressFailureKey,
  openAddress,
  messages,
  navigationLoading,
  navigationState,
  navigateAddressHistory,
  addressSuggestionsVisible,
  activeAddressSuggestion,
  addressLoading,
  addressInputRef,
  addressFocused,
  address,
  setAddress,
  setAddressError,
  setAddressCopied,
  setAddressSuggestionsDismissed,
  setActiveAddressSuggestion,
  setAddressFocused,
  addressSuggestions,
  openAddressValue,
  addressCopied,
  copyAddress,
  addressHelp,
  chooseAddressSuggestion,
}: MenuAddressBarProps) {
  return (
    <section className="menu-address-section">
      <form
        className={`menu-address-form${addressError ? ' has-error' : ''}`}
        key={addressFailureKey}
        onSubmit={(event) => void openAddress(event)}
      >
        <AddressHistoryButtons
          messages={messages}
          navigationLoading={navigationLoading}
          navigationState={navigationState}
          navigateAddressHistory={navigateAddressHistory}
        />
        <input
          aria-activedescendant={
            addressSuggestionsVisible
              ? `kawaikara-address-suggestion-${activeAddressSuggestion}`
              : undefined
          }
          aria-autocomplete="list"
          aria-controls="kawaikara-address-suggestions"
          aria-expanded={addressSuggestionsVisible}
          aria-invalid={addressError}
          disabled={addressLoading}
          placeholder={messages.addressPlaceholder}
          ref={addressInputRef}
          role="combobox"
          spellCheck={false}
          type="text"
          value={addressFocused ? address : formatAddressForDisplay(address)}
          onChange={(event) => {
            setAddress(event.currentTarget.value);
            setAddressError(false);
            setAddressCopied(false);
            setAddressSuggestionsDismissed(false);
            setActiveAddressSuggestion(0);
          }}
          onFocus={(event) => {
            const input = event.currentTarget;
            setAddressFocused(true);
            setAddressSuggestionsDismissed(false);
            setActiveAddressSuggestion(0);
            window.requestAnimationFrame(() => input.select());
          }}
          onBlur={() => setAddressFocused(false)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              if (addressSuggestions.length === 0) return;
              event.preventDefault();
              setAddressSuggestionsDismissed(false);
              setActiveAddressSuggestion((current) => {
                const direction = event.key === 'ArrowDown' ? 1 : -1;
                return (
                  current + direction + addressSuggestions.length
                ) % addressSuggestions.length;
              });
              return;
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              setAddressSuggestionsDismissed(true);
              const input = event.currentTarget;
              if (
                input.selectionStart === 0 &&
                input.selectionEnd === input.value.length
              ) {
                const caret = input.value.length;
                input.setSelectionRange(caret, caret);
              }
              return;
            }
            if (event.key !== 'Enter') return;
            event.preventDefault();
            const suggestion = addressSuggestionsVisible
              ? addressSuggestions[activeAddressSuggestion]
              : undefined;
            if (suggestion) {
              setAddress(suggestion.host);
              void openAddressValue(suggestion.host);
            } else {
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button
          aria-label={messages.addressGo}
          disabled={addressLoading || !address.trim()}
          title={messages.addressGo}
          type="submit"
        >
          <RightArrowIcon className="menu-address-action-icon" />
        </button>
        <button
          aria-label={messages.copyAddress}
          className={addressCopied ? 'is-copied' : undefined}
          disabled={!address.trim()}
          title={messages.copyAddress}
          type="button"
          onClick={() => void copyAddress()}
        >
          {addressCopied ? <CheckIcon /> : <CopyIcon />}
        </button>
      </form>
      <p className={addressError ? 'is-error' : ''}>
        {addressError
          ? messages.unsupportedAddress
          : addressCopied
            ? messages.addressCopied
            : addressHelp}
      </p>
      {addressSuggestionsVisible ? (
        <AddressSuggestions
          messages={messages}
          addressSuggestions={addressSuggestions}
          activeAddressSuggestion={activeAddressSuggestion}
          chooseAddressSuggestion={chooseAddressSuggestion}
          setActiveAddressSuggestion={setActiveAddressSuggestion}
        />
      ) : null}
    </section>
  );
}

/** Back and forward controls with the current site history availability. */
function AddressHistoryButtons({
  messages,
  navigationLoading,
  navigationState,
  navigateAddressHistory,
}: Pick<MenuAddressBarProps, 'messages' | 'navigationLoading' | 'navigationState' | 'navigateAddressHistory'>) {
  return (
    <div className="menu-address-navigation">
      <button
        aria-label={messages.goBack}
        disabled={navigationLoading || !navigationState.canGoBack}
        title={messages.goBack}
        type="button"
        onClick={() => void navigateAddressHistory('back')}
      >
        <span aria-hidden="true">←</span>
      </button>
      <button
        aria-label={messages.goForward}
        disabled={navigationLoading || !navigationState.canGoForward}
        title={messages.goForward}
        type="button"
        onClick={() => void navigateAddressHistory('forward')}
      >
        <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}

/** One address suggestion, preserving pointer focus and keyboard selection. */
function AddressSuggestionItem({
  activeAddressSuggestion,
  chooseAddressSuggestion,
  setActiveAddressSuggestion,
  suggestion,
  index,
}: Pick<MenuAddressBarProps, 'activeAddressSuggestion' | 'chooseAddressSuggestion' | 'setActiveAddressSuggestion'> & {
  /** suggestion supplied by the owning composition. */
  readonly suggestion: AddressSuggestion;
  /** index supplied by the owning composition. */
  readonly index: number;
}) {
  return (
    <button
      aria-selected={index === activeAddressSuggestion}
      className={
        index === activeAddressSuggestion ? 'is-active' : undefined
      }
      id={`kawaikara-address-suggestion-${index}`}

      role="option"
      type="button"
      onClick={() => chooseAddressSuggestion(suggestion)}
      onMouseEnter={() => setActiveAddressSuggestion(index)}
      onPointerDown={(event) => event.preventDefault()}
    >
      <SiteIcon site={suggestion.site} />
      <span className="menu-address-suggestion-copy">
        <strong>{suggestion.site.title}</strong>
        <small>{suggestion.host}</small>
      </span>
      <span aria-hidden="true" className="menu-address-suggestion-arrow">
        ↗
      </span>
    </button>
  );
}

/** Composes the supported-site suggestions as an accessible listbox. */
function AddressSuggestions({
  messages,
  addressSuggestions,
  activeAddressSuggestion,
  chooseAddressSuggestion,
  setActiveAddressSuggestion,
}: Pick<MenuAddressBarProps, 'messages' | 'addressSuggestions' | 'activeAddressSuggestion' | 'chooseAddressSuggestion' | 'setActiveAddressSuggestion'>) {
  return (
    <div
      aria-label={messages.addressPlaceholder}
      className="menu-address-suggestions"
      id="kawaikara-address-suggestions"
      role="listbox"
    >
      {addressSuggestions.map((suggestion, index) => (
        <AddressSuggestionItem
          key={`${suggestion.site.id}:${suggestion.host}`}
          activeAddressSuggestion={activeAddressSuggestion}
          chooseAddressSuggestion={chooseAddressSuggestion}
          setActiveAddressSuggestion={setActiveAddressSuggestion}
          suggestion={suggestion}
          index={index}
        />
      ))}
    </div>
  );
}
