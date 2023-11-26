import { DependencyList, useEffect, useState } from 'react';

// useInitialLoadTimeInSeconds returns the initial load time between
// when the component mounted and when all of the passed
// `depsThatAllMustBeTrueToFinishInitialLoad` hook dependencies become
// truthy. The initial load timer will be reset if the passed
// `depsThatWillTriggerInitialLoadTimeReset` hook dependencies change.
export const useInitialLoadTimeInSeconds = (
  depsThatAllMustBeTrueToFinishInitialLoad: DependencyList,
  depsThatWillTriggerInitialLoadTimeReset: DependencyList
): number | undefined => {
  const [initialLoadDurationSeconds, setInitialLoadDurationSeconds] = useState<number | undefined>(undefined);
  const [startTime, setStartTime] = useState<number>(Date.now());

  useEffect(() => {
    setInitialLoadDurationSeconds(undefined);
    setStartTime(Date.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, depsThatWillTriggerInitialLoadTimeReset);

  useEffect(() => {
    const allDepsMet = depsThatAllMustBeTrueToFinishInitialLoad.every(dep => dep);
    if (allDepsMet && initialLoadDurationSeconds === undefined) {
      const durationInSeconds = (Date.now() - startTime) / 1000;
      setInitialLoadDurationSeconds(durationInSeconds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...depsThatAllMustBeTrueToFinishInitialLoad, initialLoadDurationSeconds, startTime]);

  return initialLoadDurationSeconds;
};
