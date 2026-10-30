/** The page was opened with ?layout=stacked: the toasts lie in a deck instead of a list. */
export const STACKED = new URLSearchParams(location.search).get('layout') === 'stacked';
