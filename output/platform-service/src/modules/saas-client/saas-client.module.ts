import { Module } from '@nestjs/common';
import { SaasClientService } from './saas-client.service';

@Module({
  providers: [SaasClientService],
  exports: [SaasClientService],
})
export class SaasClientModule {}
