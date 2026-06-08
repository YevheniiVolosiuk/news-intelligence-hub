# News Intelligence Hub

The shared language of News Intelligence Hub: a tool that turns RSS streams into a per-user graph of articles, entities, and their relationships, using an LLM only for the semantic work. This glossary is the single source of truth for what each domain word means. It is deliberately free of implementation detail.

## Language

**User**:
An authenticated, email-confirmed account that owns its own feeds, categories, axes, articles, and graph. The only actor in the domain; "Reader" and "Analyst" are personas describing how a User uses the product, not separate roles. The Bull Board *instance administrator* is an infrastructure concern, not a User.
_Avoid_: Reader, Analyst, Account, Member

**Feed**:
A User's subscription to a single RSS/Atom URL. Belongs to one User, carries a status (active / paused / error), and is the unit managed in feed CRUD. Deleting a Feed detaches its Articles from a live source but does not delete them.
_Avoid_: Subscription, Channel

**Source**:
The origin publication an Article came from (the outlet or site). Distinct from Feed: two Users subscribing to the same outlet have two Feeds but one Source, and the "N similar found in other sources" counter counts Sources, not Feeds. A Source can be shared across Users at the storage level even though Feeds are per-User.
_Avoid_: Publisher, Outlet, Provider

**Article**:
The raw source material pulled from a Feed: title, content, original URL, Source, publish time, content hash. The shared source of truth, potentially reused across Users at the storage level. Carries no importance, categories, or axis values of its own — those are per-User and live on the Labelling.
_Avoid_: Post, Item, Entry, Story

**Labelling**:
The LLM-generated, User-specific analysis and classification of an Article: summary, importance, extracted Entities, and Category and axis-value assignments. Never shared across Users; this is what multi-tenant isolation protects. One Article can have a different Labelling per User.
_Avoid_: Enrichment, Analysis, Classification (as a noun for the whole result)

**Importance**:
The LLM's verdict on whether an Article is worth a User's attention: exactly one of `important | normal | junk` per Labelling. A fixed vocabulary — Users cannot rename or extend its levels. Distinct from `filtered`, which is the deterministic pre-filter outcome reached before any LLM call.
_Avoid_: Priority, Relevance, Rank, Score

**Category**:
A User-defined, open-ended topic bucket (e.g. "AI infra", "Crypto regulation"). Created and edited without any LLM involvement; the LLM only assigns Articles into the User's existing Categories. An Article may belong to many Categories.
_Avoid_: Tag, Topic, Label, Folder

**Axis**:
A User-editable classification dimension with a closed set of Axis Values (e.g. "tone" → neutral / promotional / critical). Ships with 4-5 editable seeds. When labelling, the LLM assigns Axis Values only from the dimension's defined set and never invents new ones.
_Avoid_: Dimension, Facet, Attribute

**Axis Value**:
One of the enumerated options within an Axis (e.g. "critical" within "tone"). The unit the LLM picks during labelling.
_Avoid_: Option, Tag, Level

**Feed status**:
The health of a Feed: `active | paused | error`. Concerns subscription/reachability state only. The word "status" belongs to Feeds; an Article's lifecycle is its Processing State, never its "status".
_Avoid_: Feed state

**Processing State**:
Where an Article sits in the pipeline: `pending` (ingested, not yet processed) -> `filtered` (rejected by the deterministic pre-filter, no LLM call made) or `processed` (Labelling complete); `awaiting` marks an Article deferred because the LLM was unavailable. Distinct from Feed status.
_Avoid_: Article status, Stage, Phase

**filtered** (vs **junk**):
`filtered` is a Processing State — a deterministic, pre-LLM rejection (empty / too short / SEO boilerplate) that costs zero LLM calls and produces no Labelling, hence no Importance. `junk` is an Importance value — the LLM's verdict on a fully `processed` Article. A pre-filtered Article is never "junk"; a "junk" Article was always processed. The feed filter surfaces both as distinct.
_Avoid_: using "junk" for pre-filter rejections, or "filtered" for LLM verdicts

**Entity**:
A real-world thing named in Articles, of an Entity Type: `person | company | product | technology | location`. One Entity is one graph node, shared across the Articles that mention it. Entities and their Mentions are deterministic facts about shared raw text and may live in shared storage; the graph a User actually sees is filtered to that User's Feeds and Labelling.
_Avoid_: Tag, Keyword, Topic, Node (use "node" only for the graph representation)

**Entity Type**:
The kind of an Entity: `person | company | product | technology | location`. The same attribute the graph node schema calls `entityType`.
_Avoid_: Kind, Class

**Canonical Name**:
The single chosen display name for an Entity (e.g. "Microsoft"), to which all its Aliases resolve.
_Avoid_: Primary name, Title

**Alias**:
An alternative surface form that resolves to the same Entity ("MSFT", "MS", the Cyrillic spelling). An Entity holds one Canonical Name plus a set of Aliases.
_Avoid_: Synonym, Variant, Nickname

**Mention**:
A single occurrence of an Entity in an Article ("Microsoft was mentioned in art_044"). Both a domain fact and the graph edge that reifies it (article -> entity); the two share one word deliberately.
_Avoid_: Reference, Occurrence, Appearance

**Duplicate**:
An identical copy of the same Article, detected deterministically by normalised-URL or content-hash match. Folded away automatically rather than processed again; it reuses the cached Labelling and never triggers a second LLM call. Not counted in the "N similar" counter.
_Avoid_: Copy, Repost, Clone

**Similar Article**:
A distinct Article covering the same story as another, with different text and usually a different Source, detected by semantic closeness (optional, Should-level). Each Similar Article keeps its own Labelling and is shown as related reporting, linked by a typed graph edge. The "N similar found in other sources" counter counts only Similar Articles, never Duplicates.
_Avoid_: Related, Near-duplicate, Match

**Graph**:
The per-User network of `article` and `entity` nodes joined by typed edges (Mention, Co-mention, Semantic edge). Filtered to a User's own Feeds and Labelling. Built incrementally as Articles are processed and rebuilt on explicit request after axis changes.
_Avoid_: Network, Map, Web

**Co-mention**:
An edge between two Entities that appear together in the same Article. Carries a weight: the integer count of Articles in which that pair co-occurs. A tally, never a fraction or similarity score.
_Avoid_: Co-occurrence, Association, Link

**Semantic edge**:
An edge between two article nodes judged Similar (kind `similar`), optionally carrying a score from 0 to 1. Exists only if semantic closeness is implemented (Should-level). Its score is a strength fraction, distinct from a Co-mention weight, which is a count.
_Avoid_: Similarity link, Related edge

**Reprocessing**:
Running a single Article back through the pipeline to produce a fresh Labelling. The unit that Regeneration batches. Reuses the cache when the content and resulting labelling have not actually changed.
_Avoid_: Re-analysis, Refresh

**Regeneration**:
The User-triggered, background batch Reprocessing of already-stored Articles against a changed Axis set. Shows progress, stays non-blocking, bounded by LLM concurrency, and ends in a Graph Rebuild. May incur LLM spend where labellings actually change.
_Avoid_: Reindex, Recompute, Refresh

**Graph Rebuild**:
Recomputing the Graph from current Labellings. Deterministic and LLM-free. Runs incrementally during normal processing and as an explicit whole-graph action after axis changes; also the final step of Regeneration. Changes graph structure only, never Labellings.
_Avoid_: Regenerate the graph, Refresh the graph

**Pre-Filter**:
The deterministic, LLM-free gate every Article passes before any LLM call. Rejects empty, too-short, no-extractable-text, or SEO-boilerplate Articles, setting their Processing State to `filtered`. Thresholds are env/config-parameterised. The first line of cost saving. "Heuristic" is the adjective reinforcing that it is deterministic and never uses the LLM.
_Avoid_: Spam filter, Validator, Gate

**Digest**:
A throwaway, on-demand overview of a time period (day / week / month), scoped to chosen Categories or Entities: top Entities, top Categories, key Articles, and a short LLM-written summary. Not saved, named, or subscribed to. The LLM writes only the prose overview; all aggregation is deterministic.
_Avoid_: Report, Summary (for the whole artefact), Newsletter

**Telemetry**:
The accounting of LLM cost: call counts and token counts attributed to an operation type (processing / regeneration / digest), with viewable aggregates. In this project "telemetry" means LLM spend accounting specifically, not logs or general metrics.
_Avoid_: Metrics, Logs, Stats, Analytics
