# Ladywood Community Resource Finder — Shared API Schema

> **Owner:** Member 1 (APIs / Tech Lead)  
> **Version:** 1.0.0  
> **Last updated:** 2026-05-26  
> **Status:** ✅ Canonical — all members must conform to this contract

This document is the single source of truth for every JSON shape produced or consumed across the project. M2 (Backend), M3 (Frontend), and M5 (Testing) should treat this as read-only; raise a PR against it if a change is needed.

---

## Table of Contents

1. [Response Envelope](#1-response-envelope)
2. [Resource Object](#2-resource-object)
3. [Type-Specific Extended Fields](#3-type-specific-extended-fields)
4. [Error Response](#4-error-response)
5. [Endpoint Reference](#5-endpoint-reference)
6. [Full Examples](#6-full-examples)
7. [Field Validation Rules](#7-field-validation-rules)
8. [Source Mapping](#8-source-mapping)
9. [Changelog](#9-changelog)

---

## 1. Response Envelope

All successful list responses are wrapped in a consistent envelope. This lets the frontend check `meta` without parsing `data` first, and gives M5 a predictable shape to assert against.

```json
{
  "status": "ok",
  "meta": {
    "count": 12,
    "radius_m": 1000,
    "lat": 52.4862,
    "lng": -1.8904,
    "type": "food_bank",
    "cached": false,
    "cache_age_s": null
  },
  "data": [ /* array of Resource Objects */ ]
}
```

### Envelope Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `status` | `"ok"` | ✅ | Always `"ok"` for 2xx responses |
| `meta.count` | `integer` | ✅ | Number of results in `data` |
| `meta.radius_m` | `integer` | ✅ | Search radius used (metres) |
| `meta.lat` | `number` | ✅ | Centre latitude of search |
| `meta.lng` | `number` | ✅ | Centre longitude of search |
| `meta.type` | `string \| null` | ✅ | Resource type filter applied, or `null` if all types returned |
| `meta.cached` | `boolean` | ✅ | Whether response was served from Node-Cache |
| `meta.cache_age_s` | `integer \| null` | ✅ | Seconds since cache was populated; `null` if not cached |

---

## 2. Resource Object

The core shape every resource — regardless of type or source — must conform to.

```json
{
  "id": "givefood_abc123",
  "name": "Ladywood Community Food Bank",
  "type": "food_bank",
  "lat": 52.4862,
  "lng": -1.8904,
  "address": "123 Ladywood Road, Birmingham, B16 8SY",
  "opening_hours": "Mon–Fri 10:00–14:00",
  "notes": "Referral required. Contact local council.",
  "source": "givefood",
  "lang": "en"
}
```

### Core Fields

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `id` | `string` | ✅ | ❌ | Stable unique identifier. Format: `{source}_{external_id}` (e.g. `givefood_abc123`, `overpass_987654321`, `toiletmap_uuid-here`) |
| `name` | `string` | ✅ | ❌ | Human-readable display name |
| `type` | `ResourceType` | ✅ | ❌ | One of the five resource types (see below) |
| `lat` | `number` | ✅ | ❌ | WGS84 latitude, 6 decimal places max |
| `lng` | `number` | ✅ | ❌ | WGS84 longitude, 6 decimal places max |
| `address` | `string` | ✅ | ❌ | Full formatted address. Use `"Address unavailable"` if truly unknown — never `null` |
| `opening_hours` | `string \| null` | ✅ | ✅ | Human-readable hours string, or `null` if unknown |
| `notes` | `string \| null` | ✅ | ✅ | Any additional context (accessibility info, referral requirements, etc.), or `null` |
| `source` | `SourceType` | ✅ | ❌ | Which external API this record came from |
| `lang` | `string` | ✅ | ❌ | BCP 47 language tag for the data. Default `"en"`. Use `"ur"`, `"pa"`, etc. for translated records |

### ResourceType Enum

```
food_bank | toilet | library | recycling | green_space
```

### SourceType Enum

```
givefood | toiletmap | overpass
```

---

## 3. Type-Specific Extended Fields

Each resource type may include an `extended` object alongside the core fields. The `extended` key is always present but may be an empty object `{}` if no additional data is available. M3 should defensively check for key existence before rendering.

### `food_bank` — source: GiveFood

```json
{
  ...coreFields,
  "extended": {
    "needs": ["tinned_goods", "pasta", "toiletries"],
    "referral_required": true,
    "phone": "0121 000 0000",
    "url": "https://example.org/foodbank"
  }
}
```

| Field | Type | Nullable | Description |
|---|---|---|---|
| `needs` | `string[]` | ✅ | Current donation needs from GiveFood |
| `referral_required` | `boolean` | ✅ | Whether a referral voucher is needed |
| `phone` | `string \| null` | ✅ | Contact phone number |
| `url` | `string \| null` | ✅ | Food bank website |

---

### `toilet` — source: Toilet Map API

```json
{
  ...coreFields,
  "extended": {
    "accessible": true,
    "baby_change": false,
    "radar_key": false,
    "fee": null,
    "attended": false,
    "men": true,
    "women": true,
    "unisex": false
  }
}
```

| Field | Type | Nullable | Description |
|---|---|---|---|
| `accessible` | `boolean` | ✅ | Wheelchair accessible |
| `baby_change` | `boolean` | ✅ | Baby changing facilities |
| `radar_key` | `boolean` | ✅ | Requires RADAR key (accessible toilet scheme) |
| `fee` | `string \| null` | ✅ | Cost to use, e.g. `"20p"`, or `null` if free/unknown |
| `attended` | `boolean` | ✅ | Whether an attendant is present |
| `men` | `boolean` | ✅ | Men's facilities available |
| `women` | `boolean` | ✅ | Women's facilities available |
| `unisex` | `boolean` | ✅ | Unisex/gender-neutral facilities |

---

### `library` — source: Overpass

```json
{
  ...coreFields,
  "extended": {
    "operator": "Birmingham City Council",
    "wifi": true,
    "computers": true,
    "wheelchair": "yes"
  }
}
```

| Field | Type | Nullable | Description |
|---|---|---|---|
| `operator` | `string \| null` | ✅ | Operator name from OSM tag |
| `wifi` | `boolean \| null` | ✅ | Free WiFi available |
| `computers` | `boolean \| null` | ✅ | Public computers available |
| `wheelchair` | `"yes" \| "limited" \| "no" \| null` | ✅ | OSM wheelchair accessibility value |

---

### `recycling` — source: Overpass

```json
{
  ...coreFields,
  "extended": {
    "accepts": ["glass", "paper", "plastic", "cans", "clothes"],
    "operator": "Veolia"
  }
}
```

| Field | Type | Nullable | Description |
|---|---|---|---|
| `accepts` | `string[]` | ✅ | Material types accepted (from OSM `recycling:*` tags) |
| `operator` | `string \| null` | ✅ | Operator name |

---

### `green_space` — source: Overpass

```json
{
  ...coreFields,
  "extended": {
    "area_m2": 14200,
    "leisure": "park",
    "wheelchair": "yes",
    "dog_friendly": null
  }
}
```

| Field | Type | Nullable | Description |
|---|---|---|---|
| `area_m2` | `number \| null` | ✅ | Area in square metres (derived from OSM polygon if available) |
| `leisure` | `string \| null` | ✅ | OSM `leisure` tag value (e.g. `park`, `garden`, `nature_reserve`) |
| `wheelchair` | `"yes" \| "limited" \| "no" \| null` | ✅ | OSM wheelchair value |
| `dog_friendly` | `boolean \| null` | ✅ | Whether dogs are permitted (from OSM tags if present) |

---

## 4. Error Response

All 4xx and 5xx responses use this shape. M5 must test for this on every error path.

```json
{
  "status": "error",
  "error": {
    "code": "INVALID_PARAMS",
    "message": "lat and lng are required query parameters",
    "details": null
  }
}
```

### Error Codes

| Code | HTTP Status | Trigger |
|---|---|---|
| `INVALID_PARAMS` | 400 | Missing or invalid `lat`, `lng`, `type`, or `radius` |
| `INVALID_TYPE` | 400 | `type` param is not one of the five valid ResourceTypes |
| `RESOURCE_NOT_FOUND` | 404 | No resource found for the given `:id` |
| `UPSTREAM_ERROR` | 502 | External API (GiveFood / Toilet Map / Overpass) returned an error |
| `UPSTREAM_TIMEOUT` | 504 | External API request timed out |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## 5. Endpoint Reference

### `GET /api/resources`

Returns resources near a location, optionally filtered by type.

**Query Parameters**

| Param | Type | Required | Default | Constraints |
|---|---|---|---|---|
| `lat` | `number` | ✅ | — | `-90` to `90` |
| `lng` | `number` | ✅ | — | `-180` to `180` |
| `type` | `ResourceType` | ❌ | all types | Must be a valid ResourceType if provided |
| `radius` | `integer` | ❌ | `1000` | `100`–`5000` (metres) |

**Success Response:** `200 OK` — Response Envelope containing array of Resource Objects  
**Error Responses:** `400 INVALID_PARAMS`, `400 INVALID_TYPE`, `502 UPSTREAM_ERROR`, `504 UPSTREAM_TIMEOUT`

---

### `GET /api/resources/:id`

Returns a single resource by its stable `id`.

**Path Parameters**

| Param | Type | Description |
|---|---|---|
| `id` | `string` | Resource ID in `{source}_{external_id}` format |

**Success Response:** `200 OK` — Single Resource Object (no envelope wrapper)  
**Error Responses:** `404 RESOURCE_NOT_FOUND`, `400 INVALID_PARAMS`

---

## 6. Full Examples

### `GET /api/resources?lat=52.4862&lng=-1.8904&type=toilet&radius=500`

```json
{
  "status": "ok",
  "meta": {
    "count": 2,
    "radius_m": 500,
    "lat": 52.4862,
    "lng": -1.8904,
    "type": "toilet",
    "cached": true,
    "cache_age_s": 142
  },
  "data": [
    {
      "id": "toiletmap_3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "Ladywood Leisure Centre",
      "type": "toilet",
      "lat": 52.4855,
      "lng": -1.8912,
      "address": "Ladywood Leisure Centre, Ladywood Middleway, Birmingham, B16 8ER",
      "opening_hours": "Mon–Fri 06:30–22:00, Sat–Sun 08:00–20:00",
      "notes": null,
      "source": "toiletmap",
      "lang": "en",
      "extended": {
        "accessible": true,
        "baby_change": true,
        "radar_key": false,
        "fee": null,
        "attended": false,
        "men": true,
        "women": true,
        "unisex": false
      }
    },
    {
      "id": "toiletmap_9c3d4e5f-1234-5678-abcd-ef0123456789",
      "name": "McDonald's Broad Street",
      "type": "toilet",
      "lat": 52.4791,
      "lng": -1.9073,
      "address": "61 Broad Street, Birmingham, B1 2HJ",
      "opening_hours": "24 hours",
      "notes": "Customer use only. Purchase required.",
      "source": "toiletmap",
      "lang": "en",
      "extended": {
        "accessible": true,
        "baby_change": false,
        "radar_key": false,
        "fee": null,
        "attended": false,
        "men": false,
        "women": false,
        "unisex": true
      }
    }
  ]
}
```

### `GET /api/resources/givefood_abc123`

```json
{
  "id": "givefood_abc123",
  "name": "Ladywood Community Food Bank",
  "type": "food_bank",
  "lat": 52.4862,
  "lng": -1.8904,
  "address": "St John's Church Hall, Kenyon Street, Birmingham, B18 6AG",
  "opening_hours": "Tue & Thu 11:00–13:00",
  "notes": "Referral voucher required. Available from GP, Job Centre, or social services.",
  "source": "givefood",
  "lang": "en",
  "extended": {
    "needs": ["tinned_vegetables", "pasta", "rice", "toiletries"],
    "referral_required": true,
    "phone": "0121 523 0000",
    "url": "https://www.trusselltrust.org/"
  }
}
```

### `GET /api/resources?lat=abc&lng=-1.89` — 400 Error

```json
{
  "status": "error",
  "error": {
    "code": "INVALID_PARAMS",
    "message": "lat must be a valid number between -90 and 90",
    "details": null
  }
}
```

---

## 7. Field Validation Rules

Rules the API enforces server-side. M5 should write tests covering each of these.

| Field | Rule |
|---|---|
| `lat` | Required. Float. `-90 ≤ lat ≤ 90` |
| `lng` | Required. Float. `-180 ≤ lng ≤ 180` |
| `radius` | Optional. Integer. `100 ≤ radius ≤ 5000`. Default `1000` |
| `type` | Optional. Must be one of `food_bank`, `toilet`, `library`, `recycling`, `green_space` |
| `id` (path) | Must match pattern `^(givefood|toiletmap|overpass)_.+$` |
| `lang` | Must be a valid BCP 47 tag. Default `"en"` if not set by source |

---

## 8. Source Mapping

How each external API maps to the shared schema.

| Resource Type | External API | ID Prefix | Notes |
|---|---|---|---|
| `food_bank` | GiveFood API | `givefood_` | Use GiveFood's slug or unique ID as suffix |
| `toilet` | Great British Toilet Map API | `toiletmap_` | Use Toilet Map's UUID as suffix |
| `library` | Overpass API (OSM) | `overpass_` | Use OSM node/way/relation ID as suffix |
| `recycling` | Overpass API (OSM) | `overpass_` | Use OSM node/way/relation ID as suffix |
| `green_space` | Overpass API (OSM) | `overpass_` | Use OSM node/way/relation ID as suffix |

> ⚠️ OSM IDs are stable but not globally unique across node/way/relation. Prefix with type if collisions become a concern: `overpass_node_123`, `overpass_way_456`.

---

## 9. Changelog

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0.0 | 2026-05-26 | M1 | Initial schema — core fields, extended fields, error shape, all 5 resource types |
