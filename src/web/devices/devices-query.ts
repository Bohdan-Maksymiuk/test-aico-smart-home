import { API_BASE_PATH, deviceSchema } from '@shared/index';
import { queryOptions } from '@tanstack/react-query';

export const devicesQuery = queryOptions({
  queryKey: ['devices'],
  queryFn: async ({ signal }) => {
    const response = await fetch(`${API_BASE_PATH}/devices`, { signal });
    if (!response.ok) {
      throw new Error(
        `Listing Devices failed with status ${String(response.status)}`,
      );
    }
    return deviceSchema.array().parse(await response.json());
  },
});
