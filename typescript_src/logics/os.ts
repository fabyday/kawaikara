/**
 *
 * @param locale_string electron's Locale Code
 * @returns specific locale code for kawaikara
 */
export function normalize_locale_string(locale_string: string) {
    // switch (process.platform) {
    //     case 'win32':
    //         return normalize_locale_string_from_win(locale_string);
    //     case 'darwin':
    //         return normalize_locale_string_from_mac(locale_string);
    //     default:
    //         return normalize_locale_string_general(locale_string);
    // }

    return normalize_locale_string_for_win(locale_string);
}

export function normalize_locale_string_general(locale_string: string) {
    // stop implement code for a while
}
export function normalize_locale_string_for_mac(locale_string: string) {
    // stop implement code for a while
}

export function normalize_locale_string_for_win(locale_string: string) {
    // RFC 5646  Language Tags  September 2009
    // langtag       = language
    // ["-" script]
    // ["-" region]
    // *("-" variant)
    // *("-" extension)
    // ["-" privateuse]
    // check language code
    // see also https://www.rfc-editor.org/rfc/bcp/bcp47.txt
    const split_locale = locale_string.split(/[-_]/); // regex for split by "-" or "_"
    const language_code = split_locale[0].toLowerCase();
    return language_code;
}
