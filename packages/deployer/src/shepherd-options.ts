export const shepherdOptions= {
  testRunMode: () => {
    return process.env.TESTRUN_MODE === "true" || false
  },
}
