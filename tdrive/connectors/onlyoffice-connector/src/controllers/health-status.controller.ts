import { Request, Response } from 'express';
import onlyofficeService from '@/services/onlyoffice.service';
import apiService from '@/services/api.service';

import forgottenProcessorService from '@/services/forgotten-processor.service';

/**
 * Health response for devops operational purposes. Should not be exposed.
 */
export const HealthStatusController = {
  async get(req: Request<{}, {}, {}, {}>, res: Response): Promise<void> {
    Promise.all([onlyofficeService.getLatestLicence(), apiService.hasToken(), forgottenProcessorService.getHealthData()]).then(
      ([onlyOfficeLicense, twakeDriveToken, forgottenProcessorHealth]) =>
        res.status(onlyOfficeLicense && twakeDriveToken ? 200 : 500).send({
          uptimeS: Math.floor(process.uptime()),
          onlyOfficeLicense,
          twakeDriveToken,
          ...forgottenProcessorHealth,
        }),
      err => res.status(500).send(err),
    );
  },
};
