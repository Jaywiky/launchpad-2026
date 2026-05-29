export const BLE_CONFIG = Object.freeze({
    SERVICE_UUID: 'f0bffd13-ad4e-4882-8fc7-cdfcabd00e73',
    ENVELOPE_UUID: '9ab41921-747a-42d7-89df-4164a2e64421',
    DATA_UUID: '848cb058-7689-4b50-b207-92c33e6e630d',
    MANUFACTURER_ID: 0xffff,
})

export const TIMING = Object.freeze({
    SCAN_WINDOW_MS: 3500,
    CYCLE_INTERVAL_MS: 30000,
})

export const MAX_CHARACTERISTIC_BYTES = 512