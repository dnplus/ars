/**
 * @deprecated Renamed to ReviewView (review phase) and wrapped by StudioShell.
 *             Kept as a thin re-export so any external import of StudioApp
 *             still works. New code should mount StudioShell at the root and
 *             let it dispatch by `?phase=`.
 */
export { ReviewView as StudioApp } from './views/ReviewView';
export { default } from './views/ReviewView';
