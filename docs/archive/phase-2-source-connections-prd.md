# Phase 2 PRD — Source Connections

## Product Goal
Connect live/realistic source feeds for roster, recruiting, ratings, and production into the existing canonical schema used by Phase A.

## Scope

### In Scope
- Source adapter layer for each domain.
- Canonical mapping and normalization into existing source-partitioned shape.
- Validation and completeness reporting.
- Runtime mode switch (`mock` vs `connected`) with non-prod fallback.

### Out of Scope
- UI redesign.
- New scoring models.
- Writeback to source systems.
- Historical warehousing.

## Adapter Contract
Each adapter implements:
- `fetchRaw(params)`
- `mapToCanonical(raw)`
- `validate(mapped)`
- `metadata(mapped)`

## Canonical Requirements
- Primary join key is `playerId`.
- Aliases can be recorded for unstable external IDs.
- Required components:
  - `roster.players`
  - `roster.depthChart.offense`
  - `roster.depthChart.defense`
  - `recruiting.playerRecruitProfiles`
  - `ratings.playerRatings`
  - `production.playerProduction`

## WR Slot Normalization
Incoming offense depth chart keys (`WRX/WRZ/SLOT`, `X/Z/SL`, or canonical keys) are normalized to:
- `WR1`
- `WR2`
- `WR3`

## Runtime Modes
- `DATA_MODE=mock` returns mock sources.
- `DATA_MODE=connected` runs all adapters and validates output.
- Connected-mode failures fall back to mock mode with warnings.

## Milestones
1. Adapter skeletons and registry.
2. Roster adapter and WR1/WR2/WR3 normalization.
3. Recruiting, ratings, and production adapters.
4. Generic dataset validator and CLI checks.
5. Orchestration with mode switch, fallback, and basic cache.

## Acceptance Matrix
1. Connected mode resolves all required components.
2. Missing/empty components are machine-reported.
3. WR slots are always canonical (`WR1/WR2/WR3`).
4. Source failures degrade gracefully via fallback.
5. Mock/connected toggle does not change dataset contract.
