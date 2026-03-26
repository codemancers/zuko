import { Module } from "@nestjs/common";
import { FlyService } from "./fly.service";

@Module({
  providers: [FlyService],
  exports: [FlyService],
})
export class FlyModule {}
