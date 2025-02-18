import { useState, useCallback, useEffect } from 'react';

export function useRecordingTimer() {
  const [elapsedTime, setElapsedTime] = useState('00:00');
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timer;

    if (isActive) {
      interval = setInterval(() => {
        setSeconds(seconds => seconds + 1);
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        setElapsedTime(
          `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
        );
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isActive, seconds]);

  const startTimer = useCallback(() => {
    setIsActive(true);
    setSeconds(0);
    setElapsedTime('00:00');
  }, []);

  const stopTimer = useCallback(() => {
    setIsActive(false);
    setSeconds(0);
  }, []);

  return {
    elapsedTime,
    startTimer,
    stopTimer
  };
}