# Ladywood Resource Finder — API Reference

For the frontend team. All endpoints are read-only — no authentication required.

Base URL (local): `http://localhost:3001`
Base URL (production): `https://launchpad-2026.vercel.app`

---

## Endpoints

### GET /health

Check if the server is running.

**Response**

```json
{
  "status": "ok",
  "timestamp": "2026-05-29T10:00:00.000Z"
}
```

---

### GET /api/resources

Returns all resources. Optionally filter by type.

**Query Parameters**

| Param  | Required | Values                                                       | Default   |
| ------ | -------- | ------------------------------------------------------------ | --------- |
| `type` | No       | `food_bank`, `toilet`, `library`, `recycling`, `green_space` | all types |
| `lang` | No       | BCP 47 tag e.g. `en`, `ur`, `pl`                             | `en`      |

**Examples**

```
GET /api/resources
GET /api/resources?type=food_bank
GET /api/resources?type=toilet
GET /api/resources?type=library
GET /api/resources?type=recycling
GET /api/resources?type=green_space
```

**Response**

```json
{
  "status": "ok",
  "meta": {
    "count": 8,
    "type": "food_bank",
    "lang": "en"
  },
  "data": [
    {
      "id": "givefood_birmingham-central",
      "name": "Birmingham Central Foodbank",
      "type": "food_bank",
      "lat": 52.4818698,
      "lng": -1.91045,
      "address": "Birmingham City Church, Parade, Birmingham, B1 3QQ",
      "opening_hours": null,
      "notes": null,
      "source": "givefood",
      "lang": "en",
      "extended": {
        "needs": ["Chopped Tomatoes", "Biscuits", "Pasta Sauce"],
        "phone": "01212362997",
        "url": "https://birminghamcentral.foodbank.org.uk",
        "referral_required": null
      }
    }
  ]
}
```

---

### GET /api/resources/:id

Returns a single resource by ID.

**ID format:** `{source}_{externalId}` e.g. `givefood_birmingham-central`, `overpass_560829488`

**Example**

```
GET /api/resources/givefood_birmingham-central
GET /api/resources/overpass_560829488
```

**Response**

```json
{
  "status": "ok",
  "data": {
    "id": "givefood_birmingham-central",
    "name": "Birmingham Central Foodbank",
    "type": "food_bank",
    "lat": 52.4818698,
    "lng": -1.91045,
    "address": "Birmingham City Church, Parade, Birmingham, B1 3QQ",
    "opening_hours": null,
    "notes": null,
    "source": "givefood",
    "lang": "en",
    "extended": {
      "needs": ["Chopped Tomatoes", "Biscuits", "Pasta Sauce"],
      "phone": "01212362997",
      "url": "https://birminghamcentral.foodbank.org.uk",
      "referral_required": null
    }
  }
}
```

---

## Response Schema

Every resource object matches this schema regardless of type:

| Field           | Type           | Notes                                       |
| --------------- | -------------- | ------------------------------------------- |
| `id`            | string         | Prefixed ID e.g. `givefood_*`, `overpass_*` |
| `name`          | string         | Display name                                |
| `type`          | string         | One of the 5 resource types                 |
| `lat`           | number         | Latitude (WGS84)                            |
| `lng`           | number         | Longitude (WGS84)                           |
| `address`       | string         | Full address or "Address unavailable"       |
| `opening_hours` | string or null | Human-readable hours                        |
| `notes`         | string or null | Additional info                             |
| `source`        | string         | `givefood` or `overpass`                    |
| `lang`          | string         | Language code, default `en`                 |
| `extended`      | object         | Type-specific fields (see below)            |

---

## Extended Fields by Type

### food_bank

```json
{
  "needs": ["Pasta", "Tinned Tomatoes"],
  "phone": "01212362997",
  "url": "https://example.foodbank.org.uk",
  "referral_required": null
}
```

### toilet

```json
{
  "accessible": true,
  "baby_change": null,
  "radar_key": null,
  "fee": null,
  "men": null,
  "women": null,
  "unisex": null
}
```

### library

```json
{
  "operator": "Birmingham City Council",
  "wifi": true,
  "computers": true,
  "wheelchair": "yes"
}
```

### recycling

```json
{
  "accepts": ["glass", "paper", "clothes"],
  "operator": "Birmingham City Council"
}
```

### green_space

```json
{
  "area_m2": null,
  "leisure": "park",
  "wheelchair": "yes",
  "dog_friendly": true
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "status": "error",
  "error": {
    "code": "INVALID_PARAMS",
    "message": "type must be one of: food_bank, toilet, library, recycling, green_space",
    "details": []
  }
}
```

| HTTP Status | Code             | When                          |
| ----------- | ---------------- | ----------------------------- |
| 400         | `INVALID_PARAMS` | Invalid query parameter value |
| 404         | `NOT_FOUND`      | Resource ID does not exist    |
| 500         | `INTERNAL_ERROR` | Unexpected server error       |

---

## Data Notes

- All data is pre-filtered to within 5km of Ladywood centre point
- Data refreshes automatically every 24 hours in the background
- `extended` fields may contain `null` values where the data source does not provide them
- `opening_hours` is mostly `null` for Overpass sources — OSM coverage is limited
