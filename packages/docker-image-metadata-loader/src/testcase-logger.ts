export interface ILog{
  debugEntries: string[];
  infoEntries: string[];
  debug: (_msg: string) => void;
  info: (_msg: string) => void;
}


export function getTestCaseLogger(options: {
  debugOutput: boolean;
  infoOutput: boolean;
}):ILog {
  const debugEntries: string[] = [];
  const infoEntries: string[] = [];
  return {
    debugEntries: debugEntries,
    infoEntries: infoEntries,
    debug: (_msg: string) => {
      debugEntries.push(_msg);
      options.debugOutput && console.log("DEBUG " + _msg);
    },
    info: (_msg: string) => {
      infoEntries.push(_msg);
      options.infoOutput && console.log("INFO", _msg);
    }
  };
}
