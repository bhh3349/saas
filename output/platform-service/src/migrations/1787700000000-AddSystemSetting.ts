import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSystemSetting1787700000000 implements MigrationInterface {
    name = 'AddSystemSetting1787700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "system_setting" ("id" integer PRIMARY KEY NOT NULL, "system_name" varchar(64) NOT NULL DEFAULT ('收银云'), "logo" text, "favicon" text, "updated_at" datetime NOT NULL DEFAULT (datetime('now')))`);
        await queryRunner.query(`INSERT INTO "system_setting" ("id", "system_name") VALUES (1, '收银云')`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "system_setting"`);
    }

}
