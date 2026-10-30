import { apiClient } from '../client';

export const summaryResource = {
  /** The private summary page's data; the token in the link is the only credential. */
  byToken(token) {
    return apiClient.get(`/public/summary/${encodeURIComponent(token)}`);
  },
};
