import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateOrderPayments1788867157096 implements MigrationInterface {
    name = 'CreateOrderPayments1788867157096'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "order_payments" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "order_id" integer NOT NULL, "payment_method_id" integer NOT NULL, "payment_method_name" varchar(32) NOT NULL, "amount" real NOT NULL, "created_at" datetime NOT NULL DEFAULT (datetime('now')))`);
        await queryRunner.query(`CREATE INDEX "idx_order_payments_method_created" ON "order_payments" ("payment_method_id", "created_at") `);
        await queryRunner.query(`CREATE INDEX "idx_order_payments_order_id" ON "order_payments" ("order_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "idx_order_payments_order_id"`);
        await queryRunner.query(`DROP INDEX "idx_order_payments_method_created"`);
        await queryRunner.query(`DROP TABLE "order_payments"`);
    }

}
