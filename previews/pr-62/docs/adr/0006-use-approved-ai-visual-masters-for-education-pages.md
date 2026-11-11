---
status: accepted
---

# Generate education pages inside approved AI visual masters

Formal education pages use AI-generated raster artwork rather than deterministic HTML/CSS content layouts because the composed prototypes looked like web pages and lost the desired editorial illustration quality. For each topic, AI first creates a visual master and protection mask; after the user approves the master using sparse and dense proof pages, page-specific AI generation is limited to the masked content window and the frozen master pixels are reapplied during export. This preserves exact headers and footers within a topic while allowing AI to choose each page's composition; different topics may create different masters but share an approved brand-style reference and required brand elements.

## Consequences

- Page numbers and page-specific titles are forbidden in the fixed master; sequence order remains metadata, so pages can be inserted without rewriting images.
- A formal sequence cannot mix master versions. Master changes require recomposition, and mask changes require regeneration of affected content.
- Full-page generation without an approved master is limited to topic covers and experiments.
- Every generated page remains a candidate until a user verifies it against the source. Locked medical facts must remain exact; failed local AI corrections block publication.
- Dense content is split across pages rather than shrinking text or introducing another master within the same topic.
