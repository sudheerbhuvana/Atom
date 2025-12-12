'use client';

import { useState, useEffect } from 'react';
import { Sun, Moon, Settings, LogOut, Keyboard, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from '../Dashboard.module.css';

interface ClockWidgetProps {
    className?: string;
    weatherLocation?: string;
    onShowShortcuts: () => void;
    onRefresh: () => void;
}

export default function ClockWidget({ weatherLocation, onShowShortcuts, onRefresh }: ClockWidgetProps) {
    const [time, setTime] = useState(new Date());
    const [weather, setWeather] = useState<{ temp: number; isDay: boolean } | null>(null);
    const router = useRouter();

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const fetchWeather = async (city: string) => {
        try {
            // 1. Geocode
            const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
            const geoData = await geoRes.json();

            if (!geoData.results || geoData.results.length === 0) return;

            const { latitude, longitude } = geoData.results[0];

            // 2. Weather
            const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,is_day`);
            const weatherData = await weatherRes.json();

            if (weatherData.current) {
                setWeather({
                    temp: Math.round(weatherData.current.temperature_2m),
                    isDay: weatherData.current.is_day === 1
                });
            }
        } catch (e) {
            console.error('Weather fetch failed', e);
        }
    };

    useEffect(() => {
        if (weatherLocation) {
            void fetchWeather(weatherLocation);
        }
    }, [weatherLocation]);



    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/login');
        } catch (e) {
            console.error('Logout failed', e);
        }
    };

    return (
        <div className={styles.clockWidget}>
            <div className={styles.widgetRow}>
                <div className={styles.weatherIcon}>
                    {weather ? (
                        <>
                            {weather.isDay ? <Sun size={20} /> : <Moon size={20} />}
                            {weather.temp}°C
                        </>
                    ) : (
                        <span className={styles.weatherPlaceholder}>--°C</span>
                    )}
                </div>
                <div className={styles.clock}>
                    {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
            </div>

            <div className={styles.widgetControls}>
                <button
                    onClick={onRefresh}
                    className={styles.settingsBtn}
                    title="Refresh Status"
                >
                    <RefreshCw size={16} />
                </button>
                <button
                    onClick={onShowShortcuts}
                    className={styles.settingsBtn}
                    title="Keyboard Shortcuts (?)"
                >
                    <Keyboard size={16} />
                </button>
                <Link href="/settings" className={styles.settingsBtn}>
                    <Settings size={16} />
                </Link>
                <button onClick={handleLogout} className={styles.settingsBtn} title="Logout">
                    <LogOut size={16} />
                </button>
            </div>
        </div>
    );
}
