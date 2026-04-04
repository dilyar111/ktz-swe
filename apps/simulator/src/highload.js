/**
 * x10 Burst Mode
 * Запускает симулятор с 10-кратной частотой отправки (100мс вместо 1000мс).
 */
process.env.SIM_INTERVAL_MS = '100';
process.env.SIM_SCENARIO = 'critical'; // Для большего кол-ва алерт-событий при нагрузке

console.log('🔥 Starting HIGHLOAD x10 burst mode (10 msgs per second)...');
import('./index.js');
