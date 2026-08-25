import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1787628389601 implements MigrationInterface {
    name = 'Init1787628389601'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "activation_code" ("code" varchar(32) PRIMARY KEY NOT NULL, "batch_no" varchar(64) NOT NULL, "status" varchar(16) NOT NULL DEFAULT ('unused'), "bound_shop_id" integer, "bound_at" datetime, "created_at" datetime NOT NULL DEFAULT (datetime('now')), "expired_at" datetime)`);
        await queryRunner.query(`CREATE TABLE "op_log" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "operator_id" integer NOT NULL, "action" varchar(32) NOT NULL, "target" varchar(64) NOT NULL, "detail" varchar(255) NOT NULL DEFAULT (''), "ip" varchar(64) NOT NULL DEFAULT (''), "user_agent" varchar(255) NOT NULL DEFAULT (''), "created_at" datetime NOT NULL DEFAULT (datetime('now')))`);
        await queryRunner.query(`CREATE TABLE "operator" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "username" varchar(64) NOT NULL, "password_hash" varchar(128) NOT NULL, "role" varchar(16) NOT NULL DEFAULT ('admin'), "avatar" text, "token_version" integer NOT NULL DEFAULT (0), "created_at" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_62277fe2d2a98818e7c47cc9071" UNIQUE ("username"))`);
        await queryRunner.query(`CREATE TABLE "shop" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "name" varchar(128) NOT NULL, "address" varchar(255) NOT NULL DEFAULT (''), "phone" varchar(32) NOT NULL DEFAULT (''), "activation_code" varchar(32), "status" varchar(16) NOT NULL DEFAULT ('active'), "created_at" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_e21d6d066ab295b0a12cc3eb737" UNIQUE ("activation_code"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "shop"`);
        await queryRunner.query(`DROP TABLE "operator"`);
        await queryRunner.query(`DROP TABLE "op_log"`);
        await queryRunner.query(`DROP TABLE "activation_code"`);
    }

}
