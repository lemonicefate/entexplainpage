# Runtime image visual review

All 61 entries in `docs/image-migration.json` were compared side by side with
their source image before committing the migration. The comparison used the
same-height render for each original/output pair and covered the full-size
step images, resized thumbnails, the homepage logo, and the Wegovy calculator
logo.

Review result: pass. Layout, crop, colors, and diagram details were preserved;
small medical labels and dosage/table text remained readable at the application
display scale. The two retained `vocal-cord` JPG step images were not part of
the conversion set because their measured WebP savings were below 20%.

The review is intentionally a release-time record, not a CI transcode step.
`npm run images:inventory` verifies the committed outputs and migration record.
