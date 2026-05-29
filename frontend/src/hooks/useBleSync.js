import { useEffect, useState } from 'react';
import * as BleManager from '../services/sync/bleManager';

export function useBleSync() {
    const [isActive, setIsActive] = useState(false)

    useEffect(() => {
        BleManager.initializeBleHardware()

        return () => {
            BleManager.stopP2PNetwork()
        }
    }, [])

    const toggleSync = () => {
        if (isActive) {
            BleManager.stopP2PNetwork()
            setIsActive(false)
        } else {
            BleManager.startP2PNetwork()
            setIsActive(true)
        }
    }

    return { isActive, toggleSync }
}