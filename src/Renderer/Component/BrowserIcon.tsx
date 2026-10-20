/** Compact browser marks shared by connection actions and browser selection. */
export function BrowserIcon({ browser }: {
  /** The browser value. */
  readonly browser?: string }) {
    const firefox = browser?.toLowerCase() === 'firefox';
    return (
        <svg
            className="web-extension-browser-icon"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            aria-hidden="true">
            {firefox ? (
                <>
                    <circle cx="12" cy="13" r="9" fill="#7545d8" />
                    <path
                        d="M5 3 8 6C12 3 16 5 17 7L21 4C21 8 24 14 20 19C16 24 7 23 3 17C0 12 2 7 5 3Z"
                        fill="#ff8a25"
                    />
                    <path
                        d="M5 9 8 10 7 13C9 17 15 19 19 14C19 20 11 23 6 18C3 15 3 12 5 9Z"
                        fill="#ffca45"
                    />
                    <path
                        d="M10 9C17 7 20 13 16 17C12 20 7 16 8 12L12 12Z"
                        fill="#7545d8"
                    />
                </>
            ) : (
                <>
                    <circle cx="12" cy="12" r="11" fill="#ea4335" />
                    <path d="M12 12H23A11 11 0 0 1 6.5 21.5Z" fill="#fbbc05" />
                    <path
                        d="M12 12 6.5 21.5A11 11 0 0 1 2.5 6.5Z"
                        fill="#34a853"
                    />
                    <circle
                        cx="12"
                        cy="12"
                        r="5"
                        fill="#4285f4"
                        stroke="white"
                        strokeWidth="1.5"
                    />
                </>
            )}
        </svg>
    );
}
