/** Screens that hide the bottom tab bar: the chat has its own composer, and form screens need the whole height. */
export const hidesTabBar = (pathname) => /\/(chat|new|edit|withdraw|payment)(\/|$)/.test(pathname);
