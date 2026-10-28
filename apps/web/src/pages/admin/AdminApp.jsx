// /admin on the main domain. The admin console itself lives in `../../admin-app` (a copy of apps/admin/src, which also
// builds as a standalone app); this entry only mounts it so the customer web app serves it at realwise.com.br/admin.
export { default } from '../../admin-app/pages/admin/AdminApp';
