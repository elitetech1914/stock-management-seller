DROP INDEX "media_assets_batch_filename_idx";--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "descriptive_name" varchar(255);--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "storage_deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "product_images" ADD COLUMN "media_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "media_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_images_media_asset_id_idx" ON "product_images" USING btree ("media_asset_id");--> statement-breakpoint
CREATE INDEX "product_variants_media_asset_id_idx" ON "product_variants" USING btree ("media_asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_batch_filename_idx" ON "media_assets" USING btree ("batch_id","original_filename") WHERE "media_assets"."storage_deleted_at" IS NULL;
