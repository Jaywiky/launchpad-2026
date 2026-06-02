import { useEffect, useState, useRef } from 'react';
import * as BleManager from '../services/sync/bleManager';

export function useBleSync(autoStart = true) {
    const [isActive, setIsActive] = useState(() => {
        const saved = localStorage.getItem('p2p_active');
        return saved !== null ? JSON.parse(saved) : autoStart;
    });

    const initialized = useRef(false);

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        const init = async () => {
            await BleManager.initializeBleHardware();
            if (isActive) {
                BleManager.startP2PNetwork();
            }
        };
        init();
        
    }, []); 

    const toggleSync = () => {
        const newState = !isActive;
        setIsActive(newState);
        localStorage.setItem('p2p_active', JSON.stringify(newState));

        if (newState) {
            BleManager.startP2PNetwork();
        } else {
            BleManager.stopP2PNetwork();
        }
    };

    return { isActive, toggleSync };
}